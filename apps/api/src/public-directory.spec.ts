import "reflect-metadata";
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { PublicDirectoryService, closestSlot, parseDirectoryPage, parseRequestedTime } from "./public-directory";
import { localParts, localToUtc } from "./scheduling-time";

test("paginação aceita páginas positivas e rejeita formatos inválidos", () => {
  assert.equal(parseDirectoryPage(), 1);
  assert.equal(parseDirectoryPage("3"), 3);
  for (const value of ["0", "-1", "2.4", "invalid", "10001"]) {
    assert.throws(() => parseDirectoryPage(value));
  }
});

test("horário exige HH:mm válido e ranqueia slots pela distância real", () => {
  assert.equal(parseRequestedTime("14:30"), 870);
  for (const invalid of ["24:00", "25:30", "10:60", "2:00", "14h"]) {
    assert.throws(() => parseRequestedTime(invalid));
  }
  const preferred = closestSlot([
    "2026-11-11T13:45:00.000Z", "2026-11-11T14:00:00.000Z",
  ], new Date("2026-11-11T14:00:00.000Z"));
  assert.equal(preferred?.startsAt, "2026-11-11T14:00:00.000Z");
  assert.equal(closestSlot([], new Date()), null);
});

test("diretório retorna paginação real no banco, com capa própria e padrão", async () => {
  let observedSkip = -1;
  let observedTake = -1;
  const db = {
    tenant: {
      count: async () => 22,
      findMany: async (params: { skip: number; take: number }) => {
        observedSkip = params.skip; observedTake = params.take;
        return [{ id: "1", name: "Barbearia Teste", slug: "teste", city: "Além Paraíba",
          state: "MG", neighborhood: "Centro", street: "Rua A", streetNumber: "3",
          latitude: null, longitude: null, coverMime: null,
          updatedAt: new Date("2026-11-11T12:00:00.000Z") }];
      },
    },
    platformBrand: { findUnique: async () => ({
      defaultTenantCoverMime: "image/jpeg", updatedAt: new Date("2026-11-11T12:00:00.000Z"),
    }) },
  };
  const result = await new PublicDirectoryService(db as never, {} as never, {} as never).list("", "2");
  assert.equal(observedSkip, 9);
  assert.equal(observedTake, 9);
  assert.equal(result.totalPages, 3);
  assert.equal(result.total, 22);
  assert.equal(result.items[0].coverUrl, "/branding/assets/establishment?v=1794398400000");
});

test("busca rápida identifica exatamente o horário escolhido quando realmente disponível", async () => {
  const zone = "America/Sao_Paulo";
  const date = localParts(new Date(Date.now() + 2 * 86400000), zone).date;
  const target = localToUtc(date, 14 * 60, zone);
  assert.ok(target);
  const db = {
    service: { findMany: async () => [{
      id: "service-id", name: "Corte masculino", durationMinutes: 30, priceCents: 3500,
      tenant: { id: "tenant", slug: "barbearia", name: "Barbearia", timezone: zone,
        bookingAdvanceDays: 21, city: "Além Paraíba", state: "MG", neighborhood: "Centro",
        coverMime: null, updatedAt: new Date() },
      employees: [{ membershipId: "staff" }],
    }] },
    platformBrand: { findUnique: async () => null },
  };
  const agenda = {
    availabilityForServices: async (_tenant: string, _serviceIds: string[], _staff: string, day: string) =>
      ({ slots: day === date ? [target!.toISOString()] : [] }),
  };
  const billing = { refreshTenantState: async () => ({ operational: true }) };
  const result = await new PublicDirectoryService(db as never, agenda as never, billing as never)
    .quickBooking("corte", date, "14:00");
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].exact, true);
  assert.equal(result.items[0].slotDate, date);
  assert.equal(result.items[0].startsAt, target?.toISOString());
});

test("busca rápida não divulga barbearias com assinatura suspensa", async () => {
  const zone = "America/Sao_Paulo";
  const date = localParts(new Date(Date.now() + 2 * 86400000), zone).date;
  const db = {
    service: { findMany: async () => [{ id: "s", name: "Barba", durationMinutes: 20, priceCents: 2000,
      tenant: { id: "t", name: "Loja", slug: "loja", timezone: zone, bookingAdvanceDays: 21,
        city: null, state: null, neighborhood: null, coverMime: null, updatedAt: new Date() },
      employees: [{ membershipId: "m" }] }] },
    platformBrand: { findUnique: async () => null },
  };
  const result = await new PublicDirectoryService(db as never, {} as never,
    { refreshTenantState: async () => ({ operational: false }) } as never)
    .quickBooking("barba", date, "15:00");
  assert.deepEqual(result.items, []);
});
