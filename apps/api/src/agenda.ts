import { BadRequestException, Body, Controller, ForbiddenException, Get, Injectable, NotFoundException, Param, Post, Put, Query, Req, UseGuards } from "@nestjs/common";
import { ArrayMaxSize, IsArray, IsDateString, IsInt, IsOptional, IsString, IsUUID, Max, Min, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { PrismaService } from "./prisma.service";
import { JwtAuthGuard } from "./auth";
import { TenantRoleGuard, TenantRoles } from "./tenant-role.guard";
import { inside, insideBookingHorizon, localParts, localToUtc, overlaps, validDate, validWindows, weekday } from "./scheduling-time";

export class WorkWindowDto {
  @IsInt() @Min(0) @Max(6) weekday!: number;
  @IsInt() @Min(0) @Max(1439) startMinute!: number;
  @IsInt() @Min(1) @Max(1440) endMinute!: number;
}
export class ScheduleDto {
  @IsArray() @ArrayMaxSize(40) @ValidateNested({ each: true }) @Type(() => WorkWindowDto)
  windows!: WorkWindowDto[];
}
export class AssignServicesDto {
  @IsArray() @ArrayMaxSize(100) @IsUUID("all", { each: true }) serviceIds!: string[];
}
export class TimeOffDto {
  @IsUUID() membershipId!: string;
  @IsDateString() startsAt!: string;
  @IsDateString() endsAt!: string;
  @IsOptional() @IsString() reason?: string;
}

@Injectable()
export class AgendaService {
  constructor(private readonly db: PrismaService) {}
  async tenant(tenantId: string) {
    const tenant = await this.db.tenant.findFirst({ where: { id: tenantId, status: "ACTIVE" }, select: { timezone: true, bookingAdvanceDays: true } });
    if (!tenant) throw new NotFoundException("Estabelecimento não encontrado");
    try { new Intl.DateTimeFormat("pt-BR", { timeZone: tenant.timezone }); }
    catch { throw new BadRequestException("Fuso horário inválido"); }
    return tenant;
  }
  async professional(tenantId: string, id: string) {
    const member = await this.db.membership.findFirst({
      where: { id, tenantId, isActive: true, appearsInAgenda: true, role: { in: ["ADMIN", "EMPLOYEE"] } },
      select: { id: true, userId: true },
    });
    if (!member) throw new NotFoundException("Profissional não encontrado");
    return member;
  }
  async listWindows(tenantId: string, memberId?: string) {
    await this.tenant(tenantId);
    if (memberId) await this.professional(tenantId, memberId);
    return this.db.workWindow.findMany({
      where: { tenantId, membershipId: memberId ?? null }, orderBy: [{ weekday: "asc" }, { startMinute: "asc" }],
    });
  }
  async replaceWindows(tenantId: string, rows: WorkWindowDto[], memberId?: string) {
    await this.tenant(tenantId);
    if (!validWindows(rows)) throw new BadRequestException("Intervalos inválidos ou sobrepostos");
    if (memberId) await this.professional(tenantId, memberId);
    return this.db.$transaction(async tx => {
      await tx.workWindow.deleteMany({ where: { tenantId, membershipId: memberId ?? null } });
      if (rows.length) await tx.workWindow.createMany({ data: rows.map(row => ({
        tenantId, membershipId: memberId ?? null, weekday: row.weekday,
        startMinute: row.startMinute, endMinute: row.endMinute,
      })) });
      return { ok: true, total: rows.length };
    });
  }
  async assign(tenantId: string, memberId: string, serviceIds: string[]) {
    await this.tenant(tenantId);
    await this.professional(tenantId, memberId);
    const ids = [...new Set(serviceIds)];
    const count = await this.db.service.count({ where: { tenantId, id: { in: ids }, isActive: true } });
    if (count !== ids.length) throw new BadRequestException("Serviço inválido ou de outro estabelecimento");
    return this.db.$transaction(async tx => {
      await tx.employeeService.deleteMany({ where: { membershipId: memberId } });
      if (ids.length) await tx.employeeService.createMany({ data: ids.map(serviceId => ({ membershipId: memberId, serviceId })) });
      const unassigned = await tx.service.findMany({
        where: { tenantId, employees: { none: {} } }, select: { id: true },
      });
      if (unassigned.length) {
        const tenant = await tx.tenant.findUnique({ where: { id: tenantId }, select: { ownerId: true } });
        const owner = tenant && await tx.membership.findUnique({
          where: { userId_tenantId: { userId: tenant.ownerId, tenantId } }, select: { id: true, isActive: true, appearsInAgenda: true },
        });
        if (owner?.isActive && owner.appearsInAgenda) await tx.employeeService.createMany({
          data: unassigned.map(service => ({ membershipId: owner.id, serviceId: service.id })),
          skipDuplicates: true,
        });
      }
      return { ok: true, total: ids.length };
    });
  }
  async assigned(tenantId: string, memberId: string) {
    await this.tenant(tenantId);
    await this.professional(tenantId, memberId);
    return this.db.employeeService.findMany({ where: { membershipId: memberId, service: { tenantId } },
      select: { service: { select: { id: true, name: true, durationMinutes: true, priceCents: true, isActive: true } } } });
  }
  async createTimeOff(tenantId: string, dto: TimeOffDto) {
    await this.tenant(tenantId);
    await this.professional(tenantId, dto.membershipId);
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (!(startsAt < endsAt) || endsAt.getTime() - startsAt.getTime() > 31 * 86400000) {
      throw new BadRequestException("Intervalo de folga inválido ou maior que 31 dias");
    }
    return this.db.timeOff.create({ data: { tenantId, membershipId: dto.membershipId,
      startsAt, endsAt, reason: dto.reason?.slice(0, 300) } });
  }
  async listTimeOff(tenantId: string, memberId: string, actorId: string) {
    await this.tenant(tenantId);
    const member = await this.professional(tenantId, memberId);
    const actor = await this.db.membership.findUnique({ where: { userId_tenantId: { tenantId, userId: actorId } },
      select: { role: true, isActive: true } });
    if (!actor?.isActive || (actor.role !== "ADMIN" && member.userId !== actorId)) throw new ForbiddenException();
    return this.db.timeOff.findMany({ where: { tenantId, membershipId: memberId }, orderBy: { startsAt: "asc" } });
  }
  async availability(tenantId: string, serviceId: string, memberId: string, date: string) {
    return this.availabilityForServices(tenantId, [serviceId], memberId, date);
  }
  async availabilityForServices(tenantId: string, serviceIds: string[], memberId: string, date: string) {
    if (!validDate(date)) throw new BadRequestException("Data inválida (AAAA-MM-DD)");
    const tenant = await this.tenant(tenantId);
    if (!insideBookingHorizon(date, tenant.timezone, tenant.bookingAdvanceDays ?? 21)) {
      return { date, timezone: tenant.timezone, slots: [] as string[] };
    }
    await this.professional(tenantId, memberId);
    const ids = [...new Set(serviceIds)];
    if (!ids.length || ids.length > 10) throw new BadRequestException("Selecione entre 1 e 10 serviços");
    const services = await this.db.service.findMany({ where: { tenantId, id: { in: ids }, isActive: true,
      employees: { some: { membershipId: memberId } } }, select: { durationMinutes: true } });
    if (services.length !== ids.length) throw new BadRequestException("Serviço não atribuído ao profissional");
    const durationMinutes = services.reduce((total, service) => total + service.durationMinutes, 0);
    const wday = weekday(date);
    const [shop, staff] = await Promise.all([
      this.db.workWindow.findMany({ where: { tenantId, membershipId: null, weekday: wday } }),
      this.db.workWindow.findMany({ where: { tenantId, membershipId: memberId, weekday: wday } }),
    ]);
    if (!shop.length || !staff.length) return { date, timezone: tenant.timezone, slots: [] as string[] };
    const next = new Date(date + "T12:00:00Z");
    next.setUTCDate(next.getUTCDate() + 1);
    const nextDate = next.toISOString().slice(0, 10);
    const from = localToUtc(date, 0, tenant.timezone) ?? new Date(date + "T00:00:00Z");
    const to = localToUtc(nextDate, 0, tenant.timezone) ?? new Date(nextDate + "T23:59:59Z");
    const [bookings, timeOff] = await Promise.all([
      this.db.appointment.findMany({ where: { tenantId, employeeMembershipId: memberId,
        status: { in: ["PENDING", "CONFIRMED"] }, startsAt: { lt: to }, endsAt: { gt: from } },
        select: { startsAt: true, endsAt: true } }),
      this.db.timeOff.findMany({ where: { tenantId, membershipId: memberId,
        startsAt: { lt: to }, endsAt: { gt: from } },
        select: { startsAt: true, endsAt: true } }),
    ]);
    const slots: string[] = [];
    const now = new Date();
    for (let m = 0; m + durationMinutes <= 1440; m += 15) {
      if (!inside(shop, m, m + durationMinutes) || !inside(staff, m, m + durationMinutes)) continue;
      const start = localToUtc(date, m, tenant.timezone);
      const end = start && new Date(start.getTime() + durationMinutes * 60000);
      if (!start || !end || start <= now) continue;
      const endLocal = localParts(end, tenant.timezone);
      if (endLocal.date !== date || endLocal.minute !== m + durationMinutes) continue;
      if ([...bookings, ...timeOff].some(block => overlaps(start, end, block.startsAt, block.endsAt))) continue;
      slots.push(start.toISOString());
    }
    return { date, timezone: tenant.timezone, slots };
  }
}

@Controller("tenants/:tenantId/agenda")
@UseGuards(JwtAuthGuard, TenantRoleGuard)
export class AgendaController {
  constructor(private readonly agenda: AgendaService) {}
  @TenantRoles("ADMIN", "EMPLOYEE") @Get("availability")
  availability(@Param("tenantId") tenantId: string, @Query("serviceId") serviceId: string,
    @Query("membershipId") membershipId: string, @Query("date") date: string) {
    if (!serviceId || !membershipId || !date) throw new BadRequestException("Informe serviceId, membershipId e date");
    return this.agenda.availability(tenantId, serviceId, membershipId, date);
  }
  @TenantRoles("ADMIN") @Get("hours")
  hours(@Param("tenantId") tenantId: string) { return this.agenda.listWindows(tenantId); }
  @TenantRoles("ADMIN") @Put("hours")
  replaceHours(@Param("tenantId") tenantId: string, @Body() dto: ScheduleDto) {
    return this.agenda.replaceWindows(tenantId, dto.windows);
  }
  @TenantRoles("ADMIN") @Get("professionals/:memberId/hours")
  staffHours(@Param("tenantId") tenantId: string, @Param("memberId") memberId: string) {
    return this.agenda.listWindows(tenantId, memberId);
  }
  @TenantRoles("ADMIN") @Put("professionals/:memberId/hours")
  replaceStaffHours(@Param("tenantId") tenantId: string, @Param("memberId") memberId: string, @Body() dto: ScheduleDto) {
    return this.agenda.replaceWindows(tenantId, dto.windows, memberId);
  }
  @TenantRoles("ADMIN") @Get("professionals/:memberId/services")
  assigned(@Param("tenantId") tenantId: string, @Param("memberId") memberId: string) {
    return this.agenda.assigned(tenantId, memberId);
  }
  @TenantRoles("ADMIN") @Put("professionals/:memberId/services")
  assign(@Param("tenantId") tenantId: string, @Param("memberId") memberId: string, @Body() dto: AssignServicesDto) {
    return this.agenda.assign(tenantId, memberId, dto.serviceIds);
  }
  @TenantRoles("ADMIN") @Post("time-off")
  timeOff(@Param("tenantId") tenantId: string, @Body() dto: TimeOffDto) {
    return this.agenda.createTimeOff(tenantId, dto);
  }
  @TenantRoles("ADMIN", "EMPLOYEE") @Get("professionals/:memberId/time-off")
  timeOffList(@Param("tenantId") tenantId: string, @Param("memberId") memberId: string, @Req() req: { user: { id: string } }) {
    return this.agenda.listTimeOff(tenantId, memberId, req.user.id);
  }
}
