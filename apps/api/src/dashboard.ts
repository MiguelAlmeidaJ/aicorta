import {
  BadRequestException, Body, ConflictException, Controller, Get, Injectable, Param, Patch, Post, Req, UseGuards,
} from "@nestjs/common";
import { IsEmail, IsIn, IsInt, IsString, Matches, Max, MaxLength, Min, MinLength } from "class-validator";
import { hash } from "bcryptjs";
import { PrismaService } from "./prisma.service";
import { JwtAuthGuard, PlatformStaffGuard } from "./auth";
import { TenantRoleGuard, TenantRoles } from "./tenant-role.guard";
import { localParts, localToUtc } from "./scheduling-time";
import { normalizeBrazilianWhatsapp, whatsappVariants } from "./phone";
import { tenantAddressComplete } from "./tenant-address";

export class ChangeTenantStatusDto {
  @IsIn(["ACTIVE", "SUSPENDED"])
  status!: "ACTIVE" | "SUSPENDED";
}

export class CreateTenantDto {
  @IsString() @MinLength(2) @MaxLength(100) name!: string;
  @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @MinLength(3) @MaxLength(50) slug!: string;
  @IsInt() @Min(1) @Max(31) billingDueDay!: number;
  @IsString() @MinLength(2) @MaxLength(100) ownerName!: string;
  @IsString() @Matches(/^[a-z0-9]{3,30}$/) ownerUsername!: string;
  @IsEmail() ownerEmail!: string;
  @IsString() ownerWhatsapp!: string;
  @IsString() @MinLength(10) @MaxLength(128) ownerPassword!: string;
}

@Injectable()
export class DashboardService {
  constructor(private readonly db: PrismaService) {}

  async system() {
    const [tenants, active, suspended, users, invites, recent] = await Promise.all([
      this.db.tenant.count(),
      this.db.tenant.count({ where: { status: "ACTIVE" } }),
      this.db.tenant.count({ where: { status: "SUSPENDED" } }),
      this.db.user.count({ where: { globalRole: "USER" } }),
      this.db.ownerInvite.count({
        where: { consumedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      }),
      this.db.tenant.findMany({
        take: 6, orderBy: { createdAt: "desc" },
        select: { id: true, name: true, slug: true, status: true,
          billingDueDay: true, createdAt: true, owner: { select: { name: true, email: true } } },
      }),
    ]);
    return { tenants, active, suspended, users, pendingInvites: invites, recent };
  }

  async tenants() {
    return this.db.tenant.findMany({
      take: 250, orderBy: { createdAt: "desc" },
      select: {
        id: true, name: true, slug: true, status: true, createdAt: true,
        billingDueDay: true, owner: { select: { id: true, name: true, email: true } },
        _count: { select: { appointments: true, services: true, memberships: true } },
      },
    });
  }

  async createTenant(dto: CreateTenantDto, actorUserId?: string) {
    const whatsapp = normalizeBrazilianWhatsapp(dto.ownerWhatsapp);
    if (!whatsapp) throw new BadRequestException("WhatsApp inválido: informe DDD + celular (11 dígitos).");
    const passwordHash = await hash(dto.ownerPassword, 12);
    try {
      return await this.db.$transaction(async tx => {
        if (await tx.user.findFirst({
          where: { whatsapp: { in: whatsappVariants(whatsapp) } }, select: { id: true },
        })) throw new ConflictException("WhatsApp já cadastrado");
        const owner = await tx.user.create({
          data: {
            name: dto.ownerName.trim(), username: dto.ownerUsername.trim().toLowerCase(),
            email: dto.ownerEmail.trim().toLowerCase(), whatsapp, passwordHash,
          },
        });
        const tenant = await tx.tenant.create({
          data: {
            name: dto.name.trim(), slug: dto.slug.trim().toLowerCase(), ownerId: owner.id,
            billingDueDay: dto.billingDueDay,
          },
        });
        await tx.membership.create({
          data: { userId: owner.id, tenantId: tenant.id, role: "ADMIN" },
        });
        if (actorUserId) await tx.platformAudit.create({ data: {
          actorUserId, action: "TENANT_CREATED", targetType: "TENANT", targetId: tenant.id,
          details: { name: tenant.name, slug: tenant.slug },
        } });
        return tx.tenant.findUniqueOrThrow({
          where: { id: tenant.id },
          select: {
            id: true, name: true, slug: true, status: true, createdAt: true,
            billingDueDay: true, owner: { select: { id: true, name: true, email: true } },
            _count: { select: { appointments: true, services: true, memberships: true } },
          },
        });
      });
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
        throw new ConflictException("Slug, usuário, e-mail ou WhatsApp já cadastrado");
      }
      throw error;
    }
  }

  async setTenantStatus(id: string, status: "ACTIVE" | "SUSPENDED", actorUserId?: string) {
    return this.db.$transaction(async tx => {
      const tenant = await tx.tenant.update({
        where: { id }, data: { status, suspensionReason: status === "SUSPENDED" ? "MANUAL" : null },
        select: { id: true, name: true, status: true },
      });
      if (actorUserId) await tx.platformAudit.create({ data: {
        actorUserId, action: status === "SUSPENDED" ? "TENANT_SUSPENDED" : "TENANT_ACTIVATED",
        targetType: "TENANT", targetId: id, details: { name: tenant.name },
      } });
      return tenant;
    });
  }

