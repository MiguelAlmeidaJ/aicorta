import {
  Body, Controller, Get, Injectable, Param, Patch, Req, UseGuards,
} from "@nestjs/common";
import { IsIn } from "class-validator";
import { PrismaService } from "./prisma.service";
import { JwtAuthGuard, SystemGuard } from "./auth";
import { TenantRoleGuard, TenantRoles } from "./tenant-role.guard";
import { localParts, localToUtc } from "./scheduling-time";

export class ChangeTenantStatusDto {
  @IsIn(["ACTIVE", "SUSPENDED"])
  status!: "ACTIVE" | "SUSPENDED";
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

  async setTenantStatus(id: string, status: "ACTIVE" | "SUSPENDED") {
    return this.db.tenant.update({
      where: { id }, data: { status },
      select: { id: true, name: true, status: true },
    });
  }

  async barbershop(tenantId: string) {
    const tenant = await this.db.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { id: true, name: true, slug: true, status: true,
        billingDueDay: true, timezone: true },
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
    const [appointmentsToday, pending, team, clients, services, revenue, upcoming] = await Promise.all([
      this.db.appointment.count({ where: { tenantId, startsAt: { gte: start, lt: end },
        status: { not: "CANCELLED" } } }),
      this.db.appointment.count({ where: { tenantId, status: "PENDING", startsAt: { gte: now } } }),
      this.db.membership.count({ where: { tenantId, isActive: true, role: { in: ["ADMIN", "EMPLOYEE"] } } }),
      this.db.membership.count({ where: { tenantId, isActive: true, role: "CLIENT" } }),
      this.db.service.count({ where: { tenantId, isActive: true } }),
      this.db.appointment.aggregate({ where: { tenantId, status: "COMPLETED",
        startsAt: { gte: monthFrom } }, _sum: { priceCents: true } }),
      this.db.appointment.findMany({
        where: { tenantId, startsAt: { gte: now }, status: { in: ["PENDING", "CONFIRMED"] } },
        take: 8, orderBy: { startsAt: "asc" },
        select: {
          id: true, startsAt: true, endsAt: true, status: true, priceCents: true,
          client: { select: { name: true } }, service: { select: { name: true } },
          employee: { select: { user: { select: { name: true } } } },
        },
      }),
    ]);
    return { tenant, appointmentsToday, pending, team, clients, services,
      completedRevenueCents: revenue._sum.priceCents ?? 0, upcoming };
  }
}

@Controller()
export class DashboardController {
  constructor(private readonly dashboards: DashboardService) {}

  @UseGuards(JwtAuthGuard, SystemGuard)
  @Get("system/dashboard")
  system() { return this.dashboards.system(); }

  @UseGuards(JwtAuthGuard, SystemGuard)
  @Get("system/tenants")
  tenants() { return this.dashboards.tenants(); }

  @UseGuards(JwtAuthGuard, SystemGuard)
  @Patch("system/tenants/:tenantId/status")
  setStatus(@Param("tenantId") tenantId: string, @Body() dto: ChangeTenantStatusDto) {
    return this.dashboards.setTenantStatus(tenantId, dto.status);
  }

  @UseGuards(JwtAuthGuard, TenantRoleGuard) @TenantRoles("ADMIN", "EMPLOYEE")
  @Get("tenants/:tenantId/dashboard")
  tenant(@Param("tenantId") tenantId: string) { return this.dashboards.barbershop(tenantId); }
}
