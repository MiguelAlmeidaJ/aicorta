import "reflect-metadata";
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { validate } from "class-validator";
import { ForgotPasswordDto, ResetPasswordDto, RecoveryService } from "./recovery";
import { normalizeBrazilianWhatsapp } from "./phone";

test("normaliza WhatsApp do Brasil", () => {
  assert.equal(normalizeBrazilianWhatsapp("32998816832"), "32998816832");
  assert.equal(normalizeBrazilianWhatsapp("+5532998816832"), "32998816832");
  assert.equal(normalizeBrazilianWhatsapp("(32) 99881-6832"), "32998816832");
  assert.equal(normalizeBrazilianWhatsapp("123"), null);
});

test("validação dos campos da recuperação", async () => {
  const forgot = new ForgotPasswordDto();
  forgot.email = "invalid";
  assert.ok((await validate(forgot)).length > 0);
  const reset = new ResetPasswordDto();
  reset.token = "token";
  reset.password = "curta";
  assert.ok((await validate(reset)).length > 0);
});

test("resposta genérica sem configuração SMTP", async () => {
  const db = { user: { findUnique: async () => null } };
  const service = new RecoveryService(db as never);
  const result = await service.forgot("inexistente@example.com");
  assert.match(result.message, /Se o e-mail estiver cadastrado/);
});

test("token muito curto não aciona transação", async () => {
  const service = new RecoveryService({} as never);
  await assert.rejects(() => service.reset("curto", "nova-senha-segura"), /Token inválido/);
});

test("token inválido ou já consumido não altera senha", async () => {
  let userChanged = false;
  const db = {
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback({
      passwordReset: { updateMany: async () => ({ count: 0 }) },
      user: { update: async () => { userChanged = true; } },
    }),
  };
  const service = new RecoveryService(db as never);
  await assert.rejects(
    () => service.reset("um-token-grande-e-invalido-de-exemplo", "senha-nova-com-dez"),
    /Link inválido ou expirado/,
  );
  assert.equal(userChanged, false);
});
