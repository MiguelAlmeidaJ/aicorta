import { BadRequestException, Body, Controller, ForbiddenException, Get, Injectable, Param, Post, Req, UseGuards } from "@nestjs/common";
import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";
import { PrismaService } from "./prisma.service";
import { JwtAuthGuard } from "./auth";
import { TenantRoleGuard, TenantRoles } from "./tenant-role.guard";

export class CreateAppointmentDto {
  @IsUUID() serviceId!: string;
  @IsUUID() employeeMembershipId!: string;
  @IsUUID() clientId!: string;
  @IsDateString() startsAt!: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

@Injectable()
export class BookingService {
  constructor(private readonly db: PrismaService) {}

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

  async create(tenantId: string, userId: string, dto: CreateAppointmentDto) {
    await this.assertTeamAccess(tenantId, userId);
    const [service, employee, client] = await Promise.all([
      this.db.service.findFirst({ where: { id: dto.serviceId, tenantId, isActive: true } }),
      this.db.membership.findFirst({ where: { id: dto.employeeMembershipId, tenantId, isActive: true, role: { in: ["ADMIN", "EMPLOYEE"] } } }),
      this.db.user.findFirst({ where: { id: dto.clientId, isActive: true, memberships: { some: { tenantId, role: "CLIENT", isActive: true } } } }),
    ]);
    if (!service || !employee || !client) throw new BadRequestException("Serviço, profissional ou cliente inválido");
    const startsAt = new Date(dto.startsAt);
    if (Number.isNaN(startsAt.getTime()) || startsAt <= new Date()) throw new BadRequestException("Data deve estar no futuro");
    const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000);
    // TODO: criar bloqueio anti-concorrência no PostgreSQL antes de liberar o agendamento público.
    return this.db.appointment.create({
      data: { tenantId, serviceId: service.id, employeeMembershipId: employee.id, clientId: client.id, startsAt, endsAt, priceCents: service.priceCents, notes: dto.notes },
    });
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
}
