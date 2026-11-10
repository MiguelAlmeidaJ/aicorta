import "reflect-metadata";
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { TenantRoleGuard } from "./tenant-role.guard";
import { ServiceCatalogService } from "./services";

function ctx(tenantId: string, userId = "user-a") {
  return {
    getHandler: () => ({}), getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ params: { tenantId }, user: { id: userId } }) }),
  } as never;
}
const reflector = { getAllAndOverride: () => ["ADMIN"] } as unknown as Reflector;

test("ADMIN ativo pode operar somente o próprio estabelecimento", async () => {
  const db = { membership: { findUnique: async ({ where }: { where: { userId_tenantId: { tenantId: string } } }) =>
    where.userId_tenantId.tenantId === "tenant-a"
      ? { role: "ADMIN", isActive: true, tenant: { status: "ACTIVE" } } : null } };
  const guard = new TenantRoleGuard(db as never, reflector, { refreshTenantState: async () => ({ operational: true }) } as never);
  assert.equal(await guard.canActivate(ctx("tenant-a")), true);
  await assert.rejects(() => guard.canActivate(ctx("tenant-b")), ForbiddenException);
});

test("funcionário e estabelecimento suspenso não gerenciam serviços", async () => {
  for (const membership of [
    { role: "EMPLOYEE", isActive: true, tenant: { status: "ACTIVE" } },
    { role: "ADMIN", isActive: true, tenant: { status: "SUSPENDED" } },
    { role: "ADMIN", isActive: false, tenant: { status: "ACTIVE" } },
  ]) {
    const db = { membership: { findUnique: async () => membership } };
    const guard = new TenantRoleGuard(db as never, reflector, { refreshTenantState: async () => ({ operational: membership.tenant.status === "ACTIVE" }) } as never);
    await assert.rejects(() => guard.canActivate(ctx("tenant-a")), ForbiddenException);
  }
});

test("atualização usa chave composta para impedir alteração entre tenants", async () => {
  let updated: unknown;
  const db = { service: {
    findFirst: async () => ({ id: "service-a" }),
    update: async (params: unknown) => { updated = params; return params; },
  } };
  const catalog = new ServiceCatalogService(db as never);
  await catalog.update("tenant-a", "service-a", { priceCents: 3500 });
  assert.deepEqual((updated as { where: unknown }).where, {
    id_tenantId: { id: "service-a", tenantId: "tenant-a" },
  });
});
