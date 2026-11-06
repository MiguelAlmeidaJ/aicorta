import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, Injectable, Param, Post, Patch, Req, UseGuards } from "@nestjs/common";
import { IsDateString, IsIn, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";
import { PrismaService } from "./prisma.service";
import { JwtAuthGuard } from "./auth";
import { TenantRoleGuard, TenantRoles } from "./tenant-role.guard";
import { AgendaService } from "./agenda";
import { inside, localParts, weekday } from "./scheduling-time";

function translateDbConflict(error: unknown): never {
  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
  const message = error instanceof Error ? error.message : "";
  if (code === "23P01" || code === "40P01" || code === "P2002" ||
      (code === "P2010" && (message.includes("23P01") || message.includes("40P01"))) ||
      message.includes("appointment_professional_no_overlap")) {
    throw new ConflictException("Horário já reservado");
  }
  throw error;
}

export class CreateAppointmentDto {
  @IsUUID() serviceId!: string;
  @IsUUID() employeeMembershipId!: string;
  @IsUUID() clientId!: string;
  @IsDateString() startsAt!: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}
export class FinishAppointmentDto {
  @IsIn(["COMPLETED", "NO_SHOW"]) status!: "COMPLETED" | "NO_SHOW";
}

@Injectable()
export class BookingService {
  constructor(private readonly db: PrismaService, private readonly agenda: AgendaService) {}

  async assertTeamAccess(tenantId: string, userId: string) {
    const membership = await this.db.membership.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
      include: { tenant: true },
    });
    if (!membership?.isActive || membership.tenant.status !== "ACTIVE" || !["ADMIN", "EMPLOYEE"].includes(membership.role)) {
      throw new ForbiddenException("Sem permissão neste estabelecimento");
    }
  }

  services(tenantId: string) {
    return this.db.service.findMany({
      where: { tenantId, isActive: true, tenant: { status: "ACTIVE" } },
      select: { id: true, name: true, description: true, durationMinutes: true, priceCents: true },
      orderBy: { name: "asc" },
    });
  }

  async appointments(tenantId: string, userId: string) {
    await this.assertTeamAccess(tenantId, userId);
    return this.db.appointment.findMany({
      where: { tenantId },
      include: { service: { select: { name: true } }, client: { select: { name: true } } },
      orderBy: { startsAt: "asc" },
      take: 100,
    });
  }

  async create(tenantId: string, userId: string, dto: CreateAppointmentDto, selfService = false) {
    if (selfService) {
      if (dto.clientId !== userId) throw new ForbiddenException("Agendamento em nome de outro usuário não permitido");
    } else await this.assertTeamAccess(tenantId, userId);
    const [service, employee, client] = await Promise.all([
      this.db.service.findFirst({ where: { id: dto.serviceId, tenantId, isActive: true } }),
      this.db.membership.findFirst({ where: { id: dto.employeeMembershipId, tenantId, isActive: true, role: { in: ["ADMIN", "EMPLOYEE"] } } }),
      this.db.user.findFirst({ where: { id: dto.clientId, isActive: true, ...(selfService ? { globalRole: "USER" } : { memberships: { some: { tenantId, role: "CLIENT", isActive: true } } }) } }),
    ]);
    if (!service || !employee || !client) throw new BadRequestException("Serviço, profissional ou cliente inválido");
    const startsAt = new Date(dto.startsAt);
    if (Number.isNaN(startsAt.getTime()) || startsAt <= new Date()) throw new BadRequestException("Data deve estar no futuro");
    const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000);
    const tenant = await this.agenda.tenant(tenantId);
    const local = localParts(startsAt, tenant.timezone);
    const endLocal = localParts(endsAt, tenant.timezone);
    if (local.date !== endLocal.date || endLocal.minute !== local.minute + service.durationMinutes ||
        local.minute % 15 !== 0) throw new BadRequestException("Horário fora da grade de 15 minutos");
    try { return await this.db.$transaction(async tx => {
      // PostgreSQL transaction-scoped lock is shared between all API replicas using the same DB.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${tenantId + ":" + employee.id}, 0))::text`;
      if (selfService) {
        const currentMember = await tx.membership.findUnique({ where: { userId_tenantId: { userId, tenantId } } });
        if (currentMember && (!currentMember.isActive || currentMember.role !== "CLIENT")) {
          throw new ForbiddenException("Usuário não pode reservar como cliente neste estabelecimento");
        }
        if (!currentMember) await tx.membership.create({ data: { tenantId, userId, role: "CLIENT" } });
      }
      const day = weekday(local.date);
      const [shop, staff, off, busy, assigned] = await Promise.all([
        tx.workWindow.findMany({ where: { tenantId, membershipId: null, weekday: day } }),
        tx.workWindow.findMany({ where: { tenantId, membershipId: employee.id, weekday: day } }),
        tx.timeOff.findFirst({ where: { tenantId, membershipId: employee.id, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } } }),
        tx.appointment.findFirst({ where: { tenantId, employeeMembershipId: employee.id, status: { in: ["PENDING", "CONFIRMED"] },
          startsAt: { lt: endsAt }, endsAt: { gt: startsAt } } }),
        tx.employeeService.findUnique({ where: { membershipId_serviceId: { membershipId: employee.id, serviceId: service.id } } }),
      ]);
      if (!inside(shop, local.minute, endLocal.minute) || !inside(staff, local.minute, endLocal.minute) || !assigned) {
        throw new BadRequestException("Profissional indisponível para este serviço e horário");
      }
      if (off || busy) throw new ConflictException("Horário já ocupado ou bloqueado");
      // Revalidate membership and service after lock, within the same transaction.
      const current = await tx.membership.findFirst({ where: { id: employee.id, tenantId, isActive: true,
        role: { in: ["ADMIN", "EMPLOYEE"] } } });
      const activeService = await tx.service.findFirst({ where: { id: service.id, tenantId, isActive: true } });
      if (!current || !activeService) throw new BadRequestException("Profissional ou serviço inativo");
      return tx.appointment.create({ data: { tenantId, serviceId: service.id,
        employeeMembershipId: employee.id, clientId: client.id, startsAt, endsAt,
        priceCents: service.priceCents, notes: dto.notes } });
    }); } catch (error) { translateDbConflict(error); }
  }
  async mine(userId: string) {
    return this.db.appointment.findMany({ where: { clientId: userId },
      select: { id: true, tenantId: true, serviceId: true, employeeMembershipId: true, startsAt: true, endsAt: true, status: true, priceCents: true,
        service: { select: { name: true } }, tenant: { select: { name: true, slug: true } },
        employee: { select: { user: { select: { name: true } } } } },
      orderBy: { startsAt: "desc" }, take: 100 });
  }

  async cancel(tenantId: string, appointmentId: string, actorId: string) {
    const item = await this.db.appointment.findFirst({
      where: { id: appointmentId, tenantId }, select: { clientId: true, startsAt: true, status: true },
    });
    if (!item) throw new BadRequestException("Agendamento não encontrado");
    const actor = await this.db.membership.findUnique({
      where: { userId_tenantId: { userId: actorId, tenantId } },
      select: { role: true, isActive: true, tenant: { select: { status: true } } },
    });
    const admin = actor?.isActive && actor.role === "ADMIN" && actor.tenant.status === "ACTIVE";
    if (!admin && actorId !== item.clientId) throw new ForbiddenException("Sem acesso");
    if (!["PENDING", "CONFIRMED"].includes(item.status)) throw new ConflictException("Reserva não pode ser cancelada");
    if (!admin && item.startsAt.getTime() - Date.now() < 2 * 3600000) {
      throw new ConflictException("Cancelamento exige 2 horas de antecedência");
    }
    const updated = await this.db.appointment.updateMany({
      where: { id: appointmentId, tenantId, status: { in: ["PENDING", "CONFIRMED"] } },
      data: { status: "CANCELLED" },
    });
    if (!updated.count) throw new ConflictException("Reserva alterada por outra solicitação");
    return { ok: true, status: "CANCELLED" };
  }

  async confirm(tenantId: string, appointmentId: string, actorId: string) {
    await this.assertTeamAccess(tenantId, actorId);
    const updated = await this.db.appointment.updateMany({
      where: { id: appointmentId, tenantId, status: "PENDING" }, data: { status: "CONFIRMED" },
    });
    if (!updated.count) throw new ConflictException("Reserva não está pendente");
    return { ok: true, status: "CONFIRMED" };
  }

  async finish(tenantId: string, appointmentId: string, actorId: string, status: "COMPLETED" | "NO_SHOW") {
    await this.assertTeamAccess(tenantId, actorId);
    const updated = await this.db.appointment.updateMany({
      where: { id: appointmentId, tenantId, status: "CONFIRMED", startsAt: { lte: new Date() } },
      data: { status },
    });
    if (!updated.count) throw new ConflictException("Atendimento deve estar confirmado e já iniciado");
    return { ok: true, status };
  }

  async reschedule(tenantId: string, appointmentId: string, actorId: string, time: string) {
    const item = await this.db.appointment.findFirst({ where: { id: appointmentId, tenantId },
      select: { clientId: true, serviceId: true, employeeMembershipId: true, startsAt: true,
        endsAt: true, status: true } });
    if (!item) throw new BadRequestException("Reserva não encontrada");
    if (actorId !== item.clientId) throw new ForbiddenException("Somente o cliente pode remarcar");
    if (!["PENDING", "CONFIRMED"].includes(item.status) || item.startsAt.getTime() - Date.now() < 2 * 3600000) {
      throw new ConflictException("Reserva não permite remarcação");
    }
    const start = new Date(time);
    if (Number.isNaN(start.getTime()) || start <= new Date()) throw new BadRequestException("Novo horário inválido");
    const tenant = await this.agenda.tenant(tenantId);
    const local = localParts(start, tenant.timezone);
    const possible = await this.agenda.availability(tenantId, item.serviceId, item.employeeMembershipId, local.date);
    if (!possible.slots.includes(start.toISOString())) throw new ConflictException("Novo horário indisponível");
    const end = new Date(start.getTime() + item.endsAt.getTime() - item.startsAt.getTime());
    try { return await this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${tenantId + ":" + item.employeeMembershipId}, 0))::text`;
      const original = await tx.appointment.findUnique({ where: { id: appointmentId } });
      if (!original || !["PENDING", "CONFIRMED"].includes(original.status) ||
          original.startsAt.getTime() - Date.now() < 2 * 3600000) throw new ConflictException("Reserva alterada");
      const [collision, leave, professional, service, enabled, shop, staff] = await Promise.all([
        tx.appointment.findFirst({ where: { tenantId, employeeMembershipId: item.employeeMembershipId,
          id: { not: appointmentId }, status: { in: ["PENDING", "CONFIRMED"] },
          startsAt: { lt: end }, endsAt: { gt: start } } }),
        tx.timeOff.findFirst({ where: { tenantId, membershipId: item.employeeMembershipId,
          startsAt: { lt: end }, endsAt: { gt: start } } }),
        tx.membership.findFirst({ where: { tenantId, id: item.employeeMembershipId, isActive: true } }),
        tx.service.findFirst({ where: { tenantId, id: item.serviceId, isActive: true } }),
        tx.employeeService.findUnique({ where: { membershipId_serviceId: {
          membershipId: item.employeeMembershipId, serviceId: item.serviceId } } }),
        tx.workWindow.findMany({ where: { tenantId, membershipId: null, weekday: weekday(local.date) } }),
        tx.workWindow.findMany({ where: { tenantId, membershipId: item.employeeMembershipId, weekday: weekday(local.date) } }),
      ]);
      const endLocal = localParts(end, tenant.timezone);
      if (collision || leave || !professional || !service || !enabled ||
        endLocal.date !== local.date || endLocal.minute !== local.minute + service.durationMinutes ||
        !inside(shop, local.minute, endLocal.minute) || !inside(staff, local.minute, endLocal.minute)) {
        throw new ConflictException("Novo horário indisponível");
      }
      const result = await tx.appointment.updateMany({
        where: { id: appointmentId, tenantId, status: { in: ["PENDING", "CONFIRMED"] } },
        data: { startsAt: start, endsAt: end, status: "PENDING" },
      });
      if (!result.count) throw new ConflictException("Reserva foi alterada");
      return tx.appointment.findUniqueOrThrow({ where: { id: appointmentId },
        select: { id: true, status: true, startsAt: true, endsAt: true } });
    }); } catch (error) { translateDbConflict(error); }
  }

}

@Controller("tenants/:tenantId")
export class BookingController {
  constructor(private readonly booking: BookingService) {}
  @UseGuards(JwtAuthGuard, TenantRoleGuard) @TenantRoles("ADMIN", "EMPLOYEE")
  @Get("appointments")
  appointments(@Param("tenantId") tenantId: string, @Req() req: { user: { id: string } }) {
    return this.booking.appointments(tenantId, req.user.id);
  }
  @UseGuards(JwtAuthGuard, TenantRoleGuard) @TenantRoles("ADMIN", "EMPLOYEE")
  @Post("appointments")
  create(@Param("tenantId") tenantId: string, @Req() req: { user: { id: string } }, @Body() dto: CreateAppointmentDto) {
    return this.booking.create(tenantId, req.user.id, dto);
  }
  @UseGuards(JwtAuthGuard, TenantRoleGuard) @TenantRoles("ADMIN", "EMPLOYEE")
  @Patch("appointments/:appointmentId/confirm")
  confirm(@Param("tenantId") tenantId: string, @Param("appointmentId") appointmentId: string,
    @Req() req: { user: { id: string } }) {
    return this.booking.confirm(tenantId, appointmentId, req.user.id);
  }
  @UseGuards(JwtAuthGuard, TenantRoleGuard) @TenantRoles("ADMIN", "EMPLOYEE")
  @Patch("appointments/:appointmentId/status")
  finish(@Param("tenantId") tenantId: string, @Param("appointmentId") appointmentId: string,
    @Req() req: { user: { id: string } }, @Body() dto: FinishAppointmentDto) {
    return this.booking.finish(tenantId, appointmentId, req.user.id, dto.status);
  }

}
