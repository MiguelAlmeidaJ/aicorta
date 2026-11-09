import {
  BadRequestException, Body, Controller, ForbiddenException, Get, Injectable, Logger, NotFoundException,
  OnModuleDestroy, OnModuleInit, Param, Patch, Post, Req, UseGuards,
} from "@nestjs/common";
import { IsDateString, IsInt, Max, Min } from "class-validator";
import { JwtAuthGuard, SystemGuard } from "./auth";
import { PrismaService } from "./prisma.service";
import { localParts, localToUtc } from "./scheduling-time";

const BILLING_ZONE = "America/Sao_Paulo";

export class BillingConfigDto {
  @IsInt() @Min(0) monthlyFeeCents!: number;
  @IsInt() @Min(1) @Max(31) billingDueDay!: number;
  @IsDateString() billingStartedAt!: string;
}

export function lastDayOfMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0, 12)).getUTCDate();
}

function addDays(date: string, days: number) {
  const value = new Date(date + "T12:00:00Z");
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function competenceRange(from: string, through: string) {
  const [fromYear, fromMonth] = from.split("-").map(Number);
  const [toYear, toMonth] = through.split("-").map(Number);
  const result: string[] = [];
  for (let index = fromYear * 12 + fromMonth - 1; index <= toYear * 12 + toMonth - 1 && result.length < 1200; index++) {
    result.push(`${Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, "0")}`);
  }
  return result;
}

export function monthlyDueBoundary(competence: string, requestedDay: number, contractDate: string, zone = BILLING_ZONE) {
  const [year, month] = competence.split("-").map(Number);
  const day = Math.min(requestedDay, lastDayOfMonth(year, month));
  const regularDueOn = `${competence}-${String(day).padStart(2, "0")}`;
  const dueOn = competence === contractDate.slice(0, 7) && regularDueOn < contractDate ? contractDate : regularDueOn;
  const overdueAt = localToUtc(addDays(dueOn, 1), 0, zone);
  if (!overdueAt) throw new Error(`Não foi possível calcular o vencimento de ${competence}`);
  return { dueOn, overdueAt };
}

@Injectable()
export class BillingService {
  constructor(private readonly db: PrismaService) {}

  private async generateForTenant(tenant: {
    id: string; monthlyFeeCents: number; billingDueDay: number; billingStartedAt: Date; timezone: string;
  }, now: Date) {
    if (tenant.monthlyFeeCents <= 0 || tenant.billingStartedAt > now) return 0;
    const contractDate = localParts(tenant.billingStartedAt, tenant.timezone).date;
    const currentDate = localParts(now, tenant.timezone).date;
    const competencies = competenceRange(contractDate.slice(0, 7), currentDate.slice(0, 7));
    const result = await this.db.monthlyFee.createMany({
      data: competencies.map(competence => ({
        tenantId: tenant.id,
        competence,
        amountCents: tenant.monthlyFeeCents,
        ...monthlyDueBoundary(competence, tenant.billingDueDay, contractDate, tenant.timezone),
      })),
      skipDuplicates: true,
    });
    if (result.count) {
      await this.db.billingAudit.create({
        data: {
          tenantId: tenant.id,
          action: "COMPETENCY_CREATED",
          payload: { count: result.count, through: currentDate.slice(0, 7), source: "SERVER" },
        },
      });
    }
    return result.count;
  }

  async refreshTenantState(tenantId: string, now = new Date()) {
    const tenant = await this.db.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true, status: true, suspensionReason: true, monthlyFeeCents: true,
        billingDueDay: true, billingStartedAt: true, timezone: true,
      },
    });
    if (!tenant) throw new NotFoundException("Estabelecimento não encontrado");
    await this.generateForTenant(tenant, now);
    const overdue = tenant.monthlyFeeCents > 0 && await this.db.monthlyFee.count({
      where: { tenantId, status: "PENDING", overdueAt: { lte: now } },
    }) > 0;

    if (overdue && tenant.status === "ACTIVE") {
      const changed = await this.db.tenant.updateMany({
        where: { id: tenantId, status: "ACTIVE" },
        data: { status: "SUSPENDED", suspensionReason: "BILLING" },
      });
      if (changed.count) await this.db.billingAudit.create({
        data: { tenantId, action: "AUTO_SUSPENDED", payload: { checkedAt: now.toISOString(), source: "SERVER" } },
      });
    } else if (!overdue && tenant.status === "SUSPENDED" && tenant.suspensionReason === "BILLING") {
      const changed = await this.db.tenant.updateMany({
        where: { id: tenantId, status: "SUSPENDED", suspensionReason: "BILLING" },
        data: { status: "ACTIVE", suspensionReason: null },
      });
      if (changed.count) await this.db.billingAudit.create({
        data: { tenantId, action: "AUTO_REACTIVATED", payload: { checkedAt: now.toISOString(), source: "SERVER" } },
      });
    }
    return { overdue, operational: !overdue && !(tenant.status === "SUSPENDED" && tenant.suspensionReason !== "BILLING") };
  }

  async runDaily(now = new Date()) {
    const tenants = await this.db.tenant.findMany({ select: { id: true } });
    let suspended = 0;
    let overdue = 0;
    for (const tenant of tenants) {
      const before = await this.db.tenant.findUnique({ where: { id: tenant.id }, select: { status: true } });
      const result = await this.refreshTenantState(tenant.id, now);
      if (result.overdue) overdue++;
      if (before?.status === "ACTIVE" && result.overdue) suspended++;
    }
    return { checkedAt: now.toISOString(), tenants: tenants.length, overdue, suspended };
  }

  async configure(tenantId: string, actorUserId: string, dto: BillingConfigDto) {
    const startedAt = new Date(dto.billingStartedAt);
    const previous = await this.db.tenant.findUnique({
      where: { id: tenantId },
      select: { monthlyFeeCents: true, billingDueDay: true, billingStartedAt: true, timezone: true },
    });
    if (!previous) throw new NotFoundException("Estabelecimento não encontrado");
    // Competências emitidas são imutáveis: alterar vencimento ou início afetaria
    // apenas novos registros e deixaria o contrato inconsistente.
    const issued = await this.db.monthlyFee.count({ where: { tenantId } });
    const sameContractDate = localParts(startedAt, previous.timezone).date ===
      localParts(previous.billingStartedAt, previous.timezone).date;
    if (issued && (dto.billingDueDay !== previous.billingDueDay || !sameContractDate)) {
      throw new BadRequestException("Vencimento e início contratual não podem mudar após a emissão de mensalidades");
    }
    // O formulário envia apenas o dia; não substituir a hora original do contrato
    // ao alterar exclusivamente o valor mensal.
    const effectiveStart = issued ? previous.billingStartedAt : startedAt;
    const tenant = await this.db.$transaction(async tx => {
      const updated = await tx.tenant.update({
        where: { id: tenantId },
        data: { monthlyFeeCents: dto.monthlyFeeCents, billingDueDay: dto.billingDueDay, billingStartedAt: effectiveStart },
        select: { id: true, name: true, monthlyFeeCents: true, billingDueDay: true, billingStartedAt: true },
      });
      await tx.billingAudit.create({
        data: {
          tenantId, actorUserId, action: "CONFIG_UPDATED",
          payload: {
            before: { ...previous, billingStartedAt: previous.billingStartedAt.toISOString() },
            after: { monthlyFeeCents: dto.monthlyFeeCents, billingDueDay: dto.billingDueDay, billingStartedAt: effectiveStart.toISOString() },
          },
        },
      });
      return updated;
    });
    await this.refreshTenantState(tenantId);
    return tenant;
  }

  async markPaid(monthlyFeeId: string, actorUserId: string) {
    const fee = await this.db.monthlyFee.findUnique({ where: { id: monthlyFeeId } });
    if (!fee) throw new NotFoundException("Mensalidade não encontrada");
    const paidAt = new Date();
    await this.db.$transaction(async tx => {
      // A condição no UPDATE é a fronteira de concorrência; apenas um operador
      // pode converter PENDING em PAID e criar o evento de auditoria.
      const changed = await tx.monthlyFee.updateMany({
        where: { id: monthlyFeeId, status: "PENDING" },
        data: { status: "PAID", paidAt, confirmedById: actorUserId },
      });
      if (changed.count) {
        await tx.billingAudit.create({
          data: {
            tenantId: fee.tenantId, monthlyFeeId, actorUserId, action: "PAYMENT_CONFIRMED",
            payload: { paidAt: paidAt.toISOString(), amountCents: fee.amountCents },
          },
        });
      }
    });
    await this.refreshTenantState(fee.tenantId);
    return this.db.monthlyFee.findUniqueOrThrow({
      where: { id: monthlyFeeId },
      include: { confirmedBy: { select: { id: true, name: true, email: true } } },
    });
  }

  async systemOverview() {
    const now = new Date();
    const tenants = await this.db.tenant.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true, name: true, status: true, suspensionReason: true, monthlyFeeCents: true,
        billingDueDay: true, billingStartedAt: true,
        monthlyFees: {
          orderBy: { competence: "desc" }, take: 24,
          include: { confirmedBy: { select: { id: true, name: true } } },
        },
        billingAuditEvents: {
          orderBy: { createdAt: "desc" }, take: 30,
          include: { actor: { select: { id: true, name: true } } },
        },
      },
    });
    const [pending, overdue] = await Promise.all([
      this.db.monthlyFee.groupBy({
        by: ["tenantId"], where: { status: "PENDING" }, _count: { _all: true },
      }),
      this.db.monthlyFee.groupBy({
        by: ["tenantId"], where: { status: "PENDING", overdueAt: { lte: now } },
        _count: { _all: true },
      }),
    ]);
    const pendingByTenant = new Map(pending.map(row => [row.tenantId, row._count._all]));
    const overdueByTenant = new Map(overdue.map(row => [row.tenantId, row._count._all]));
    return tenants.map(tenant => ({
      ...tenant,
      pendingCount: pendingByTenant.get(tenant.id) ?? 0,
      overdueCount: overdueByTenant.get(tenant.id) ?? 0,
    }));
  }

  async tenantSummary(tenantId: string, actorUserId: string) {
    const membership = await this.db.membership.findUnique({
      where: { userId_tenantId: { userId: actorUserId, tenantId } },
      select: { isActive: true, role: true },
    });
    if (!membership?.isActive || !["ADMIN", "EMPLOYEE"].includes(membership.role)) throw new ForbiddenException();
    await this.refreshTenantState(tenantId);
    const now = new Date();
    const tenant = await this.db.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: {
        id: true, name: true, status: true, suspensionReason: true, monthlyFeeCents: true,
        billingDueDay: true, billingStartedAt: true,
        monthlyFees: { orderBy: { competence: "desc" }, take: 24 },
      },
    });
    const [pendingCount, overdueCount] = await Promise.all([
      this.db.monthlyFee.count({ where: { tenantId, status: "PENDING" } }),
      this.db.monthlyFee.count({ where: { tenantId, status: "PENDING", overdueAt: { lte: now } } }),
    ]);
    return { ...tenant, pendingCount, overdueCount };
  }
}

