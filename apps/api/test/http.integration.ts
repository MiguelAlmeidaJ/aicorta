import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import type { INestApplication } from "@nestjs/common";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { hash } from "bcryptjs";
import { PrismaService } from "../src/prisma.service";

const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString) throw new Error("TEST_DATABASE_URL é obrigatório para o teste E2E");
const dbName = new URL(connectionString).pathname.slice(1);
if (!/(test|verify)/i.test(dbName)) throw new Error("Banco E2E deve ter test ou verify no nome");
process.env.DATABASE_URL = connectionString;
process.env.JWT_SECRET = "e2e-only-secret-at-least-thirty-two-characters";
process.env.WEB_ORIGIN = "http://localhost:3000";
const suffix = randomUUID().replace(/-/g, "").slice(0, 12);
const password = "Senha-E2E-forte-2026!";
const ids: { users: string[]; tenants: string[] } = { users: [], tenants: [] };
let app: INestApplication;
let db: PrismaService;
let base: string;
let systemCookie = "";
let ownerCookie = "";
let secondOwnerCookie = "";
let clientCookie = "";
let otherClientCookie = "";
let tenantA = "";
let tenantB = "";
let slugA = "";
let ownerMembershipA = "";
let serviceId = "";
let clientId = "";

type JsonValue = Record<string, unknown>;
async function request(method: string, path: string, body?: object, cookie?: string) {
  const response = await fetch(base + path, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      Origin: "http://localhost:3000",
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  const json = (await response.json().catch(() => ({}))) as JsonValue;
  return { status: response.status, json, headers: response.headers };
}
function cookies(headers: Headers) {
  return headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
}
function makePhone(offset: number) {
  // Unique, valid 11-digit BR number: DDD + 9 + 8 digits.
  const value = Number.parseInt(suffix.slice(0, 7), 16) + offset;
  return "329" + String(value % 100000000).padStart(8, "0");
}
async function createOwner(label: string) {
  const invite = await request("POST", "/api/auth/owner-invites", {
    referenceName: label, billingDueDay: 15,
  }, systemCookie);
  assert.equal(invite.status, 201, JSON.stringify(invite.json));
  const token = new URL(String(invite.json.registrationUrl)).searchParams.get("token");
  assert.ok(token);
  const dto = {
    name: label, username: `owner${suffix.slice(0, 7)}${label === "Barbearia B" ? "b" : "a"}`,
    email: `owner-${label.endsWith("B") ? "b" : "a"}-${suffix}@example.test`,
    whatsapp: makePhone(label.endsWith("B") ? 2 : 1),
    password, businessName: label, inviteToken: token,
  };
  const created = await request("POST", "/api/auth/register", dto);
  assert.equal(created.status, 201, JSON.stringify(created.json));
  const tenant = created.json.tenant as { id: string; slug: string };
  ids.tenants.push(tenant.id);
  if (label === "Barbearia A") {
    const replay = await request("POST", "/api/auth/register", {
      ...dto, username: dto.username + "replay",
    });
    assert.equal(replay.status, 400, "Um token de cadastro não pode ser reutilizado");
  }
  ids.users.push((created.json.user as { id: string }).id);
  return { cookie: cookies(created.headers), tenant };
}

before(async () => {
  const { AppModule } = await import("../src/app.module.js");
  app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix("api");
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, forbidNonWhitelisted: true, transform: true,
  }));
  await app.listen(0, "127.0.0.1");
  const address = app.getHttpServer().address() as { port: number };
  base = `http://127.0.0.1:${address.port}`;
  db = app.get(PrismaService);
  const sys = await db.user.create({
    data: {
      name: "SYSTEM E2E", username: `sys${suffix}`, email: `sys-${suffix}@example.test`,
      whatsapp: makePhone(0), passwordHash: await hash(password, 10), globalRole: "SYSTEM",
    },
  });
  ids.users.push(sys.id);
});

after(async () => {
  if (db) {
    // Remove only records created by this run; never clean an entire shared DB.
    await db.tenant.deleteMany({ where: { id: { in: ids.tenants } } });
    await db.ownerInvite.deleteMany({ where: { issuedById: { in: ids.users } } });
    await db.user.deleteMany({ where: { id: { in: ids.users } } });
  }
  if (app) await app.close();
});

