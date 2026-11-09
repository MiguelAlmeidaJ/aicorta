import "reflect-metadata";
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { BadRequestException, ConflictException } from "@nestjs/common";
import { validate } from "class-validator";
import {
  AddServiceOrderItemDto, ApplyDiscountDto, ServiceOrderService,
} from "./service-orders";

test("service order item and discount DTOs reject invalid money and quantities", async () => {
  const item = new AddServiceOrderItemDto();
  item.description = "Adicional";
  item.quantity = 0;
  item.unitPriceCents = -1;
  assert.ok((await validate(item)).length >= 2);

  const discount = new ApplyDiscountDto();
  discount.discountCents = 100;
  discount.reason = "x";
  assert.ok((await validate(discount)).length > 0);
});

test("starting a service order is tenant-scoped and records an immutable event", async () => {
  const calls: { where?: unknown; event?: unknown } = {};
  const tx = {
    $queryRaw: async () => undefined,
    serviceOrder: {
      updateMany: async (args: { where: unknown }) => { calls.where = args.where; return { count: 1 }; },
      findFirst: async () => ({ id: "order", status: "IN_PROGRESS" }),
    },
    serviceOrderEvent: { create: async (args: { data: unknown }) => { calls.event = args.data; } },
  };
  const db = {
    membership: { findUniqueOrThrow: async () => ({ id: "member-admin", role: "ADMIN" }) },
    $transaction: async (fn: (client: typeof tx) => Promise<void>) => fn(tx),
    serviceOrder: { findFirst: async () => ({ id: "order", status: "IN_PROGRESS" }) },
  };
  const service = new ServiceOrderService(db as never);
  await service.start("tenant-a", "order-a", "actor-a");
  assert.deepEqual(calls.where, { id: "order-a", tenantId: "tenant-a", status: "CHECKED_IN" });
  assert.deepEqual(calls.event, {
    serviceOrderId: "order-a", tenantId: "tenant-a", actorUserId: "actor-a", type: "STARTED",
  });
});

test("starting an order in an invalid state is rejected", async () => {
  const tx = {
    $queryRaw: async () => undefined,
    serviceOrder: { updateMany: async () => ({ count: 0 }) },
    serviceOrderEvent: { create: async () => undefined },
  };
  const db = { membership: { findUniqueOrThrow: async () => ({ id: "member-admin", role: "ADMIN" }) }, $transaction: async (fn: (client: typeof tx) => Promise<void>) => fn(tx) };
  const service = new ServiceOrderService(db as never);
  await assert.rejects(() => service.start("tenant", "order", "actor"), ConflictException);
});

test("discount cannot exceed the order subtotal", async () => {
  const tx = {
    $queryRaw: async () => undefined,
    serviceOrder: {
      findFirst: async () => ({ id: "order", subtotalCents: 5000 }),
      update: async () => undefined,
    },
    serviceOrderEvent: { create: async () => undefined },
  };
  const db = { membership: { findUniqueOrThrow: async () => ({ id: "member-admin", role: "ADMIN" }) }, $transaction: async (fn: (client: typeof tx) => Promise<void>) => fn(tx) };
  const service = new ServiceOrderService(db as never);
  await assert.rejects(() => service.applyDiscount("tenant", "order", "actor", {
    discountCents: 5001, reason: "Desconto de teste",
  }), BadRequestException);
});

test("closing an already closed order is idempotent", async () => {
  let appointmentWrites = 0;
  const tx = {
    $queryRaw: async () => undefined,
    serviceOrder: { findFirst: async () => ({ id: "order", status: "CLOSED" }) },
    appointment: { updateMany: async () => { appointmentWrites++; return { count: 1 }; } },
  };
  const db = {
    membership: { findUniqueOrThrow: async () => ({ id: "member-admin", role: "ADMIN" }) },
    $transaction: async (fn: (client: typeof tx) => Promise<void>) => fn(tx),
    serviceOrder: { findFirst: async () => ({ id: "order", status: "CLOSED" }) },
  };
  const service = new ServiceOrderService(db as never);
  const result = await service.close("tenant", "order", "actor") as { status: string };
  assert.equal(result.status, "CLOSED");
  assert.equal(appointmentWrites, 0);
});

test("funcionário não pode alterar comanda de outro profissional", async () => {
  const db = {
    membership: { findUniqueOrThrow: async () => ({ id: "member-a", role: "EMPLOYEE" }) },
    serviceOrder: { count: async () => 0 },
  };
  const service = new ServiceOrderService(db as never);
  await assert.rejects(() => service.start("tenant", "order-other", "employee"), {
    name: "ForbiddenException",
  });
});
