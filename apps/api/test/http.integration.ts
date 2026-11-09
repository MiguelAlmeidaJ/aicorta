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
let concurrentClientCookie = "";
let employeeCookie = "";
let tenantA = "";
let tenantB = "";
let slugA = "";
let ownerMembershipA = "";
let serviceId = "";
let clientId = "";
let serviceOrderId = "";
let serviceOrderTotal = 0;

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
  app = await NestFactory.create(AppModule, { logger: ["error", "warn"] });
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
    const manual = await request("POST", "/api/system/tenants", {
      name: "Barbearia Manual E2E", slug: `manual-${suffix}`, billingDueDay: 12,
      ownerName: "Proprietário Manual", ownerUsername: `manual${suffix}`,
      ownerEmail: `manual-${suffix}@example.test`, ownerWhatsapp: makePhone(20),
      ownerPassword: password,
    }, systemCookie);
    assert.equal(manual.status, 201, JSON.stringify(manual.json));
    const manualTenant = manual.json as unknown as { id: string; owner: { id: string } };
    ids.tenants.push(manualTenant.id); ids.users.push(manualTenant.owner.id);
    const membership = await db.membership.findUnique({
      where: { userId_tenantId: { userId: manualTenant.owner.id, tenantId: manualTenant.id } },
    });
    assert.equal(membership?.role, "ADMIN");
    const ownerLogin = await request("POST", "/api/auth/login", {
      identifier: `manual${suffix}`, password,
    });
    assert.equal(ownerLogin.status, 201);
    assert.equal((await request("POST", "/api/system/tenants", {
      name: "Sem permissão", slug: `denied-${suffix}`, billingDueDay: 10,
      ownerName: "Sem permissão", ownerUsername: `denied${suffix}`,
      ownerEmail: `denied-${suffix}@example.test`, ownerWhatsapp: makePhone(21), ownerPassword: password,
    }, cookies(ownerLogin.headers))).status, 403);
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
    assert.equal(await db.employeeService.count({
      where: { serviceId, membershipId: ownerMembershipA },
    }), 1, "Serviço sem seleção explícita deve ser vinculado ao proprietário");
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
    for (let i = 0; i < 3; i++) {
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
      } else if (i === 1) otherClientCookie = cookies(created.headers);
      else concurrentClientCookie = cookies(created.headers);
    }
    assert.equal((await request("GET", `/api/tenants/${tenantA}/services/manage`, undefined, clientCookie)).status, 403);
    assert.equal((await request("GET", `/api/tenants/${tenantA}/agenda/hours`, undefined, clientCookie)).status, 403);
    assert.equal((await request("GET", `/api/tenants/${tenantA}/services/manage`)).status, 401);
    const lookup = await request("GET",
      `/api/tenants/${tenantA}/employees/lookup?email=${encodeURIComponent(`client-${suffix}-0@example.test`)}`,
      undefined, ownerCookie);
    assert.equal(lookup.status, 200, JSON.stringify(lookup.json));
    assert.equal(lookup.json.exists, true);
    assert.equal((await request("GET",
      `/api/tenants/${tenantA}/employees/lookup?email=${encodeURIComponent(`client-${suffix}-1@example.test`)}`,
      undefined, clientCookie)).status, 403);
    const linked = await request("POST", `/api/tenants/${tenantA}/employees`, {
      email: `client-${suffix}-0@example.test`,
    }, ownerCookie);
    assert.equal(linked.status, 201, JSON.stringify(linked.json));
    assert.equal(linked.json.role, "EMPLOYEE");
    const direct = await request("POST", `/api/tenants/${tenantA}/employees`, {
      email: `employee-${suffix}@example.test`, name: "Funcionário Direto",
      username: `employee${suffix}`, whatsapp: makePhone(30), password,
    }, ownerCookie);
    assert.equal(direct.status, 201, JSON.stringify(direct.json));
    const directUser = direct.json.user as { id: string };
    ids.users.push(directUser.id);
    const employeeLogin = await request("POST", "/api/auth/login", {
      identifier: `employee${suffix}`, password,
    });
    assert.equal(employeeLogin.status, 201);
    employeeCookie = cookies(employeeLogin.headers);
    assert.equal((await request("GET", `/api/tenants/${tenantA}/dashboard`,
      undefined, employeeCookie)).status, 200);
    const team = await request("GET", `/api/tenants/${tenantA}/employees`, undefined, ownerCookie);
    assert.equal(team.status, 200, JSON.stringify(team.json));
    const people = team.json as unknown as Array<{ id: string; role: string; isOwner: boolean; appearsInAgenda: boolean }>;
    assert.ok(people.some(person => person.id === ownerMembershipA &&
      person.role === "ADMIN" && person.isOwner && person.appearsInAgenda));
    const exclude = await request("PATCH",
      `/api/tenants/${tenantA}/employees/${ownerMembershipA}/agenda`,
      { appearsInAgenda: false }, ownerCookie);
    assert.equal(exclude.status, 200, JSON.stringify(exclude.json));
    const unavailable = await request("GET", `/api/b/${slugA}`);
    assert.equal(unavailable.status, 200);
    assert.ok(!(unavailable.json.professionals as Array<{ id: string }>).some(person => person.id === ownerMembershipA));
    assert.equal((await request("PATCH",
      `/api/tenants/${tenantA}/employees/${ownerMembershipA}/agenda`,
      { appearsInAgenda: true }, secondOwnerCookie)).status, 403);
    const restore = await request("PATCH",
      `/api/tenants/${tenantA}/employees/${ownerMembershipA}/agenda`,
      { appearsInAgenda: true }, ownerCookie);
    assert.equal(restore.status, 200);
    const availableAgain = await request("GET", `/api/b/${slugA}`);
    assert.ok((availableAgain.json.professionals as Array<{ id: string }>).some(person => person.id === ownerMembershipA));
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
      request("POST", `/api/b/${slugA}/bookings`, payload, otherClientCookie),
      request("POST", `/api/b/${slugA}/bookings`, payload, concurrentClientCookie),
    ]);
    assert.deepEqual([a.status, b.status].sort(), [201, 409], JSON.stringify({ a, b }));
    const count = await db.appointment.count({
      where: { tenantId: tenantA, employeeMembershipId: ownerMembershipA,
        startsAt: new Date(slots[0]), status: { in: ["PENDING", "CONFIRMED"] } },
    });
    assert.equal(count, 1);
    const accepted = a.status === 201 ? a : b;
    const acceptedCookie = a.status === 201 ? otherClientCookie : concurrentClientCookie;
    const bookingId = String(accepted.json.id);
    assert.equal((await request("PATCH", `/api/tenants/${tenantB}/appointments/${bookingId}/confirm`,
      undefined, secondOwnerCookie)).status, 409);
    const confirmed = await request("PATCH",
      `/api/tenants/${tenantA}/appointments/${bookingId}/confirm`, undefined, ownerCookie);
    assert.equal(confirmed.status, 200);
    const forbiddenCancel = await request("PATCH", `/api/b/${slugA}/bookings/${bookingId}/cancel`,
      undefined, acceptedCookie === otherClientCookie ? concurrentClientCookie : otherClientCookie);
    assert.equal(forbiddenCancel.status, 403);
    const forbiddenReschedule = await request("PATCH", `/api/b/${slugA}/bookings/${bookingId}/reschedule`,
      { startsAt: slots[0] }, acceptedCookie === otherClientCookie ? concurrentClientCookie : otherClientCookie);
    assert.equal(forbiddenReschedule.status, 403);
    const mine = await request("GET", "/api/my/bookings", undefined, acceptedCookie);
    assert.equal(mine.status, 200);
    const myBookings = mine.json as unknown as { tenant: { timezone: string }; id: string }[];
    assert.ok(myBookings.some(item => item.id === bookingId && item.tenant.timezone === "America/Sao_Paulo"),
      "A interface do cliente precisa do fuso da barbearia para mostrar os horários corretamente");
    const cancel = await request("PATCH", `/api/b/${slugA}/bookings/${bookingId}/cancel`,
      undefined, acceptedCookie);
    assert.equal(cancel.status, 200);
    const reuse = await request("POST", `/api/b/${slugA}/bookings`, payload,
      acceptedCookie === otherClientCookie ? concurrentClientCookie : otherClientCookie);
    assert.equal(reuse.status, 201);
    const reusedId = String(reuse.json.id);
    const reusedCookie = acceptedCookie === otherClientCookie ? concurrentClientCookie : otherClientCookie;
    const nextDay = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
    const nextAvailability = await request("GET",
      `/api/b/${slugA}/slots?serviceId=${serviceId}&membershipId=${ownerMembershipA}&date=${nextDay}`);
    const nextSlots = nextAvailability.json.slots as string[];
    assert.ok(nextSlots.length > 0);
    const rescheduled = await request("PATCH", `/api/b/${slugA}/bookings/${reusedId}/reschedule`,
      { startsAt: nextSlots[0] }, reusedCookie);
    assert.equal(rescheduled.status, 200, JSON.stringify(rescheduled.json));
    assert.equal(rescheduled.json.status, "PENDING");
    assert.equal(rescheduled.json.startsAt, nextSlots[0]);
  });

  await t.test("check-in, adicionais, desconto e encerramento preservam historico", async () => {
    const appointment = await db.appointment.findFirstOrThrow({
      where: { tenantId: tenantA, status: "PENDING" }, orderBy: { createdAt: "desc" },
    });
    await db.appointment.update({ where: { id: appointment.id }, data: {
      status: "CONFIRMED", startsAt: new Date(Date.now() - 10 * 60_000),
      endsAt: new Date(Date.now() + 20 * 60_000),
    } });
    const checkedIn = await request("POST",
      `/api/tenants/${tenantA}/appointments/${appointment.id}/check-in`, undefined, ownerCookie);
    assert.equal(checkedIn.status, 201, JSON.stringify(checkedIn.json));
    const orderId = String(checkedIn.json.id);
    serviceOrderId = orderId;
    const duplicate = await request("POST",
      `/api/tenants/${tenantA}/appointments/${appointment.id}/check-in`, undefined, ownerCookie);
    assert.equal(duplicate.status, 201);
    assert.equal(duplicate.json.id, orderId);
    assert.equal((await request("PATCH", `/api/tenants/${tenantA}/service-orders/${orderId}/start`,
      undefined, ownerCookie)).status, 200);
    const added = await request("POST", `/api/tenants/${tenantA}/service-orders/${orderId}/items`, {
      description: "Hidratacao", quantity: 1, unitPriceCents: 1500,
    }, ownerCookie);
    assert.equal(added.status, 201, JSON.stringify(added.json));
    const discounted = await request("PATCH", `/api/tenants/${tenantA}/service-orders/${orderId}/discount`, {
      discountCents: 500, reason: "Cortesia autorizada",
    }, ownerCookie);
    assert.equal(discounted.status, 200, JSON.stringify(discounted.json));
    assert.equal(Number(discounted.json.totalCents), Number(discounted.json.subtotalCents) - 500);
    const closed = await request("PATCH", `/api/tenants/${tenantA}/service-orders/${orderId}/close`,
      undefined, ownerCookie);
    assert.equal(closed.status, 200, JSON.stringify(closed.json));
    assert.equal(closed.json.status, "CLOSED");
    serviceOrderTotal = Number(closed.json.totalCents);
    const events = closed.json.events as { type: string }[];
    assert.deepEqual(events.map(event => event.type), [
      "CHECKED_IN", "STARTED", "ITEM_ADDED", "DISCOUNT_APPLIED", "CLOSED",
    ]);
    assert.equal((await db.appointment.findUniqueOrThrow({ where: { id: appointment.id } })).status, "COMPLETED");
    assert.equal((await request("GET", `/api/tenants/${tenantB}/service-orders/${orderId}`,
      undefined, secondOwnerCookie)).status, 400);
  });

  await t.test("caixa recebe pagamento dividido, movimentos, estorno e fechamento", async () => {
    const opened = await request("POST", `/api/tenants/${tenantA}/cash-sessions/open`, {
      openingBalanceCents: 10000, notes: "Abertura E2E",
    }, ownerCookie);
    assert.equal(opened.status, 201, JSON.stringify(opened.json));
    assert.equal(opened.json.expectedBalanceCents, 10000);
    assert.equal((await request("POST", `/api/tenants/${tenantA}/cash-sessions/open`, {
      openingBalanceCents: 0,
    }, ownerCookie)).status, 409);
    assert.equal((await request("POST", `/api/tenants/${tenantA}/cash-sessions/current/movements`, {
      type: "SUPPLY", amountCents: 100, reason: "Sem permissao",
    }, employeeCookie)).status, 403);

    const cashPart = Math.min(2000, serviceOrderTotal);
    const otherPart = serviceOrderTotal - cashPart;
    const parts = [
      { method: "CASH", amountCents: cashPart },
      ...(otherPart ? [{ method: "PIX", amountCents: otherPart, reference: "pix-e2e" }] : []),
    ];
    const received = await request("POST",
      `/api/tenants/${tenantA}/service-orders/${serviceOrderId}/payments`, { parts }, ownerCookie);
    assert.equal(received.status, 201, JSON.stringify(received.json));
    assert.equal(received.json.remainingCents, 0);
    assert.equal((await request("POST",
      `/api/tenants/${tenantA}/service-orders/${serviceOrderId}/payments`, {
        parts: [{ method: "PIX", amountCents: 1 }],
      }, ownerCookie)).status, 400);

    const supplied = await request("POST", `/api/tenants/${tenantA}/cash-sessions/current/movements`, {
      type: "SUPPLY", amountCents: 1000, reason: "Reforco para troco",
    }, ownerCookie);
    assert.equal(supplied.status, 201, JSON.stringify(supplied.json));
    const withdrawn = await request("POST", `/api/tenants/${tenantA}/cash-sessions/current/movements`, {
      type: "WITHDRAWAL", amountCents: 500, reason: "Sangria preventiva",
    }, ownerCookie);
    assert.equal(withdrawn.status, 201, JSON.stringify(withdrawn.json));
    assert.equal(withdrawn.json.expectedBalanceCents, 10000 + cashPart + 1000 - 500);

    const paymentRows = received.json.payments as { id: string; method: string }[];
    const nonCash = paymentRows.find(item => item.method !== "CASH");
    if (nonCash) {
      const voided = await request("PATCH", `/api/tenants/${tenantA}/payments/${nonCash.id}/void`, {
        reason: "Estorno E2E",
      }, ownerCookie);
      assert.equal(voided.status, 200, JSON.stringify(voided.json));
      assert.equal(voided.json.remainingCents, otherPart);
      const repaid = await request("POST",
        `/api/tenants/${tenantA}/service-orders/${serviceOrderId}/payments`, {
          parts: [{ method: "PIX", amountCents: otherPart, reference: "pix-e2e-2" }],
        }, ownerCookie);
      assert.equal(repaid.status, 201, JSON.stringify(repaid.json));
      assert.equal(repaid.json.remainingCents, 0);
    }

    const expected = 10000 + cashPart + 1000 - 500;
    const closed = await request("PATCH", `/api/tenants/${tenantA}/cash-sessions/current/close`, {
      countedBalanceCents: expected - 100, notes: "Diferenca E2E",
    }, ownerCookie);
    assert.equal(closed.status, 200, JSON.stringify(closed.json));
    assert.equal(closed.json.expectedBalanceCents, expected);
    assert.equal(closed.json.differenceCents, -100);
    assert.equal((await request("GET", `/api/tenants/${tenantA}/cash-sessions/current`,
      undefined, ownerCookie)).json, null);
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
