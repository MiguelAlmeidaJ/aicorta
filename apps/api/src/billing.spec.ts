import { strict as assert } from "node:assert";
import { test } from "node:test";
import { validate } from "class-validator";
import { BillingConfigDto, lastDayOfMonth, monthlyDueBoundary } from "./billing";

test("vencimentos 29, 30 e 31 são limitados ao último dia do mês", () => {
  assert.equal(lastDayOfMonth(2027, 2), 28);
  assert.equal(lastDayOfMonth(2028, 2), 29);
  const result = monthlyDueBoundary("2027-02", 31, "2027-01-10");
  assert.equal(result.dueOn, "2027-02-28");
  assert.equal(result.overdueAt.toISOString(), "2027-03-01T03:00:00.000Z");
});

test("primeira competência nunca vence antes da contratação", () => {
  const result = monthlyDueBoundary("2026-11", 5, "2026-11-20");
  assert.equal(result.dueOn, "2026-11-20");
  assert.equal(result.overdueAt.toISOString(), "2026-11-21T03:00:00.000Z");
});

test("configuração aceita valor zero e rejeita vencimento fora de 1 a 31", async () => {
  const dto = Object.assign(new BillingConfigDto(), {
    monthlyFeeCents: 0, billingDueDay: 32, billingStartedAt: "2026-11-09T12:00:00-03:00",
  });
  assert.ok((await validate(dto)).some(error => error.property === "billingDueDay"));
  dto.billingDueDay = 31;
  assert.equal((await validate(dto)).length, 0);
});

// A confirmação e os relatórios devem permanecer corretos com concorrência e histórico extenso.
import { BillingService } from "./billing";

test("marcar pago em paralelo grava uma única confirmação", async () => {
  let status = "PENDING";
  let auditCount = 0;
  const db = {
    monthlyFee: {
      findUnique: async () => ({ id: "fee-1", tenantId: "tenant-1", status, amountCents: 1000 }),
      findUniqueOrThrow: async () => ({ id: "fee-1", status }),
      updateMany: async () => { if (status !== "PENDING") return { count: 0 }; status = "PAID"; return { count: 1 }; },
    },
    billingAudit: { create: async () => { auditCount++; } },
    $transaction: async (cb: (tx: unknown) => Promise<void>) => cb(db),
  };
  const billing = new BillingService(db as never);
  billing.refreshTenantState = async () => ({ overdue: false, operational: true });
  await Promise.all([billing.markPaid("fee-1", "system-1"), billing.markPaid("fee-1", "system-2")]);
  assert.equal(auditCount, 1);
  assert.equal(status, "PAID");
});
