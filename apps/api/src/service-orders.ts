import {
  BadRequestException, Body, ConflictException, Controller, Delete, Get, Injectable,
  Param, Patch, Post, Query, Req, UseGuards,
} from "@nestjs/common";
import { Type } from "class-transformer";
import {
  IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength,
} from "class-validator";
import { JwtAuthGuard } from "./auth";
import { PrismaService } from "./prisma.service";
import { TenantRoleGuard, TenantRoles } from "./tenant-role.guard";

const openStatuses = ["CHECKED_IN", "IN_PROGRESS"] as const;

export class ServiceOrderQueryDto {
  @IsOptional() @IsIn(["CHECKED_IN", "IN_PROGRESS", "CLOSED", "CANCELLED"])
  status?: "CHECKED_IN" | "IN_PROGRESS" | "CLOSED" | "CANCELLED";
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) take?: number;
}

export class AddServiceOrderItemDto {
  @IsOptional() @IsUUID() serviceId?: string;
  @IsString() @MinLength(2) @MaxLength(120) description!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(99) quantity!: number;
  @Type(() => Number) @IsInt() @Min(0) @Max(100_000_000) unitPriceCents!: number;
}

export class ApplyDiscountDto {
  @Type(() => Number) @IsInt() @Min(0) @Max(100_000_000) discountCents!: number;
  @IsString() @MinLength(3) @MaxLength(300) reason!: string;
}

@Injectable()
export class ServiceOrderService {
  constructor(private readonly db: PrismaService) {}

  private detailWhere(tenantId: string, id: string) {
    return { id, tenantId };
  }

  private includeDetail() {
    return {
      appointment: { select: { id: true, startsAt: true, endsAt: true, status: true } },
      client: { select: { id: true, name: true } },
      employee: { select: { id: true, user: { select: { name: true } } } },
      items: { orderBy: { createdAt: "asc" as const } },
      events: {
        orderBy: { createdAt: "asc" as const },
        include: { actor: { select: { id: true, name: true } } },
      },
    };
  }

  list(tenantId: string, query: ServiceOrderQueryDto = {}) {
    return this.db.serviceOrder.findMany({
      where: { tenantId, ...(query.status && { status: query.status }) },
      include: {
        client: { select: { id: true, name: true } },
        employee: { select: { id: true, user: { select: { name: true } } } },
        appointment: { select: { startsAt: true } },
        items: { select: { id: true } },
      },
      orderBy: { checkedInAt: "desc" },
      take: query.take ?? 100,
    });
  }

  async detail(tenantId: string, id: string) {
    const order = await this.db.serviceOrder.findFirst({
      where: this.detailWhere(tenantId, id), include: this.includeDetail(),
    });
    if (!order) throw new BadRequestException("Comanda nao encontrada");
    return order;
  }

  async checkIn(tenantId: string, appointmentId: string, actorUserId: string) {
    const existing = await this.db.serviceOrder.findFirst({
      where: { tenantId, appointmentId }, include: this.includeDetail(),
    });
    if (existing) return existing;
    try {
      const created = await this.db.$transaction(async tx => {
        const appointment = await tx.appointment.findFirst({
          where: { id: appointmentId, tenantId, status: "CONFIRMED" },
          include: {
            service: { select: { id: true, name: true, priceCents: true } },
            services: { include: { service: { select: { id: true, name: true, priceCents: true } } } },
          },
        });
        if (!appointment) throw new ConflictException("Reserva deve estar confirmada para o check-in");
        if (appointment.startsAt.getTime() > Date.now() + 30 * 60_000) {
          throw new ConflictException("Check-in disponivel 30 minutos antes do horario");
        }
        const services = appointment.services.length
          ? appointment.services.map(row => ({ id: row.service.id,
            name: row.nameSnapshot ?? row.service.name,
            priceCents: row.priceCentsSnapshot ?? row.service.priceCents }))
          : [{ ...appointment.service, priceCents: appointment.priceCents }];
        const snapshotSum = services.reduce((total, service) => total + service.priceCents, 0);
        if (services.length && snapshotSum !== appointment.priceCents) {
          services[services.length - 1].priceCents += appointment.priceCents - snapshotSum;
        }
        const subtotalCents = appointment.priceCents;
        return tx.serviceOrder.create({
          data: {
            tenantId, appointmentId, employeeMembershipId: appointment.employeeMembershipId,
            clientId: appointment.clientId, createdById: actorUserId,
            subtotalCents, totalCents: subtotalCents,
            items: { create: services.map(service => ({
              serviceId: service.id, source: "APPOINTMENT" as const,
              description: service.name, quantity: 1, unitPriceCents: service.priceCents,
              totalCents: service.priceCents,
            })) },
            events: { create: { actorUserId, type: "CHECKED_IN" } },
          },
          select: { id: true },
        });
      });
      return this.detail(tenantId, created.id);
    } catch (error) {
      const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
      if (code === "P2002") return this.detailByAppointment(tenantId, appointmentId);
      throw error;
    }
  }

