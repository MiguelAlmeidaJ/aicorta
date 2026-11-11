import { strict as assert } from "node:assert";
import { test } from "node:test";
import { bookingDateRange, inside, insideBookingHorizon, meetsBookingNotice, MIN_BOOKING_NOTICE_MS, localParts, localToUtc, overlaps, validDate, validWindows, weekday } from "./scheduling-time";
test("rejects overlapping or invalid weekly windows", () => {
  assert.equal(validWindows([{ weekday: 1, startMinute: 540, endMinute: 720 },
    { weekday: 1, startMinute: 700, endMinute: 800 }]), false);
  assert.equal(validWindows([{ weekday: 1, startMinute: 540, endMinute: 720 },
    { weekday: 1, startMinute: 720, endMinute: 800 }]), true);
  assert.equal(validWindows([{ weekday: 8, startMinute: 0, endMinute: 60 }]), false);
});
test("Brazilian local wall time maps to UTC", () => {
  const result = localToUtc("2026-11-09", 540, "America/Sao_Paulo");
  assert.equal(result?.toISOString(), "2026-11-09T12:00:00.000Z");
  assert.deepEqual(localParts(result!, "America/Sao_Paulo"), { date: "2026-11-09", minute: 540 });
  assert.equal(weekday("2026-11-09"), 1);
});
test("range checks use half-open intervals", () => {
  assert.equal(inside([{ startMinute: 540, endMinute: 720 }], 600, 720), true);
  assert.equal(inside([{ startMinute: 540, endMinute: 720 }], 700, 740), false);
  assert.equal(overlaps(new Date(0), new Date(1000), new Date(1000), new Date(2000)), false);
  assert.equal(overlaps(new Date(0), new Date(1001), new Date(1000), new Date(2000)), true);
});
test("rejects impossible local dates", () => {
  assert.equal(validDate("2026-02-30"), false);
  assert.equal(validDate("2026-12-15"), true);
});

test("limite configurado inclui dias das próximas semanas e bloqueia além do horizonte", () => {
  const now = new Date("2026-11-10T15:00:00.000Z");
  const range = bookingDateRange("America/Sao_Paulo", 21, now);
  assert.deepEqual(range, { today: "2026-11-10", lastDate: "2026-12-01" });
  assert.equal(insideBookingHorizon("2026-11-10", "America/Sao_Paulo", 21, now), true);
  assert.equal(insideBookingHorizon("2026-11-24", "America/Sao_Paulo", 21, now), true);
  assert.equal(insideBookingHorizon("2026-12-01", "America/Sao_Paulo", 21, now), true);
  assert.equal(insideBookingHorizon("2026-12-02", "America/Sao_Paulo", 21, now), false);
  assert.equal(insideBookingHorizon("2026-11-09", "America/Sao_Paulo", 21, now), false);
});
test("o fuso da barbearia, não o UTC, define o dia e o início do prazo", () => {
  const now = new Date("2026-11-11T01:30:00.000Z");
  assert.deepEqual(bookingDateRange("America/Sao_Paulo", 7, now),
    { today: "2026-11-10", lastDate: "2026-11-17" });
});

test("agendamento exige uma hora inteira de antecedência", () => {
  const now = new Date("2026-11-11T14:00:00.000Z");
  assert.equal(MIN_BOOKING_NOTICE_MS, 3600000);
  assert.equal(meetsBookingNotice(new Date("2026-11-11T14:59:59.999Z"), now), false);
  assert.equal(meetsBookingNotice(new Date("2026-11-11T15:00:00.000Z"), now), true);
  assert.equal(meetsBookingNotice(new Date("2026-11-11T15:15:00.000Z"), now), true);
  assert.equal(meetsBookingNotice(new Date("invalid"), now), false);
});