@Injectable()
export class BillingSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BillingSchedulerService.name);
  private timer?: NodeJS.Timeout;
  constructor(private readonly billing: BillingService) {}

  onModuleInit() { this.schedule(5_000); }
  onModuleDestroy() { if (this.timer) clearTimeout(this.timer); }

  private schedule(delay?: number) {
    const now = new Date();
    const today = localParts(now, BILLING_ZONE).date;
    let next = localToUtc(today, 5, BILLING_ZONE) ?? new Date(now.getTime() + 86_400_000);
    if (next <= now) next = localToUtc(addDays(today, 1), 5, BILLING_ZONE) ?? new Date(now.getTime() + 86_400_000);
    this.timer = setTimeout(() => void this.execute(), delay ?? Math.max(1_000, next.getTime() - now.getTime()));
    this.timer.unref();
  }

  private async execute() {
    try {
      const result = await this.billing.runDaily();
      this.logger.log(`Mensalidades verificadas: ${result.tenants}; em atraso: ${result.overdue}`);
    } catch (error) {
      this.logger.error("Falha na rotina diária de mensalidades", error instanceof Error ? error.stack : String(error));
    } finally { this.schedule(); }
  }
}

@Controller()
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @UseGuards(JwtAuthGuard, SystemGuard) @Get("system/billing")
  systemOverview() { return this.billing.systemOverview(); }

  @UseGuards(JwtAuthGuard, SystemGuard) @Patch("system/tenants/:tenantId/billing")
  configure(@Param("tenantId") tenantId: string, @Req() req: { user: { id: string } }, @Body() dto: BillingConfigDto) {
    return this.billing.configure(tenantId, req.user.id, dto);
  }

  @UseGuards(JwtAuthGuard, SystemGuard) @Patch("system/billing/:monthlyFeeId/paid")
  markPaid(@Param("monthlyFeeId") monthlyFeeId: string, @Req() req: { user: { id: string } }) {
    return this.billing.markPaid(monthlyFeeId, req.user.id);
  }

  @UseGuards(JwtAuthGuard, SystemGuard) @Post("system/billing/run")
  run() { return this.billing.runDaily(); }

  @UseGuards(JwtAuthGuard) @Get("tenants/:tenantId/billing")
  tenant(@Param("tenantId") tenantId: string, @Req() req: { user: { id: string } }) {
    return this.billing.tenantSummary(tenantId, req.user.id);
  }
}