test("E2E HTTP: onboarding, acesso entre tenants, agendamentos e concorrência", async t => {
  await t.test("SYSTEM autenticado controla convites, mas não ignora RBAC do tenant", async () => {
    const login = await request("POST", "/api/auth/login", {
      identifier: `sys${suffix}`, password,
    });
    assert.equal(login.status, 201);
    systemCookie = cookies(login.headers);
    assert.ok(systemCookie.includes("aicorta_access="));
    const allowed = await request("GET", "/api/system/dashboard", undefined, systemCookie);
    assert.equal(allowed.status, 200);
  });

  await t.test("convite de proprietário de uso único cria dois tenants isolados", async () => {
    const a = await createOwner("Barbearia A");
    tenantA = a.tenant.id; slugA = a.tenant.slug; ownerCookie = a.cookie;
    const b = await createOwner("Barbearia B");
    tenantB = b.tenant.id; secondOwnerCookie = b.cookie;

    const aProfile = await request("GET", "/api/auth/me", undefined, ownerCookie);
    assert.equal(aProfile.status, 200);
    const aRoles = aProfile.json.memberships as { tenantId: string; role: string }[];
    assert.ok(aRoles.some(m => m.tenantId === tenantA && m.role === "ADMIN"));
    assert.equal((await request("GET", `/api/tenants/${tenantB}/dashboard`, undefined, ownerCookie)).status, 403);
    assert.equal((await request("GET", `/api/tenants/${tenantA}/services/manage`, undefined, secondOwnerCookie)).status, 403);
    assert.equal((await request("GET", `/api/tenants/${tenantA}/dashboard`, undefined, systemCookie)).status, 403);
    assert.equal((await request("GET", "/api/system/tenants", undefined, ownerCookie)).status, 403);
  });

  await t.test("configuração de agenda e cadastro independente de clientes", async () => {
    const create = await request("POST", `/api/tenants/${tenantA}/services`, {
      name: "Corte E2E", durationMinutes: 30, priceCents: 4500,
    }, ownerCookie);
    assert.equal(create.status, 201, JSON.stringify(create.json));
    serviceId = String(create.json.id);
    const profile = await request("GET", "/api/auth/me", undefined, ownerCookie);
    const memberships = profile.json.memberships as { tenantId: string; role: string }[];
    assert.ok(memberships.some(m => m.tenantId === tenantA && m.role === "ADMIN"));
    const user = await db.user.findUniqueOrThrow({
      where: { username: `owner${suffix.slice(0, 7)}a` },
      include: { memberships: true },
    });
    const membershipId = user.memberships.find(m => m.tenantId === tenantA)?.id;
    assert.ok(membershipId);
    ownerMembershipA = membershipId;
    const windows = Array.from({ length: 7 }, (_, weekday) => ({
      weekday, startMinute: 540, endMinute: 1200,
    }));
    const shop = await request("PUT", `/api/tenants/${tenantA}/agenda/hours`, { windows }, ownerCookie);
    assert.equal(shop.status, 200, JSON.stringify(shop.json));
    const staff = await request("PUT", `/api/tenants/${tenantA}/agenda/professionals/${membershipId}/hours`, { windows }, ownerCookie);
    assert.equal(staff.status, 200, JSON.stringify(staff.json));
    const assign = await request("PUT", `/api/tenants/${tenantA}/agenda/professionals/${membershipId}/services`, {
      serviceIds: [serviceId],
    }, ownerCookie);
    assert.equal(assign.status, 200, JSON.stringify(assign.json));
    for (let i = 0; i < 2; i++) {
      const userDto = {
        name: `Cliente E2E ${i}`, username: `client${suffix.slice(0, 7)}${i}`,
        email: `client-${suffix}-${i}@example.test`, whatsapp: makePhone(i + 3),
        password,
      };
      const created = await request("POST", "/api/auth/register-client", userDto);
      assert.equal(created.status, 201, JSON.stringify(created.json));
      ids.users.push((created.json.user as { id: string }).id);
      if (i === 0) {
        clientCookie = cookies(created.headers);
        clientId = (created.json.user as { id: string }).id;
      } else otherClientCookie = cookies(created.headers);
    }
    assert.equal((await request("GET", `/api/tenants/${tenantA}/services/manage`, undefined, clientCookie)).status, 403);
    assert.equal((await request("GET", `/api/tenants/${tenantA}/agenda/hours`, undefined, clientCookie)).status, 403);
    assert.equal((await request("GET", `/api/tenants/${tenantA}/services/manage`)).status, 401);
  });

  await t.test("duas reservas HTTP simultâneas não duplicam o mesmo horário", async () => {
    const day = new Date(Date.now() + 9 * 86_400_000).toISOString().slice(0, 10);
    const available = await request("GET",
      `/api/b/${slugA}/slots?serviceId=${serviceId}&membershipId=${ownerMembershipA}&date=${day}`);
    assert.equal(available.status, 200, JSON.stringify(available.json));
    const slots = available.json.slots as string[];
    assert.ok(slots.length > 0, "Configuração deve produzir horários disponíveis");
    const payload = { serviceId, employeeMembershipId: ownerMembershipA, startsAt: slots[0] };
    const [a, b] = await Promise.all([
      request("POST", `/api/b/${slugA}/bookings`, payload, clientCookie),
      request("POST", `/api/b/${slugA}/bookings`, payload, otherClientCookie),
    ]);
    assert.deepEqual([a.status, b.status].sort(), [201, 409]);
    const count = await db.appointment.count({
      where: { tenantId: tenantA, employeeMembershipId: ownerMembershipA,
        startsAt: new Date(slots[0]), status: { in: ["PENDING", "CONFIRMED"] } },
    });
    assert.equal(count, 1);
    const accepted = a.status === 201 ? a : b;
    const acceptedCookie = a.status === 201 ? clientCookie : otherClientCookie;
    const bookingId = String(accepted.json.id);
    assert.equal((await request("PATCH", `/api/tenants/${tenantB}/appointments/${bookingId}/confirm`,
      undefined, secondOwnerCookie)).status, 409);
    const confirmed = await request("PATCH",
      `/api/tenants/${tenantA}/appointments/${bookingId}/confirm`, undefined, ownerCookie);
    assert.equal(confirmed.status, 200);
    assert.equal((await request("GET", "/api/my/bookings", undefined, acceptedCookie)).status, 200);
    const cancel = await request("PATCH", `/api/b/${slugA}/bookings/${bookingId}/cancel`,
      undefined, acceptedCookie);
    assert.equal(cancel.status, 200);
    const reuse = await request("POST", `/api/b/${slugA}/bookings`, payload,
      acceptedCookie === clientCookie ? otherClientCookie : clientCookie);
    assert.equal(reuse.status, 201);
  });

  await t.test("refresh rotativo não pode ser reutilizado", async () => {
    const login = await request("POST", "/api/auth/login", {
      identifier: `sys${suffix}`, password,
    });
    assert.equal(login.status, 201);
    const oldCookies = cookies(login.headers);
    const first = await request("POST", "/api/auth/refresh", undefined, oldCookies);
    assert.equal(first.status, 201);
    const replay = await request("POST", "/api/auth/refresh", undefined, oldCookies);
    assert.equal(replay.status, 401);
  });
});
