import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { Pool } from "pg";

const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString) throw new Error("Defina TEST_DATABASE_URL para executar os testes de banco");

const databaseName = new URL(connectionString).pathname.slice(1);
if (!/(test|verify)/i.test(databaseName)) {
  throw new Error("TEST_DATABASE_URL deve apontar para um banco com 'test' ou 'verify' no nome");
}

const pool = new Pool({ connectionString, max: 5 });
const ids = {
  owner: randomUUID(),
  client: randomUUID(),
  tenant: randomUUID(),
  employee: randomUUID(),
  service: randomUUID(),
};

before(async () => {
  const now = new Date();
  await pool.query(
    `INSERT INTO "User" (id, name, username, email, whatsapp, "passwordHash", "updatedAt")
     VALUES ($1, 'Owner', $2, $3, $4, 'test-hash', $5),
            ($6, 'Client', $7, $8, $9, 'test-hash', $5)`,
    [
      ids.owner, `owner-${ids.owner}`, `${ids.owner}@test.local`, `+55${ids.owner.replaceAll("-", "").slice(0, 11)}`, now,
      ids.client, `client-${ids.client}`, `${ids.client}@test.local`, `+56${ids.client.replaceAll("-", "").slice(0, 11)}`,
    ],
  );
  await pool.query(
    `INSERT INTO "Tenant" (id, name, slug, "ownerId", "updatedAt")
     VALUES ($1, 'Integration tenant', $2, $3, $4)`,
    [ids.tenant, `integration-${ids.tenant}`, ids.owner, now],
  );
  await pool.query(
    `INSERT INTO "Membership" (id, "userId", "tenantId", role, "updatedAt")
     VALUES ($1, $2, $3, 'ADMIN', $4)`,
    [ids.employee, ids.owner, ids.tenant, now],
  );
  await pool.query(
    `INSERT INTO "Service" (id, "tenantId", name, "durationMinutes", "priceCents", "updatedAt")
     VALUES ($1, $2, 'Integration service', 30, 5000, $3)`,
    [ids.service, ids.tenant, now],
  );
});

after(async () => {
  await pool.end();
});

test("clean migrations install the overlap constraint", async () => {
  const result = await pool.query<{ name: string }>(
    `SELECT conname AS name
       FROM pg_constraint
      WHERE conname IN ('appointment_valid_time_range', 'appointment_professional_no_overlap')
      ORDER BY conname`,
  );
  assert.deepEqual(result.rows.map((row) => row.name), [
    "appointment_professional_no_overlap",
    "appointment_valid_time_range",
  ]);
});

test("clean migrations install financial integrity constraints", async () => {
  const indexes = await pool.query<{ name: string }>(
    `SELECT indexname AS name FROM pg_indexes
      WHERE schemaname = 'public' AND indexname = 'cash_session_one_open_per_tenant'`,
  );
  assert.deepEqual(indexes.rows.map(row => row.name), ["cash_session_one_open_per_tenant"]);
  const constraints = await pool.query<{ name: string }>(
    `SELECT conname AS name FROM pg_constraint
      WHERE conname IN ('CashSession_non_negative_balances', 'Payment_positive_amount', 'CashMovement_positive_amount')
      ORDER BY conname`,
  );
  assert.deepEqual(constraints.rows.map(row => row.name), [
    "CashMovement_positive_amount", "CashSession_non_negative_balances", "Payment_positive_amount",
  ]);
});

test("PostgreSQL accepts only one concurrent overlapping active appointment", async () => {
  const startsAt = new Date("2035-01-15T12:00:00.000Z");
  const endsAt = new Date("2035-01-15T12:30:00.000Z");

  const insert = async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO "Appointment"
          (id, "tenantId", "serviceId", "employeeMembershipId", "clientId", "startsAt", "endsAt", "priceCents", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, 5000, NOW())`,
        [randomUUID(), ids.tenant, ids.service, ids.employee, ids.client, startsAt, endsAt],
      );
      await client.query("COMMIT");
      return "accepted" as const;
    } catch (error) {
      await client.query("ROLLBACK");
      // Two perfectly simultaneous GiST checks may abort one transaction with
      // either an exclusion violation or PostgreSQL's deadlock protection.
      if (typeof error === "object" && error !== null && "code" in error &&
          (error.code === "23P01" || error.code === "40P01")) {
        return "rejected" as const;
      }
      throw error;
    } finally {
      client.release();
    }
  };

  const outcomes = await Promise.all([insert(), insert()]);
  assert.deepEqual(outcomes.sort(), ["accepted", "rejected"]);

  await pool.query(
    `INSERT INTO "Appointment"
      (id, "tenantId", "serviceId", "employeeMembershipId", "clientId", "startsAt", "endsAt", status, "priceCents", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'CANCELLED', 5000, NOW())`,
    [randomUUID(), ids.tenant, ids.service, ids.employee, ids.client, startsAt, endsAt],
  );

  const count = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM "Appointment" WHERE "tenantId" = $1`,
    [ids.tenant],
  );
  assert.equal(count.rows[0]?.count, "2");
});
