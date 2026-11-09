import "reflect-metadata";
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { validate } from "class-validator";
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
