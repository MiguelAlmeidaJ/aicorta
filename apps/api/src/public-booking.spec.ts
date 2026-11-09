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
  const service = new PublicBookingService(db as never, {} as never, {} as never, { refreshTenantState: async () => ({ operational: true }) } as never);
  await service.tenant("barbearia");
  assert.deepEqual(where, { slug: "barbearia", status: "ACTIVE" });
});

test("agendamento público preserva todos os serviços selecionados", async () => {
  let received: { serviceId: string; serviceIds?: string[] } | undefined;
  const db = { tenant: { findFirst: async () => ({
    id: "tenant", name: "Barbearia", slug: "barbearia", timezone: "America/Sao_Paulo",
  }) } };
  const bookings = { create: async (_tenant: string, _user: string, dto: typeof received) => { received = dto; } };
  const service = new PublicBookingService(db as never, {} as never, bookings as never, { refreshTenantState: async () => ({ operational: true }) } as never);
  await service.create("barbearia", "user-a", {
    serviceIds: ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"],
    employeeMembershipId: "33333333-3333-4333-8333-333333333333", startsAt: "2027-03-01T12:00:00Z",
  });
  assert.equal(received?.serviceId, "11111111-1111-4111-8111-111111111111");
  assert.equal(received?.serviceIds?.length, 2);
});

test("diretório público usa a capa própria ou a capa padrão do SYSTEM, nunca fotos de serviços", async () => {
  const now = new Date("2026-11-09T15:00:00.000Z");
  const db = {
    tenant: { findMany: async () => [
      { id: "a", name: "Com capa", slug: "com-capa", city: null, state: null,
        neighborhood: null, coverMime: "image/jpeg", updatedAt: now },
      { id: "b", name: "Sem capa", slug: "sem-capa", city: null, state: null,
        neighborhood: null, coverMime: null, updatedAt: now },
    ] },
    platformBrand: { findUnique: async () => ({ defaultTenantCoverMime: "image/jpeg", updatedAt: now }) },
  };
  const service = new PublicBookingService(db as never, {} as never, {} as never, {} as never);
  const items = await service.discover("");
  assert.equal(items[0].coverUrl, `/b/com-capa/cover?v=${now.getTime()}`);
  assert.equal(items[1].coverUrl, `/branding/assets/establishment?v=${now.getTime()}`);
  assert.equal(items[0].hasCustomCover, true);
  assert.equal(items[1].hasCustomCover, false);
});
