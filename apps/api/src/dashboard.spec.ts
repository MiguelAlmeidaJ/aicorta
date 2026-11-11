import "reflect-metadata";
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { validate } from "class-validator";
import { ChangeTenantStatusDto, CreateTenantDto, DashboardService } from "./dashboard";

test("tenant status DTO accepts only ACTIVE or SUSPENDED", async () => {
  const dto = new ChangeTenantStatusDto();
  dto.status = "INVALID" as "ACTIVE";
  assert.ok((await validate(dto)).length);
  dto.status = "ACTIVE";
  assert.equal((await validate(dto)).length, 0);
});

test("status change targets one tenant by ID", async () => {
  let where: unknown;
  const db = { $transaction: async (run: (tx: unknown) => Promise<unknown>) => run(db), tenant: { update: async (args: { where: unknown }) => {
    where = args.where;
    return { id: "barbearia-a", name: "Barbearia A", status: "SUSPENDED" };
  } } };
  const service = new DashboardService(db as never);
  const result = await service.setTenantStatus("barbearia-a", "SUSPENDED");
  assert.deepEqual(where, { id: "barbearia-a" });
  assert.equal(result.status, "SUSPENDED");
});

test("manual tenant DTO validates the owner account and public slug", async () => {
  const dto = Object.assign(new CreateTenantDto(), {
    name: "Barbearia Central", slug: "Barbearia Central", billingDueDay: 10,
    ownerName: "João", ownerUsername: "joao_admin", ownerEmail: "inválido",
    ownerWhatsapp: "32999999999", ownerPassword: "curta",
  });
  assert.ok((await validate(dto)).length >= 4);
  Object.assign(dto, {
    slug: "barbearia-central", ownerUsername: "joaoadmin",
    ownerEmail: "joao@example.com", ownerPassword: "senha-forte-2026",
  });
  assert.equal((await validate(dto)).length, 0);
});

test("manual tenant creation creates owner, tenant and ADMIN membership atomically", async () => {
  const operations: string[] = [];
  const tx = {
    user: {
      findFirst: async () => null,
      create: async () => { operations.push("owner"); return { id: "owner-1" }; },
    },
    tenant: {
      create: async () => { operations.push("tenant"); return { id: "tenant-1" }; },
      findUniqueOrThrow: async () => ({ id: "tenant-1", name: "Barbearia Central", status: "ACTIVE" }),
    },
    membership: {
      create: async (args: { data: { role: string } }) => {
        operations.push(args.data.role); return { id: "membership-1" };
      },
    },
  };
  const db = { $transaction: async (run: (client: typeof tx) => unknown) => run(tx) };
  const service = new DashboardService(db as never);
  const result = await service.createTenant({
    name: "Barbearia Central", slug: "barbearia-central", billingDueDay: 10,
    ownerName: "João", ownerUsername: "joaoadmin", ownerEmail: "joao@example.com",
    ownerWhatsapp: "32999999999", ownerPassword: "senha-forte-2026",
  });
  assert.deepEqual(operations, ["owner", "tenant", "ADMIN"]);
  assert.equal(result.id, "tenant-1");
});
