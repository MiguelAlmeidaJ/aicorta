import "reflect-metadata";
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { validate } from "class-validator";
import { ForbiddenException } from "@nestjs/common";
import { PlatformStaffGuard, SystemGuard } from "./auth";
import { CreateManagerDto, ManagerStatusDto, PlatformStaffService } from "./platform-staff";

const context = { switchToHttp: () => ({ getRequest: () => ({ user: { id: "operator" } }) }) } as never;

test("MANAGER e SYSTEM acessam operação, mas somente SYSTEM acessa telas privadas", async () => {
  let role = "MANAGER";
  const db = { user: { findUnique: async () => ({ isActive: true, globalRole: role }) } };
  const staff = new PlatformStaffGuard(db as never);
  const system = new SystemGuard(db as never);
  assert.equal(await staff.canActivate(context), true);
  await assert.rejects(() => system.canActivate(context), ForbiddenException);
  role = "SYSTEM";
  assert.equal(await staff.canActivate(context), true);
  assert.equal(await system.canActivate(context), true);
  role = "USER";
  await assert.rejects(() => staff.canActivate(context), ForbiddenException);
  await assert.rejects(() => system.canActivate(context), ForbiddenException);
});

test("contas inativas não podem executar ações administrativas", async () => {
  const db = { user: { findUnique: async () => ({ isActive: false, globalRole: "SYSTEM" }) } };
  await assert.rejects(() => new PlatformStaffGuard(db as never).canActivate(context), ForbiddenException);
  await assert.rejects(() => new SystemGuard(db as never).canActivate(context), ForbiddenException);
});

test("cadastro de managers valida credenciais e status", async () => {
  const dto = Object.assign(new CreateManagerDto(), {
    name: "João Silva", username: "joaosilva", email: "joao@example.com",
    whatsapp: "32999999999", password: "senha-muito-forte",
  });
  assert.deepEqual(await validate(dto), []);
  dto.username = "João Admin"; dto.password = "curta";
  assert.ok((await validate(dto)).length >= 2);
  const status = Object.assign(new ManagerStatusDto(), { active: "false" });
  assert.deepEqual(await validate(status), []);
  status.active = "maybe";
  assert.ok((await validate(status)).length > 0);
});

test("criar MANAGER grava o papel correto, nunca retorna senha, e audita", async () => {
  let created: Record<string, unknown> | undefined;
  const actions: string[] = [];
  const tx = {
    user: {
      findFirst: async () => null,
      create: async (params: { data: Record<string, unknown> }) => {
        created = params.data;
        return { id: "manager-id", name: "João", username: "joao", isActive: true };
      },
    },
    platformAudit: { create: async (params: { data: { action: string } }) => {
      actions.push(params.data.action); return {};
    } },
  };
  const service = new PlatformStaffService({ $transaction: async (fn: (client: unknown) => Promise<unknown>) => fn(tx) } as never);
  const user = await service.create("system-id", {
    name: "João", username: "joao", email: "joao@example.com",
    whatsapp: "32999999999", password: "senha-super-segura-2026",
  });
  assert.equal(created?.globalRole, "MANAGER");
  assert.equal(typeof created?.passwordHash, "string");
  assert.equal("password" in user, false);
  assert.deepEqual(actions, ["MANAGER_CREATED"]);
});

test("desativar manager revoga sessões e cria auditoria", async () => {
  const actions: string[] = [];
  let revoked = false;
  const tx = {
    user: {
      findFirst: async () => ({ id: "manager-id", username: "manager", isActive: true }),
      update: async () => ({}),
    },
    authSession: { updateMany: async () => { revoked = true; } },
    platformAudit: { create: async (params: { data: { action: string } }) => {
      actions.push(params.data.action); return {};
    } },
  };
  const service = new PlatformStaffService({ $transaction: async (fn: (client: unknown) => Promise<unknown>) => fn(tx) } as never);
  const result = await service.changeStatus("system-id", "manager-id", false);
  assert.equal(result.isActive, false);
  assert.equal(revoked, true);
  assert.deepEqual(actions, ["MANAGER_DEACTIVATED"]);
});
