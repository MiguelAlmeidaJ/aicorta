import "reflect-metadata";
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { validate } from "class-validator";
import { ChangeTenantStatusDto, DashboardService } from "./dashboard";

test("tenant status DTO accepts only ACTIVE or SUSPENDED", async () => {
  const dto = new ChangeTenantStatusDto();
  dto.status = "INVALID" as "ACTIVE";
  assert.ok((await validate(dto)).length);
  dto.status = "ACTIVE";
  assert.equal((await validate(dto)).length, 0);
});

test("status change targets one tenant by ID", async () => {
  let where: unknown;
  const db = { tenant: { update: async (args: { where: unknown }) => {
    where = args.where;
    return { id: "barbearia-a", name: "Barbearia A", status: "SUSPENDED" };
  } } };
  const service = new DashboardService(db as never);
  const result = await service.setTenantStatus("barbearia-a", "SUSPENDED");
  assert.deepEqual(where, { id: "barbearia-a" });
  assert.equal(result.status, "SUSPENDED");
});
