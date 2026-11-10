import "reflect-metadata";
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { ConflictException, ForbiddenException, GoneException, NotFoundException } from "@nestjs/common";
import { PeopleService } from "./people";

test("busca por e-mail informa se uma conta existente pode ser vinculada", async () => {
  const people = new PeopleService({ user: { findUnique: async () => ({
    id: "user-a", name: "Ana", username: "ana", email: "ana@example.com",
    isActive: true, globalRole: "USER", memberships: [],
  }) } } as never);
  const result = await people.lookupEmployee("tenant-a", " ANA@example.com ");
  assert.equal(result.exists, true);
  assert.equal(result.canLink, true);
  assert.equal(result.email, "ana@example.com");
});

test("conta de cliente existente é promovida e vinculada diretamente como funcionário", async () => {
  let updateData: unknown;
  const tx = {
    membership: {
      findUnique: async () => ({ id: "member-a", role: "CLIENT", isActive: true }),
      update: async ({ data }: { data: unknown }) => {
        updateData = data;
        return { id: "member-a", role: "EMPLOYEE", isActive: true, user: { name: "Ana" } };
      },
    },
    tenantInvitation: { updateMany: async () => ({ count: 1 }) },
  };
  const people = new PeopleService({
    user: { findUnique: async () => ({ id: "user-a", name: "Ana", isActive: true, globalRole: "USER" }) },
    $transaction: async (run: (client: typeof tx) => unknown) => run(tx),
  } as never);
  const linked = await people.addEmployee("tenant-a", { email: "ana@example.com" });
  assert.deepEqual(updateData, { role: "EMPLOYEE", isActive: true });
  assert.equal(linked.role, "EMPLOYEE");
});

test("administrador cria conta e vínculo de funcionário sem convite", async () => {
  const operations: string[] = [];
  const tx = {
    user: { create: async () => { operations.push("user"); return { id: "user-new" }; } },
    membership: { create: async () => {
      operations.push("membership");
      return { id: "member-new", role: "EMPLOYEE", isActive: true, user: { name: "Bruno" } };
    } },
    tenantInvitation: { updateMany: async () => { operations.push("revoke-invites"); return { count: 0 }; } },
  };
  const people = new PeopleService({
    user: { findUnique: async () => null, findFirst: async () => null },
    $transaction: async (run: (client: typeof tx) => unknown) => run(tx),
  } as never);
  const linked = await people.addEmployee("tenant-a", {
    email: "bruno@example.com", name: "Bruno", username: "bruno",
    whatsapp: "32999999999", password: "senha-forte-2026",
  });
  assert.deepEqual(operations, ["user", "membership", "revoke-invites"]);
  assert.equal(linked.id, "member-new");
});

test("convite pode ser emitido antes da criação da conta", async () => {
  let invitationData: unknown;
  const people = new PeopleService({
    user: { findUnique: async () => null },
    tenantInvitation: { create: async ({ data }: { data: unknown }) => {
      invitationData = data;
      return { id: "invite", email: "new@example.com", role: "EMPLOYEE", expiresAt: new Date() };
    } },
  } as never);
  const result = await people.invite("tenant", "admin", { email: "new@example.com", role: "EMPLOYEE" });
  assert.match(result.acceptanceUrl, /\/aceitar-convite\?token=/);
  assert.deepEqual((invitationData as { email: string; role: string }).email, "new@example.com");
});

test("convidado com e-mail diferente não aceita convite", async () => {
  const invitation = { id: "invite", tenantId: "tenant-a", email: "target@example.com",
    role: "EMPLOYEE", acceptedAt: null, revokedAt: null,
    expiresAt: new Date(Date.now() + 10_000), tenant: { status: "ACTIVE" } };
  const tx = {
    tenantInvitation: { findUnique: async () => invitation },
    user: { findUnique: async () => ({ email: "other@example.com", isActive: true, globalRole: "USER" }) },
  };
  const people = new PeopleService({ $transaction: async (cb: (arg: typeof tx) => unknown) => cb(tx) } as never);
  await assert.rejects(() => people.accept("other", "token-with-length-over-thirty-characters"), ForbiddenException);
});

test("convite expirado é recusado", async () => {
  const tx = { tenantInvitation: { findUnique: async () => ({
    acceptedAt: null, revokedAt: null, expiresAt: new Date(0), tenant: { status: "ACTIVE" },
  }) } };
  const people = new PeopleService({ $transaction: async (cb: (arg: typeof tx) => unknown) => cb(tx) } as never);
  await assert.rejects(() => people.accept("user", "token-with-length-over-thirty-characters"), GoneException);
});

test("desativação sempre filtra tenant e role", async () => {
  let filter: unknown;
  const people = new PeopleService({ membership: { updateMany: async ({ where }: { where: unknown }) => {
    filter = where; return { count: 1 };
  } } } as never);
  await people.deactivate("tenant-a", "membership-a", "EMPLOYEE");
  assert.deepEqual(filter, { id: "membership-a", tenantId: "tenant-a", role: "EMPLOYEE", isActive: true });
});

test("desativação não permite vínculo de outra barbearia", async () => {
  const people = new PeopleService({ membership: { updateMany: async () => ({ count: 0 }) } } as never);
  await assert.rejects(() => people.deactivate("tenant-a", "membership-b", "CLIENT"), NotFoundException);
});

test("convite rejeita usuário já vinculado ao tenant", async () => {
  const people = new PeopleService({
    user: { findUnique: async () => ({ id: "u", isActive: true, globalRole: "USER" }) },
    membership: { findUnique: async () => ({ id: "m" }) },
  } as never);
  await assert.rejects(() => people.invite("tenant", "admin", { email: "user@example.com", role: "CLIENT" }), ConflictException);
});

test("aceite válido cria membership somente no tenant do convite", async () => {
  let created: unknown;
  const tx = {
    tenantInvitation: {
      findUnique: async () => ({
        id: "invite-a", tenantId: "tenant-a", role: "EMPLOYEE", email: "user@example.com",
        acceptedAt: null, revokedAt: null, expiresAt: new Date(Date.now() + 60_000),
        tenant: { status: "ACTIVE" },
      }),
      updateMany: async () => ({ count: 1 }),
    },
    user: { findUnique: async () => ({ email: "user@example.com", isActive: true, globalRole: "USER" }) },
    membership: {
      findUnique: async () => null,
      create: async (args: unknown) => { created = args; return { id: "m", tenantId: "tenant-a", role: "EMPLOYEE" }; },
    },
  };
  const people = new PeopleService({ $transaction: async (cb: (arg: typeof tx) => unknown) => cb(tx) } as never);
  const result = await people.accept("user-a", "a-valid-token-that-is-long-enough");
  assert.equal(result.membership.tenantId, "tenant-a");
  assert.deepEqual((created as { data: unknown }).data, { userId: "user-a", tenantId: "tenant-a", role: "EMPLOYEE" });
});
