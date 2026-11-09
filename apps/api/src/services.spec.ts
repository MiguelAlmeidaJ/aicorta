import "reflect-metadata";
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { BadRequestException } from "@nestjs/common";
import { parseServiceImage, ServiceCatalogService } from "./services";
import { parseTenantCover } from "./tenant-settings";

function png(width: number, height: number) {
  const bytes = Buffer.alloc(33);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes);
  bytes.writeUInt32BE(13, 8); bytes.write("IHDR", 12, "ascii");
  bytes.writeUInt32BE(width, 16); bytes.writeUInt32BE(height, 20);
  return `data:image/png;base64,${bytes.toString("base64")}`;
}

function webp(width: number, height: number) {
  const bytes = Buffer.alloc(30);
  bytes.write("RIFF", 0, "ascii"); bytes.writeUInt32LE(22, 4); bytes.write("WEBPVP8X", 8, "ascii");
  const write24 = (offset: number, value: number) => {
    bytes[offset] = value & 0xff; bytes[offset + 1] = value >> 8 & 0xff; bytes[offset + 2] = value >> 16 & 0xff;
  };
  write24(24, width - 1); write24(27, height - 1);
  return `data:image/webp;base64,${bytes.toString("base64")}`;
}

test("foto de serviço precisa ter exatamente 1080 × 1080", () => {
  assert.equal(parseServiceImage(png(1080, 1080)).mime, "image/png");
  assert.throws(() => parseServiceImage(png(1200, 1080)), BadRequestException);
});

test("capa da barbearia precisa resultar em 1280 × 520", () => {
  assert.equal(parseTenantCover(png(1280, 520)).mime, "image/png");
  assert.throws(() => parseTenantCover(png(1080, 1080)), BadRequestException);
});

test("WEBP com transparência é aceito para serviços e capas", () => {
  assert.equal(parseServiceImage(webp(1080, 1080)).mime, "image/webp");
  assert.equal(parseTenantCover(webp(1280, 520)).mime, "image/webp");
  assert.throws(() => parseTenantCover(webp(1280, 519)), BadRequestException);
});

test("serviço sem profissionais selecionados é vinculado ao proprietário", async () => {
  const ownerMembershipId = "11111111-1111-4111-8111-111111111111";
  let assignments: { membershipId: string; serviceId: string }[] = [];
  const tx = {
    tenant: { findUnique: async () => ({ ownerId: "owner-a" }) },
    membership: {
      findUnique: async () => ({ id: ownerMembershipId, isActive: true }),
      findMany: async () => [{ id: ownerMembershipId }],
    },
    service: {
      create: async () => ({ id: "service-a" }),
      findUniqueOrThrow: async () => ({ id: "service-a", name: "Corte", employees: [] }),
    },
    employeeService: { createMany: async ({ data }: { data: typeof assignments }) => { assignments = data; } },
  };
  const catalog = new ServiceCatalogService({
    $transaction: async (run: (client: typeof tx) => unknown) => run(tx),
  } as never);
  await catalog.create("tenant-a", {
    name: "Corte", durationMinutes: 30, priceCents: 3500, professionalIds: [],
  });
  assert.deepEqual(assignments, [{ membershipId: ownerMembershipId, serviceId: "service-a" }]);
});

test("serviço rejeita profissional de outra barbearia", async () => {
  const tx = {
    membership: { findMany: async () => [] },
  };
  const catalog = new ServiceCatalogService({
    $transaction: async (run: (client: typeof tx) => unknown) => run(tx),
  } as never);
  await assert.rejects(() => catalog.create("tenant-a", {
    name: "Corte", durationMinutes: 30, priceCents: 3500,
    professionalIds: ["22222222-2222-4222-8222-222222222222"],
  }), BadRequestException);
});

test("serviços sem foto usam a imagem padrão global", async () => {
  const updatedAt = new Date("2026-11-06T12:00:00Z");
  const catalog = new ServiceCatalogService({
    service: { findMany: async () => [
      { id: "sem-foto", name: "Barba", imageMime: null, updatedAt },
      { id: "com-foto", name: "Corte", imageMime: "image/jpeg", updatedAt },
    ] },
    platformBrand: { findUnique: async () => ({ defaultServiceImageMime: "image/jpeg", updatedAt }) },
  } as never);
  const services = await catalog.list("tenant-a");
  assert.match(services[0].imageUrl!, /branding\/assets\/service/);
  assert.match(services[1].imageUrl!, /\/com-foto\/image/);
});
