import {
  BadRequestException, Body, ConflictException, Controller, Get, Injectable, Param,
  Patch, Post, Query, Req, Res, UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { Type } from "class-transformer";
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsString,
  Max, MaxLength, Min, MinLength, ValidateNested,
} from "class-validator";
import { JwtAuthGuard } from "./auth";
import { PrismaService } from "./prisma.service";
import { TenantRoleGuard, TenantRoles } from "./tenant-role.guard";

const paymentMethods = ["CASH", "PIX", "DEBIT_CARD", "CREDIT_CARD", "OTHER"] as const;

export function looksLikeCardNumber(value: string) {
  const digits = value.replace(/[\s-]/g, "");
  if (!/^\d{13,19}$/.test(digits)) return false;
  let sum = 0;
  let double = false;
  for (let index = digits.length - 1; index >= 0; index--) {
    let digit = Number(digits[index]);
    if (double) { digit *= 2; if (digit > 9) digit -= 9; }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

export class OpenCashSessionDto {
  @Type(() => Number) @IsInt() @Min(0) @Max(100_000_000) openingBalanceCents!: number;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class CashMovementDto {
  @IsIn(["WITHDRAWAL", "SUPPLY"]) type!: "WITHDRAWAL" | "SUPPLY";
  @Type(() => Number) @IsInt() @Min(1) @Max(100_000_000) amountCents!: number;
  @IsString() @MinLength(3) @MaxLength(300) reason!: string;
}

export class CloseCashSessionDto {
  @Type(() => Number) @IsInt() @Min(0) @Max(100_000_000) countedBalanceCents!: number;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class PaymentPartDto {
  @IsIn(paymentMethods) method!: typeof paymentMethods[number];
  @Type(() => Number) @IsInt() @Min(1) @Max(100_000_000) amountCents!: number;
  @IsOptional() @IsString() @MaxLength(120) reference?: string;
}

export class ReceivePaymentDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => PaymentPartDto)
  parts!: PaymentPartDto[];
}

export class VoidPaymentDto {
  @IsString() @MinLength(3) @MaxLength(300) reason!: string;
}

export class CashHistoryQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) take?: number;
}

@Injectable()
export class CashService {
  constructor(private readonly db: PrismaService) {}

  private sessionInclude() {
    return {
      openedBy: { select: { id: true, name: true } },
      closedBy: { select: { id: true, name: true } },
      movements: {
        orderBy: { createdAt: "desc" as const },
        include: {
          actor: { select: { id: true, name: true } },
          payment: { select: { id: true, method: true, status: true, serviceOrderId: true } },
        },
      },
    };
  }

  current(tenantId: string) {
    return this.db.cashSession.findFirst({
      where: { tenantId, status: "OPEN" }, include: this.sessionInclude(),
    });
  }

  history(tenantId: string, query: CashHistoryQueryDto = {}) {
    return this.db.cashSession.findMany({
      where: { tenantId },
      include: { openedBy: { select: { name: true } }, closedBy: { select: { name: true } } },
      orderBy: { openedAt: "desc" }, take: query.take ?? 30,
    });
  }

  async detail(tenantId: string, id: string) {
    const session = await this.db.cashSession.findFirst({
      where: { id, tenantId }, include: this.sessionInclude(),
    });
    if (!session) throw new BadRequestException("Caixa nao encontrado");
    return session;
  }