  private async detailByAppointment(tenantId: string, appointmentId: string) {
    const order = await this.db.serviceOrder.findFirst({
      where: { tenantId, appointmentId }, include: this.includeDetail(),
    });
    if (!order) throw new ConflictException("Check-in concorrente nao pode ser recuperado");
    return order;
  }

  async start(tenantId: string, id: string, actorUserId: string) {
    await this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${tenantId + ":service-order:" + id}, 0))::text`;
      const updated = await tx.serviceOrder.updateMany({
        where: { id, tenantId, status: "CHECKED_IN" },
        data: { status: "IN_PROGRESS", startedAt: new Date() },
      });
      if (!updated.count) throw new ConflictException("Comanda deve estar em check-in para iniciar");
      await tx.serviceOrderEvent.create({ data: {
        serviceOrderId: id, tenantId, actorUserId, type: "STARTED",
      } });
    });
    return this.detail(tenantId, id);
  }

  async addItem(tenantId: string, id: string, actorUserId: string, dto: AddServiceOrderItemDto) {
    await this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${tenantId + ":service-order:" + id}, 0))::text`;
      const order = await tx.serviceOrder.findFirst({ where: { id, tenantId, status: { in: [...openStatuses] } } });
      if (!order) throw new ConflictException("Comanda encerrada ou inexistente");
      if (dto.serviceId) {
        const service = await tx.service.findFirst({ where: { id: dto.serviceId, tenantId, isActive: true } });
        if (!service) throw new BadRequestException("Servico adicional invalido");
      }
      const totalCents = dto.quantity * dto.unitPriceCents;
      await tx.serviceOrderItem.create({ data: {
        serviceOrderId: id, tenantId, serviceId: dto.serviceId, source: "MANUAL",
        description: dto.description.trim(), quantity: dto.quantity,
        unitPriceCents: dto.unitPriceCents, totalCents,
      } });
      const subtotalCents = order.subtotalCents + totalCents;
      await tx.serviceOrder.update({ where: { id }, data: {
        subtotalCents, totalCents: Math.max(0, subtotalCents - order.discountCents),
      } });
      await tx.serviceOrderEvent.create({ data: {
        serviceOrderId: id, tenantId, actorUserId, type: "ITEM_ADDED",
        payload: { description: dto.description.trim(), quantity: dto.quantity,
          unitPriceCents: dto.unitPriceCents, totalCents },
      } });
    });
    return this.detail(tenantId, id);
  }

  async removeItem(tenantId: string, id: string, itemId: string, actorUserId: string) {
    await this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${tenantId + ":service-order:" + id}, 0))::text`;
      const order = await tx.serviceOrder.findFirst({ where: { id, tenantId, status: { in: [...openStatuses] } } });
      const item = await tx.serviceOrderItem.findFirst({ where: {
        id: itemId, serviceOrderId: id, tenantId, source: "MANUAL",
      } });
      if (!order || !item) throw new ConflictException("Item nao pode ser removido");
      const subtotalCents = order.subtotalCents - item.totalCents;
      if (order.discountCents > subtotalCents) {
        throw new ConflictException("Reduza o desconto antes de remover este item");
      }
      await tx.serviceOrderItem.delete({ where: { id: itemId } });
      await tx.serviceOrder.update({ where: { id }, data: {
        subtotalCents, totalCents: subtotalCents - order.discountCents,
      } });
      await tx.serviceOrderEvent.create({ data: {
        serviceOrderId: id, tenantId, actorUserId, type: "ITEM_REMOVED",
        payload: { itemId, description: item.description, totalCents: item.totalCents },
      } });
    });
    return this.detail(tenantId, id);
  }

  async applyDiscount(tenantId: string, id: string, actorUserId: string, dto: ApplyDiscountDto) {
    await this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${tenantId + ":service-order:" + id}, 0))::text`;
      const order = await tx.serviceOrder.findFirst({ where: { id, tenantId, status: { in: [...openStatuses] } } });
      if (!order) throw new ConflictException("Comanda encerrada ou inexistente");
      if (dto.discountCents > order.subtotalCents) throw new BadRequestException("Desconto maior que o subtotal");
      await tx.serviceOrder.update({ where: { id }, data: {
        discountCents: dto.discountCents, discountReason: dto.reason.trim(),
        totalCents: order.subtotalCents - dto.discountCents,
      } });
      await tx.serviceOrderEvent.create({ data: {
        serviceOrderId: id, tenantId, actorUserId, type: "DISCOUNT_APPLIED",
        payload: { discountCents: dto.discountCents, reason: dto.reason.trim() },
      } });
    });
    return this.detail(tenantId, id);
  }

  async close(tenantId: string, id: string, actorUserId: string) {
    await this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${tenantId + ":service-order:" + id}, 0))::text`;
      const order = await tx.serviceOrder.findFirst({ where: { id, tenantId } });
      if (order?.status === "CLOSED") return;
      if (!order || order.status !== "IN_PROGRESS") {
        throw new ConflictException("Inicie o atendimento antes de encerrar");
      }
      const totals = await tx.serviceOrderItem.aggregate({
        where: { serviceOrderId: id, tenantId }, _sum: { totalCents: true },
      });
      const subtotalCents = totals._sum.totalCents ?? 0;
      const discountCents = Math.min(order.discountCents, subtotalCents);
      const totalCents = subtotalCents - discountCents;
      const appointment = await tx.appointment.updateMany({
        where: { id: order.appointmentId, tenantId, status: "CONFIRMED" },
        data: { status: "COMPLETED" },
      });
      if (!appointment.count) throw new ConflictException("Reserva nao permite encerramento");
      await tx.serviceOrder.update({ where: { id }, data: {
        status: "CLOSED", closedAt: new Date(), subtotalCents, discountCents, totalCents,
      } });
      await tx.serviceOrderEvent.create({ data: {
        serviceOrderId: id, tenantId, actorUserId, type: "CLOSED",
        payload: { subtotalCents, discountCents, totalCents },
      } });
    });
    return this.detail(tenantId, id);
  }

  async cancel(tenantId: string, id: string, actorUserId: string) {
    await this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${tenantId + ":service-order:" + id}, 0))::text`;
      const order = await tx.serviceOrder.findFirst({ where: { id, tenantId, status: { in: [...openStatuses] } } });
      if (!order) throw new ConflictException("Comanda nao pode ser cancelada");
      const appointment = await tx.appointment.updateMany({
        where: { id: order.appointmentId, tenantId, status: "CONFIRMED" }, data: { status: "CANCELLED" },
      });
      if (!appointment.count) throw new ConflictException("Reserva nao permite cancelamento");
      await tx.serviceOrder.update({ where: { id }, data: { status: "CANCELLED", cancelledAt: new Date() } });
      await tx.serviceOrderEvent.create({ data: {
        serviceOrderId: id, tenantId, actorUserId, type: "CANCELLED",
      } });
    });
    return this.detail(tenantId, id);
  }
}

