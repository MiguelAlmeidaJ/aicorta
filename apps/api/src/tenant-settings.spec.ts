import "reflect-metadata";
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { validate } from "class-validator";
import { UpdateTenantSettingsDto } from "./tenant-settings";

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
