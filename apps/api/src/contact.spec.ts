import "reflect-metadata";
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { ContactService, PublicContactDto, composeContactMessage } from "./contact";

const valid = {
  name: "João Almeida",
  email: "joao@example.com",
  whatsapp: "(32) 99999-9999",
  subject: "Quero usar o AICorta",
  description: "Tenho uma barbearia e quero conhecer o sistema.",
};

test("formulário aceita dados válidos e normaliza e-mail e telefone", async () => {
  const dto = plainToInstance(PublicContactDto, valid);
  assert.deepEqual(await validate(dto), []);
  const mail = composeContactMessage(dto);
  assert.equal(mail.replyTo.address, valid.email);
  assert.match(mail.text, /32999999999/);
  assert.match(mail.text, /João Almeida/);
  assert.match(mail.subject, /Quero usar o AICorta/);
  assert.match(mail.html, /Responder por e-mail/);
  assert.match(mail.html, /Abrir WhatsApp/);
  assert.match(mail.html, /INFORMAÇÕES DO CONTATO/);
});

test("formulário rejeita e-mail, telefone e conteúdo inválidos", async () => {
  const dto = plainToInstance(PublicContactDto, {
    ...valid, email: "não-email", whatsapp: "1234",
    subject: "Outro assunto injetado", description: "curto",
  });
  assert.ok((await validate(dto)).length >= 4);
});

test("formulário limita o tamanho de descrição e nome", async () => {
  const dto = plainToInstance(PublicContactDto, {
    ...valid, name: "a".repeat(101), description: "x".repeat(3001),
  });
  assert.ok((await validate(dto)).length >= 2);
});

test("honeypot não dispara e-mail para preenchimentos automatizados", async () => {
  const result = await new ContactService({} as never).send(Object.assign(new PublicContactDto(), {
    ...valid, website: "https://spam.example",
  }));
  assert.equal(result.message, "Mensagem recebida.");
});

test("formulário não confirma envio se SMTP ou destinatário não estão configurados", async () => {
  const originalHost = process.env.SMTP_HOST;
  const originalTo = process.env.CONTACT_TO_EMAIL;
  delete process.env.SMTP_HOST;
  delete process.env.CONTACT_TO_EMAIL;
  try {
    await assert.rejects(
      () => new ContactService({} as never).send(Object.assign(new PublicContactDto(), valid)),
      /O contato por formulário está indisponível/,
    );
  } finally {
    if (originalHost !== undefined) process.env.SMTP_HOST = originalHost;
    if (originalTo !== undefined) process.env.CONTACT_TO_EMAIL = originalTo;
  }
});

test("HTML incorpora logo do SYSTEM em CID, sem depender de link externo", () => {
  const mail = composeContactMessage(Object.assign(new PublicContactDto(), valid),{
    name:"AICorta",gold:"#F2C225",
    logo:new Uint8Array([137,80,78,71]), logoMime:"image/png",
  });
  assert.match(mail.html,/cid:aicorta-contact-logo/);
  assert.match(mail.html,/#F2C225/);
  assert.equal(mail.attachments?.[0].cid,"aicorta-contact-logo");
  assert.equal(mail.attachments?.[0].contentType,"image/png");
});

test("mensagem do usuário é escapada, sem HTML arbitrário no e-mail", () => {
  const mail = composeContactMessage(Object.assign(new PublicContactDto(),{
    ...valid,
    description:"Pedido de contato <script>alert('x')</script>\nAguardo retorno.",
  }));
  assert.doesNotMatch(mail.html, /<script>/);
  assert.match(mail.html, /&lt;script&gt;/);
  assert.match(mail.html, /<br \/>/);
});
