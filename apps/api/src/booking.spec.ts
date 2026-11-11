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

test("reserva rejeita datas além dos dias autorizados mesmo em chamadas diretas à API", async () => {
  const db = {
    service: { findMany: async () => [{ id: "service", priceCents: 2000, durationMinutes: 30 }] },
    membership: { findFirst: async () => ({ id: "staff" }) },
    user: { findFirst: async () => ({ id: "client" }) },
  };
  const agenda = { tenant: async () => ({ timezone: "America/Sao_Paulo", bookingAdvanceDays: 7 }) };
  const booking = new BookingService(db as never, agenda as never);
  await assert.rejects(() => booking.create("tenant", "client", {
    clientId: "client", serviceId: "service", serviceIds: ["service"], employeeMembershipId: "staff",
    startsAt: "2099-03-10T12:00:00.000Z",
  }, true), /Escolha uma data dentro do prazo de agendamento/);
});

test("remarcação rejeita datas além do prazo antes de consultar horários", async () => {
  const db = { appointment: { findFirst: async () => ({
    clientId: "client", serviceId: "service", employeeMembershipId: "staff",
    startsAt: new Date("2099-03-01T12:00:00Z"),
    endsAt: new Date("2099-03-01T12:30:00Z"), status: "CONFIRMED",
    services: [],
  }) } };
  const agenda = { tenant: async () => ({ timezone: "America/Sao_Paulo", bookingAdvanceDays: 7 }) };
  const booking = new BookingService(db as never, agenda as never);
  await assert.rejects(() => booking.reschedule("tenant", "appointment", "client",
    "2099-03-10T12:00:00.000Z"), /A remarcação deve respeitar o prazo/);
});

test("API recusa criar reserva com menos de 1 hora de antecedência", async () => {
  const db = {
    service: { findMany: async () => [{
      id: "service", priceCents: 2500, durationMinutes: 30,
    }] },
    membership: { findFirst: async () => ({ id: "professional" }) },
    user: { findFirst: async () => ({ id: "client" }) },
  };
  const booking = new BookingService(db as never, {} as never);
  const startsAt = new Date(Date.now() + 45 * 60_000).toISOString();
  await assert.rejects(() => booking.create("tenant", "client", {
    serviceId: "service", serviceIds: ["service"], employeeMembershipId: "professional",
    clientId: "client", startsAt,
  }, true), /1 hora de antecedência/);
});