@Controller("tenants/:tenantId")
@UseGuards(JwtAuthGuard, TenantRoleGuard)
export class ServiceOrderController {
  constructor(private readonly orders: ServiceOrderService) {}

  @TenantRoles("ADMIN", "EMPLOYEE") @Get("service-orders")
  list(@Param("tenantId") tenantId: string, @Query() query: ServiceOrderQueryDto) {
    return this.orders.list(tenantId, query);
  }

  @TenantRoles("ADMIN", "EMPLOYEE") @Get("service-orders/:id")
  detail(@Param("tenantId") tenantId: string, @Param("id") id: string) {
    return this.orders.detail(tenantId, id);
  }

  @TenantRoles("ADMIN", "EMPLOYEE") @Post("appointments/:appointmentId/check-in")
  checkIn(@Param("tenantId") tenantId: string, @Param("appointmentId") appointmentId: string,
    @Req() req: { user: { id: string } }) {
    return this.orders.checkIn(tenantId, appointmentId, req.user.id);
  }

  @TenantRoles("ADMIN", "EMPLOYEE") @Patch("service-orders/:id/start")
  start(@Param("tenantId") tenantId: string, @Param("id") id: string,
    @Req() req: { user: { id: string } }) {
    return this.orders.start(tenantId, id, req.user.id);
  }

  @TenantRoles("ADMIN", "EMPLOYEE") @Post("service-orders/:id/items")
  addItem(@Param("tenantId") tenantId: string, @Param("id") id: string,
    @Req() req: { user: { id: string } }, @Body() dto: AddServiceOrderItemDto) {
    return this.orders.addItem(tenantId, id, req.user.id, dto);
  }

  @TenantRoles("ADMIN", "EMPLOYEE") @Delete("service-orders/:id/items/:itemId")
  removeItem(@Param("tenantId") tenantId: string, @Param("id") id: string,
    @Param("itemId") itemId: string, @Req() req: { user: { id: string } }) {
    return this.orders.removeItem(tenantId, id, itemId, req.user.id);
  }

  @TenantRoles("ADMIN") @Patch("service-orders/:id/discount")
  discount(@Param("tenantId") tenantId: string, @Param("id") id: string,
    @Req() req: { user: { id: string } }, @Body() dto: ApplyDiscountDto) {
    return this.orders.applyDiscount(tenantId, id, req.user.id, dto);
  }

  @TenantRoles("ADMIN", "EMPLOYEE") @Patch("service-orders/:id/close")
  close(@Param("tenantId") tenantId: string, @Param("id") id: string,
    @Req() req: { user: { id: string } }) {
    return this.orders.close(tenantId, id, req.user.id);
  }

  @TenantRoles("ADMIN") @Patch("service-orders/:id/cancel")
  cancel(@Param("tenantId") tenantId: string, @Param("id") id: string,
    @Req() req: { user: { id: string } }) {
    return this.orders.cancel(tenantId, id, req.user.id);
  }
}
