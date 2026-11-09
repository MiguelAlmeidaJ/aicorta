import "reflect-metadata";
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { BadRequestException, ConflictException } from "@nestjs/common";
import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import { CashService, looksLikeCardNumber, ReceivePaymentDto } from "./cash";

test("split payment DTO validates every payment part", async () => {
  const dto = plainToInstance(ReceivePaymentDto, { parts: [
    { method: "PIX", amountCents: 2000 }, { method: "INVALID", amountCents: 0 },
  ] });
  assert.ok((await validate(dto)).length > 0);
});

test("payment references reject card numbers but allow transaction identifiers", () => {
  assert.equal(looksLikeCardNumber("4111 1111 1111 1111"), true);
  assert.equal(looksLikeCardNumber("pix-e2e-123456"), false);
});

test("opening cash is tenant-scoped and records the opening balance", async () => {
  let sessionData: unknown;
  let movementData: unknown;
  const tx = {
    $queryRaw: async () => undefined,
    cashSession: {
      findFirst: async () => null,
      create: async (args: { data: unknown }) => { sessionData = args.data; return { id: "cash-a" }; },
    },
    cashMovement: { create: async (args: { data: unknown }) => { movementData = args.data; } },
  };
  const db = {
    $transaction: async (fn: (client: typeof tx) => Promise<{ id: string }>) => fn(tx),
    cashSession: { findFirst: async () => ({ id: "cash-a", status: "OPEN" }) },
  };
  const service = new CashService(db as never);
  await service.open("tenant-a", "actor-a", { openingBalanceCents: 10000, notes: "Inicio" });
  assert.deepEqual(sessionData, {
    tenantId: "tenant-a", openedById: "actor-a", openingBalanceCents: 10000,
    expectedBalanceCents: 10000, openingNotes: "Inicio",
  });
  assert.deepEqual(movementData, {
    tenantId: "tenant-a", cashSessionId: "cash-a", actorUserId: "actor-a",
    type: "OPENING_BALANCE", amountCents: 10000, reason: "Saldo inicial",
  });
});

test("withdrawal cannot make the expected cash balance negative", async () => {
  const tx = {
    $queryRaw: async () => undefined,
    cashSession: { findFirst: async () => ({ id: "cash", expectedBalanceCents: 500 }) },
  };
  const db = { $transaction: async (fn: (client: typeof tx) => Promise<string>) => fn(tx) };
  const service = new CashService(db as never);
  await assert.rejects(() => service.movement("tenant", "actor", {
    type: "WITHDRAWAL", amountCents: 501, reason: "Sangria teste",
  }), ConflictException);
});

test("payments cannot exceed the unpaid service-order total", async () => {
  const tx = {
    $queryRaw: async () => undefined,
    cashSession: { findFirst: async () => ({ id: "cash" }) },
    serviceOrder: { findFirst: async () => ({ id: "order", totalCents: 5000 }) },
    payment: { aggregate: async () => ({ _sum: { amountCents: 4500 } }) },
  };
  const db = { $transaction: async (fn: (client: typeof tx) => Promise<void>) => fn(tx) };
  const service = new CashService(db as never);
  await assert.rejects(() => service.receive("tenant", "order", "actor", {
    parts: [{ method: "PIX", amountCents: 501 }],
  }), BadRequestException);
});