  async barbershop(tenantId: string, actorId: string) {
    const tenant = await this.db.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { id: true, name: true, slug: true, status: true,
        billingDueDay: true, timezone: true, postalCode: true, street: true, streetNumber: true,
        neighborhood: true, city: true, state: true, latitude: true, longitude: true },
    });
    const now = new Date();
    const localToday = localParts(now, tenant.timezone).date;
    const start = localToUtc(localToday, 0, tenant.timezone) ?? new Date(localToday + "T00:00:00Z");
    const dayAfter = new Date(localToday + "T12:00:00Z");
    dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);
    const nextDay = dayAfter.toISOString().slice(0, 10);
    const end = localToUtc(nextDay, 0, tenant.timezone) ?? new Date(nextDay + "T00:00:00Z");
    const monthStart = localToday.slice(0, 7) + "-01";
    const monthFrom = localToUtc(monthStart, 0, tenant.timezone) ?? new Date(monthStart + "T00:00:00Z");
    const [appointmentsToday, pending, team, clients, services, serviceValue, paymentsReceived, upcoming, shopHours, staffHours, assignedServices] = await Promise.all([
      this.db.appointment.count({ where: { tenantId, startsAt: { gte: start, lt: end },
        status: { not: "CANCELLED" } } }),
      this.db.appointment.count({ where: { tenantId, status: "PENDING", startsAt: { gte: now } } }),
      this.db.membership.count({ where: { tenantId, isActive: true, role: { in: ["ADMIN", "EMPLOYEE"] } } }),
      this.db.membership.count({ where: { tenantId, isActive: true, role: "CLIENT" } }),
      this.db.service.count({ where: { tenantId, isActive: true } }),
      this.db.appointment.aggregate({ where: { tenantId, status: "COMPLETED",
        startsAt: { gte: monthFrom } }, _sum: { priceCents: true } }),
      this.db.payment.aggregate({ where: { tenantId, status: "CONFIRMED",
        createdAt: { gte: monthFrom, lt: end } }, _sum: { amountCents: true } }),
      this.db.appointment.findMany({
        where: { tenantId, startsAt: { gte: now }, status: { in: ["PENDING", "CONFIRMED"] } },
        take: 8, orderBy: { startsAt: "asc" },
        select: {
          id: true, startsAt: true, endsAt: true, status: true, priceCents: true,
          client: { select: { name: true } }, service: { select: { name: true } },
          employee: { select: { user: { select: { name: true } } } },
        },
      }),
      this.db.workWindow.count({ where: { tenantId, membershipId: null } }),
      this.db.workWindow.count({ where: { tenantId, membershipId: { not: null } } }),
      this.db.employeeService.count({ where: { membership: { tenantId, isActive: true } } }),
    ]);
    const actor = await this.db.membership.findUnique({
      where: { userId_tenantId: { userId: actorId, tenantId } },
      select: { role: true },
    });
    return { tenant, actorRole: actor?.role, appointmentsToday, pending, team, clients, services,
      setup: { address: tenantAddressComplete(tenant), services: services > 0, shopHours: shopHours > 0,
        professionalHours: staffHours > 0, assignedServices: assignedServices > 0 },
      completedServiceValueCents: serviceValue._sum.priceCents ?? 0,
      receivedPaymentsCents: paymentsReceived._sum.amountCents ?? 0, upcoming };
  }
}

@Controller()
export class DashboardController {
  constructor(private readonly dashboards: DashboardService) {}

  @UseGuards(JwtAuthGuard, PlatformStaffGuard)
  @Get("system/dashboard")
  system() { return this.dashboards.system(); }

  @UseGuards(JwtAuthGuard, PlatformStaffGuard)
  @Get("system/tenants")
  tenants() { return this.dashboards.tenants(); }

  @UseGuards(JwtAuthGuard, PlatformStaffGuard)
  @Post("system/tenants")
  createTenant(@Body() dto: CreateTenantDto, @Req() req: { user: { id: string } }) { return this.dashboards.createTenant(dto, req.user.id); }

  @UseGuards(JwtAuthGuard, PlatformStaffGuard)
  @Patch("system/tenants/:tenantId/status")
  setStatus(@Param("tenantId") tenantId: string, @Body() dto: ChangeTenantStatusDto, @Req() req: { user: { id: string } }) {
    return this.dashboards.setTenantStatus(tenantId, dto.status, req.user.id);
  }

  @UseGuards(JwtAuthGuard, TenantRoleGuard) @TenantRoles("ADMIN", "EMPLOYEE")
  @Get("tenants/:tenantId/dashboard")
  tenant(@Param("tenantId") tenantId: string, @Req() req: { user: { id: string } }) {
    return this.dashboards.barbershop(tenantId, req.user.id);
  }
}
