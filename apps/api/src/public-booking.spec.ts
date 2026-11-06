import "reflect-metadata";
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { ForbiddenException, ConflictException } from "@nestjs/common";
import { BookingService } from "./booking";
import { PublicBookingService } from "./public-booking";

test("autoatendimento rejeita agendar para outro usuário", async () => {
  const service = new BookingService({} as never, {} as never);
  await assert.rejects(() => service.create("tenant-a", "user-a", {
    clientId: "user-b", serviceId: "service", employeeMembershipId: "staff",
    startsAt: "2027-03-01T12:00:00Z",
  }, true), ForbiddenException);
});

test("cancelamento impede terceiro sem vínculo administrativo", async () => {
  const db = {
    appointment: { findFirst: async () => ({
      clientId: "user-a", startsAt: new Date(Date.now() + 86400000), status: "PENDING",
    }) },
    membership: { findUnique: async () => null },
  };
  const service = new BookingService(db as never, {} as never);
  await assert.rejects(() => service.cancel("tenant-a", "appointment-a", "user-b"), ForbiddenException);
});

test("cancelamento tardio exige 2 horas", async () => {
  const db = {
    appointment: { findFirst: async () => ({
      clientId: "user-a", startsAt: new Date(Date.now() + 3600000), status: "CONFIRMED",
    }) },
    membership: { findUnique: async () => null },
  };
  const service = new BookingService(db as never, {} as never);
  await assert.rejects(() => service.cancel("tenant-a", "appointment-a", "user-a"), ConflictException);
});

test("consulta pública limita tenant a estabelecimento ativo", async () => {
  let where: unknown;
  const db = { tenant: { findFirst: async (args: { where: unknown }) => {
    where = args.where; return { id: "tenant", name: "Barbearia", slug: "barbearia", timezone: "America/Sao_Paulo" };
  } } };
  const service = new PublicBookingService(db as never, {} as never, {} as never);
  await service.tenant("barbearia");
  assert.deepEqual(where, { slug: "barbearia", status: "ACTIVE" });
});
