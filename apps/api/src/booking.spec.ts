import "reflect-metadata";
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { ConflictException } from "@nestjs/common";
import { BookingService, FinishAppointmentDto } from "./booking";
import { validate } from "class-validator";

test("finish DTO accepts only completed or no-show", async () => {
  const dto = new FinishAppointmentDto();
  dto.status = "COMPLETED";
  assert.equal((await validate(dto)).length, 0);
  dto.status = "PENDING" as "COMPLETED";
  assert.ok((await validate(dto)).length > 0);
});

test("finishing an appointment is tenant-scoped and requires confirmed status", async () => {
  let where: unknown;
  const db = {
    membership: { findUnique: async () => ({ role: "ADMIN", isActive: true, tenant: { status: "ACTIVE" } }) },
    appointment: { updateMany: async (args: { where: unknown }) => { where = args.where; return { count: 1 }; } },
  };
  const service = new BookingService(db as never, {} as never);
  const result = await service.finish("tenant-a", "appointment-a", "admin-a", "NO_SHOW");
  assert.equal(result.status, "NO_SHOW");
  assert.deepEqual(where, {
    id: "appointment-a", tenantId: "tenant-a", status: "CONFIRMED", startsAt: { lte: (where as { startsAt: { lte: Date } }).startsAt.lte },
  });
});

test("invalid status transition is rejected", async () => {
  const db = {
    membership: { findUnique: async () => ({ role: "EMPLOYEE", isActive: true, tenant: { status: "ACTIVE" } }) },
    appointment: { updateMany: async () => ({ count: 0 }) },
  };
  const service = new BookingService(db as never, {} as never);
  await assert.rejects(() => service.finish("tenant", "appointment", "employee", "COMPLETED"), ConflictException);
});
