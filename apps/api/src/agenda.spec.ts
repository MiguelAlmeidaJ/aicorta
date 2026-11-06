import { strict as assert } from "node:assert";
import { test } from "node:test";
import { inside, localParts, localToUtc, overlaps, validDate, validWindows, weekday } from "./scheduling-time";
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
