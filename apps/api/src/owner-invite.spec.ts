import "reflect-metadata";
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { validate } from "class-validator";
import { BadRequestException } from "@nestjs/common";
import { CreateOwnerInviteDto, OwnerInviteService } from "./owner-invite";
import { RegisterClientDto, RegisterDto, AuthService } from "./auth";

test("SYSTEM must set recipient label and valid billing due day", async () => {
  const dto = new CreateOwnerInviteDto();
  dto.referenceName = "João";
  dto.billingDueDay = 32;
  assert.ok((await validate(dto)).length > 0);
  dto.billingDueDay = 15;
  assert.equal((await validate(dto)).length, 0);
});

test("owner registration rejects usernames with spaces, accents or punctuation", async () => {
  const dto = new RegisterDto();
  dto.name = "João Miguel"; dto.email = "joao@example.com"; dto.whatsapp = "32999999999";
  dto.password = "senha-super-segura"; dto.businessName = "Corte"; dto.inviteToken = "a".repeat(43);
  for (const username of ["joao miguel", "joão", "joao_miguel", "joao.miguel", "Joao"]) {
    dto.username = username;
    assert.ok((await validate(dto)).some(error => error.property === "username"));
  }
  dto.username = "joaomiguel";
  assert.equal((await validate(dto)).length, 0);
});

test("client registration does not require an owner invite or create a tenant", async () => {
  let created: Record<string, unknown> | undefined;
  const db = {
    user: {
      findFirst: async () => null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        created = data;
        return { id: "client", ...data, globalRole: "USER" };
      },
    },
    authSession: { create: async () => ({}) },
  };
  const jwt = { signAsync: async () => "access-token" };
  const res = { cookie: () => undefined };
  const auth = new AuthService(db as never, jwt as never);
  const result = await auth.registerClient({
    name: "Maria", username: "maria", email: "maria@example.com",
    whatsapp: "32999999999", password: "senha-forte-123",
  }, res as never);
  assert.equal(result.user.id, "client");
  assert.equal(created?.email, "maria@example.com");
  assert.equal("businessName" in (created ?? {}), false);
});

test("client registration DTO validates the independent account fields", async () => {
  const dto = new RegisterClientDto();
  dto.name = "Maria"; dto.username = "maria"; dto.email = "maria@example.com";
  dto.whatsapp = "32999999999"; dto.password = "senha-forte-123";
  assert.equal((await validate(dto)).length, 0);
});

test("public verification rejects consumed tokens", async () => {
  const db = { ownerInvite: { findUnique: async () => ({
    referenceName: "Cliente", consumedAt: new Date(), revokedAt: null,
    expiresAt: new Date(Date.now() + 86400000),
  }) } };
  const service = new OwnerInviteService(db as never);
  await assert.rejects(() => service.verify("a".repeat(43)), BadRequestException);
});

test("registration without a valid invite never creates an account", async () => {
  let created = false;
  const tx = { ownerInvite: { findUnique: async () => null }, user: { create: async () => { created = true; } } };
  const db = {
    user: { findFirst: async () => null },
    $transaction: async (callback: (arg: typeof tx) => Promise<unknown>) => callback(tx),
  };
  const auth = new AuthService(db as never, {} as never);
  const dto = { name: "João", username: "joao", email: "joao@example.com", whatsapp: "32999999999",
    password: "senha-forte-123", businessName: "Barbearia", inviteToken: "a".repeat(43) };
  await assert.rejects(() => auth.register(dto, {} as never), BadRequestException);
  assert.equal(created, false);
});

test("invite issue returns link and stores only hash", async () => {
  let data: Record<string, unknown> | undefined;
  const db = { $transaction: async (run: (tx: unknown) => Promise<unknown>) => run(db),
    platformAudit: { create: async () => ({}) }, ownerInvite: { create: async (args: { data: Record<string, unknown> }) => {
    data = args.data;
    return { id: "invite", referenceName: "Maria", billingDueDay: 20, expiresAt: new Date() };
  } } };
  const service = new OwnerInviteService(db as never);
  const issued = await service.create("system-id", { referenceName: "Maria", billingDueDay: 20 });
  const token = new URL(issued.registrationUrl).searchParams.get("token");
  assert.ok(token && token.length >= 32);
  assert.equal(typeof data?.tokenHash, "string");
  assert.notEqual(data?.tokenHash, token);
  assert.equal(data?.billingDueDay, 20);
});