  async open(tenantId: string, actorUserId: string, dto: OpenCashSessionDto) {
    try {
      const session = await this.db.$transaction(async tx => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${tenantId + ":cash"}, 0))::text`;
        const existing = await tx.cashSession.findFirst({ where: { tenantId, status: "OPEN" } });
        if (existing) throw new ConflictException("Ja existe um caixa aberto");
        const created = await tx.cashSession.create({ data: {
          tenantId, openedById: actorUserId, openingBalanceCents: dto.openingBalanceCents,
          expectedBalanceCents: dto.openingBalanceCents, openingNotes: dto.notes?.trim() || undefined,
        } });
        if (dto.openingBalanceCents > 0) await tx.cashMovement.create({ data: {
          tenantId, cashSessionId: created.id, actorUserId, type: "OPENING_BALANCE",
          amountCents: dto.openingBalanceCents, reason: "Saldo inicial",
        } });
        return created;
      });
      return this.detail(tenantId, session.id);
    } catch (error) {
      const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
      if (code === "P2002" || code === "23505") throw new ConflictException("Ja existe um caixa aberto");
      throw error;
    }
  }

  async movement(tenantId: string, actorUserId: string, dto: CashMovementDto) {
    const sessionId = await this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${tenantId + ":cash"}, 0))::text`;
      const session = await tx.cashSession.findFirst({ where: { tenantId, status: "OPEN" } });
      if (!session) throw new ConflictException("Abra o caixa antes de registrar movimentos");
      const delta = dto.type === "SUPPLY" ? dto.amountCents : -dto.amountCents;
      if (session.expectedBalanceCents + delta < 0) throw new ConflictException("Saldo em dinheiro insuficiente para a sangria");
      await tx.cashSession.update({ where: { id: session.id }, data: {
        expectedBalanceCents: { increment: delta },
      } });
      await tx.cashMovement.create({ data: {
        tenantId, cashSessionId: session.id, actorUserId, type: dto.type,
        amountCents: dto.amountCents, reason: dto.reason.trim(),
      } });
      return session.id;
    });
    return this.detail(tenantId, sessionId);
  }

  async close(tenantId: string, actorUserId: string, dto: CloseCashSessionDto) {
    const sessionId = await this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${tenantId + ":cash"}, 0))::text`;
      const session = await tx.cashSession.findFirst({ where: { tenantId, status: "OPEN" } });
      if (!session) throw new ConflictException("Nenhum caixa aberto");
      await tx.cashSession.update({ where: { id: session.id }, data: {
        status: "CLOSED", closedById: actorUserId, closedAt: new Date(),
        countedBalanceCents: dto.countedBalanceCents,
        differenceCents: dto.countedBalanceCents - session.expectedBalanceCents,
        closingNotes: dto.notes?.trim() || undefined,
      } });
      return session.id;
    });
    return this.detail(tenantId, sessionId);
  }

  async paymentSummary(tenantId: string, serviceOrderId: string) {
    const order = await this.db.serviceOrder.findFirst({
      where: { id: serviceOrderId, tenantId }, select: { id: true, totalCents: true },
    });
    if (!order) throw new BadRequestException("Comanda nao encontrada");
    const payments = await this.db.payment.findMany({
      where: { tenantId, serviceOrderId },
      include: {
        receivedBy: { select: { name: true } }, voidedBy: { select: { name: true } },
      }, orderBy: { createdAt: "asc" },
    });
    const paidCents = payments.filter(item => item.status === "CONFIRMED")
      .reduce((total, item) => total + item.amountCents, 0);
    return { totalCents: order.totalCents, paidCents,
      remainingCents: Math.max(0, order.totalCents - paidCents), payments };
  }

  async receive(tenantId: string, serviceOrderId: string, actorUserId: string, dto: ReceivePaymentDto) {
    if (dto.parts.some(part => part.reference && looksLikeCardNumber(part.reference))) {
      throw new BadRequestException("Nao informe numero de cartao na referencia");
    }
    await this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${tenantId + ":cash"}, 0))::text`;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${tenantId + ":payment:" + serviceOrderId}, 0))::text`;
      const [session, order, aggregate] = await Promise.all([
        tx.cashSession.findFirst({ where: { tenantId, status: "OPEN" } }),
        tx.serviceOrder.findFirst({ where: { id: serviceOrderId, tenantId, status: "CLOSED" } }),
        tx.payment.aggregate({ where: { tenantId, serviceOrderId, status: "CONFIRMED" }, _sum: { amountCents: true } }),
      ]);
      if (!session) throw new ConflictException("Abra o caixa antes de receber");
      if (!order) throw new ConflictException("A comanda deve estar encerrada para receber");
      const newTotal = dto.parts.reduce((total, part) => total + part.amountCents, 0);
      const paid = aggregate._sum.amountCents ?? 0;
      if (paid + newTotal > order.totalCents) throw new BadRequestException("Registro maior que o saldo da comanda");
      let cashIncrement = 0;
      for (const part of dto.parts) {
        const payment = await tx.payment.create({ data: {
          tenantId, serviceOrderId, cashSessionId: session.id, receivedById: actorUserId,
          method: part.method, amountCents: part.amountCents, reference: part.reference?.trim() || undefined,
        } });
        await tx.cashMovement.create({ data: {
          tenantId, cashSessionId: session.id, paymentId: payment.id, actorUserId,
          type: "PAYMENT", amountCents: part.amountCents,
          reason: `Pagamento presencial registrado: ${part.method}`,
        } });
        if (part.method === "CASH") cashIncrement += part.amountCents;
      }
      if (cashIncrement) await tx.cashSession.update({ where: { id: session.id }, data: {
        expectedBalanceCents: { increment: cashIncrement },
      } });
    });
    return this.paymentSummary(tenantId, serviceOrderId);
  }

  async voidPayment(tenantId: string, paymentId: string, actorUserId: string, dto: VoidPaymentDto) {
    let serviceOrderId = "";
    await this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${tenantId + ":cash"}, 0))::text`;
      const session = await tx.cashSession.findFirst({ where: { tenantId, status: "OPEN" } });
      const payment = await tx.payment.findFirst({ where: { id: paymentId, tenantId, status: "CONFIRMED" } });
      if (!session) throw new ConflictException("Abra o caixa para registrar o estorno");
      if (!payment) throw new ConflictException("Registro de pagamento nao pode ser estornado");
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${tenantId + ":payment:" + payment.serviceOrderId}, 0))::text`;
      if (payment.method === "CASH" && session.expectedBalanceCents < payment.amountCents) {
        throw new ConflictException("Saldo em dinheiro insuficiente para o estorno");
      }
      await tx.payment.update({ where: { id: payment.id }, data: {
        status: "VOIDED", voidedById: actorUserId, voidedAt: new Date(), voidReason: dto.reason.trim(),
      } });
      await tx.cashMovement.create({ data: {
        tenantId, cashSessionId: session.id, paymentId: payment.id, actorUserId,
        type: "REFUND", amountCents: payment.amountCents, reason: dto.reason.trim(),
      } });
      if (payment.method === "CASH") await tx.cashSession.update({ where: { id: session.id }, data: {
        expectedBalanceCents: { decrement: payment.amountCents },
      } });
      serviceOrderId = payment.serviceOrderId;
    });
    return this.paymentSummary(tenantId, serviceOrderId);
  }
}

@Controller("tenants/:tenantId")
@UseGuards(JwtAuthGuard, TenantRoleGuard)
export class CashController {
  constructor(private readonly cash: CashService) {}

  @TenantRoles("ADMIN", "EMPLOYEE") @Get("cash-sessions/current")
  async current(@Param("tenantId") tenantId: string, @Res() response: Response) {
    response.json(await this.cash.current(tenantId));
  }

  @TenantRoles("ADMIN", "EMPLOYEE") @Get("cash-sessions")
  history(@Param("tenantId") tenantId: string, @Query() query: CashHistoryQueryDto) {
    return this.cash.history(tenantId, query);
  }

  @TenantRoles("ADMIN", "EMPLOYEE") @Get("cash-sessions/:id")
  detail(@Param("tenantId") tenantId: string, @Param("id") id: string) {
    return this.cash.detail(tenantId, id);
  }

  @TenantRoles("ADMIN", "EMPLOYEE") @Post("cash-sessions/open")
  open(@Param("tenantId") tenantId: string, @Req() req: { user: { id: string } },
    @Body() dto: OpenCashSessionDto) {
    return this.cash.open(tenantId, req.user.id, dto);
  }

  @TenantRoles("ADMIN") @Post("cash-sessions/current/movements")
  movement(@Param("tenantId") tenantId: string, @Req() req: { user: { id: string } },
    @Body() dto: CashMovementDto) {
    return this.cash.movement(tenantId, req.user.id, dto);
  }

  @TenantRoles("ADMIN") @Patch("cash-sessions/current/close")
  close(@Param("tenantId") tenantId: string, @Req() req: { user: { id: string } },
    @Body() dto: CloseCashSessionDto) {
    return this.cash.close(tenantId, req.user.id, dto);
  }

  @TenantRoles("ADMIN", "EMPLOYEE") @Get("service-orders/:id/payments")
  payments(@Param("tenantId") tenantId: string, @Param("id") id: string) {
    return this.cash.paymentSummary(tenantId, id);
  }

  @TenantRoles("ADMIN", "EMPLOYEE") @Post("service-orders/:id/payments")
  receive(@Param("tenantId") tenantId: string, @Param("id") id: string,
    @Req() req: { user: { id: string } }, @Body() dto: ReceivePaymentDto) {
    return this.cash.receive(tenantId, id, req.user.id, dto);
  }

  @TenantRoles("ADMIN") @Patch("payments/:id/void")
  voidPayment(@Param("tenantId") tenantId: string, @Param("id") id: string,
    @Req() req: { user: { id: string } }, @Body() dto: VoidPaymentDto) {
    return this.cash.voidPayment(tenantId, id, req.user.id, dto);
  }
}
