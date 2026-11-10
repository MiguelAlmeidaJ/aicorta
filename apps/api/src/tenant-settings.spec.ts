import "reflect-metadata";
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import { TenantSettingsService, UpdateTenantSettingsDto } from "./tenant-settings";

test("UF em branco é opcional ao atualizar somente o slug", async () => {
  const dto = Object.assign(new UpdateTenantSettingsDto(), { slug: "barbearia-central", state: "" });
  assert.deepEqual(await validate(dto), []);
});

test("UF válida é aceita e UF incorreta produz mensagem amigável", async () => {
  const valid = Object.assign(new UpdateTenantSettingsDto(), { slug: "barbearia-central", state: "MG" });
  assert.deepEqual(await validate(valid), []);
  const invalid = Object.assign(new UpdateTenantSettingsDto(), { slug: "barbearia-central", state: "ABC" });
  const errors = await validate(invalid);
  assert.equal(errors.length, 1);
  assert.match(JSON.stringify(errors[0].constraints), /Informe uma UF válida/);
});

test("slug público continua restrito a letras minúsculas, números e hífens", async () => {
  const valid = Object.assign(new UpdateTenantSettingsDto(), { slug: "joao-da-barbearia" });
  assert.deepEqual(await validate(valid), []);
  const invalid = Object.assign(new UpdateTenantSettingsDto(), { slug: "João da Barbearia" });
  assert.ok((await validate(invalid)).length > 0);
});

test("alterar somente o slug não modifica UF, cidade ou bairro", async () => {
  let data: Record<string, unknown> | undefined;
  const db = {
    tenant: {
      update: async ({ data: patch }: { data: Record<string, unknown> }) => { data = patch; },
      findUniqueOrThrow: async () => ({
        id: "tenant-a", slug: "jl-du-corte", name: "JL du Corte", state: null, city: null,
        neighborhood: null, coverMime: null, updatedAt: new Date(),
      }),
    },
  };
  const service = new TenantSettingsService(db as never);
  const updated = await service.update("tenant-a", { slug: "jl-du-corte" });
  assert.deepEqual(data, { slug: "jl-du-corte" });
  assert.equal(updated.slug, "jl-du-corte");
});

test("slug atualizado pode ser validado sem preencher UF", async () => {
  const dto = Object.assign(new UpdateTenantSettingsDto(), { slug: "jl-du-corte" });
  assert.deepEqual(await validate(dto), []);
});

test("endereço completo salva coordenadas confirmadas", async () => {
  let data: Record<string, unknown> | undefined;
  const db = { tenant: {
    update: async ({ data: fields }: { data: Record<string, unknown> }) => { data = fields; },
    findUniqueOrThrow: async () => ({ slug: "barbearia", coverMime: null, updatedAt: new Date() }),
  } };
  const service = new TenantSettingsService(db as never);
  await service.update("tenant-1", {
    street:"Rua das Flores",streetNumber:"125",postalCode:"36660000",
    city:"Além Paraíba", state:"MG", latitude:-21.87,longitude:-42.70,
  });
  assert.equal(data?.street,"Rua das Flores");
  assert.equal(data?.latitude,-21.87);
  assert.equal(data?.longitude,-42.70);
});

test("alterar o endereço invalida a posição anterior quando não enviada", async () => {
  let data: Record<string, unknown> | undefined;
  const db = { tenant: {
    update: async ({ data: fields }: { data: Record<string, unknown> }) => { data = fields; },
    findUniqueOrThrow: async () => ({ slug: "barbearia", coverMime: null, updatedAt: new Date() }),
  } };
  const service = new TenantSettingsService(db as never);
  await service.update("tenant-1",{ streetNumber:"126" });
  assert.equal(data?.latitude,null);
  assert.equal(data?.longitude,null);
});

test("coordenadas não podem ser enviadas pela metade", async () => {
  const service = new TenantSettingsService({} as never);
  await assert.rejects(() => service.update("tenant-1",{ latitude: -21.8 }), /Informe latitude e longitude juntas/);
});

test("CEP e coordenadas fora do padrão são rejeitados", async () => {
  const dto = Object.assign(new UpdateTenantSettingsDto(),{
    postalCode:"36660",latitude:-95,longitude:200,
  });
  assert.equal((await validate(dto)).length,3);
});

test("prazo de reservas valida números inteiros entre 1 e 90 dias", async () => {
  assert.deepEqual(await validate(Object.assign(new UpdateTenantSettingsDto(), { bookingAdvanceDays: 21 })), []);
  assert.ok((await validate(Object.assign(new UpdateTenantSettingsDto(), { bookingAdvanceDays: 0 }))).length > 0);
  assert.ok((await validate(Object.assign(new UpdateTenantSettingsDto(), { bookingAdvanceDays: 91 }))).length > 0);
  assert.ok((await validate(Object.assign(new UpdateTenantSettingsDto(), { bookingAdvanceDays: 1.5 }))).length > 0);
});

test("atualizar apenas prazo de reservas não apaga latitude e longitude", async () => {
  let data: Record<string, unknown> | undefined;
  const db = { tenant: {
    update: async ({ data: patch }: { data: Record<string, unknown> }) => { data = patch; },
    findUniqueOrThrow: async () => ({ bookingAdvanceDays: 35, coverMime: null, updatedAt: new Date() }),
  } };
  const service = new TenantSettingsService(db as never);
  await service.update("tenant-a", plainToInstance(UpdateTenantSettingsDto, { bookingAdvanceDays: 35 }));
  assert.equal(data?.bookingAdvanceDays, 35);
  assert.equal("latitude" in (data ?? {}), false);
  assert.equal("longitude" in (data ?? {}), false);
});
