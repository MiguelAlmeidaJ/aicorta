export type Window = { startMinute: number; endMinute: number };
export function overlaps(a: Date, b: Date, c: Date, d: Date) { return a < d && c < b; }
export function validWindows(rows: { weekday: number; startMinute: number; endMinute: number }[]) {
  const groups = new Map<number, Window[]>();
  for (const w of rows) {
    if (!Number.isInteger(w.weekday) || w.weekday < 0 || w.weekday > 6 ||
      !Number.isInteger(w.startMinute) || !Number.isInteger(w.endMinute) ||
      w.startMinute < 0 || w.endMinute > 1440 || w.startMinute >= w.endMinute) return false;
    groups.set(w.weekday, [...(groups.get(w.weekday) ?? []), w]);
  }
  return [...groups.values()].every(g => {
    g.sort((a, b) => a.startMinute - b.startMinute);
    return g.every((w, i) => i === 0 || g[i - 1].endMinute <= w.startMinute);
  });
}
export function inside(windows: Window[], start: number, end: number) {
  return windows.some(w => w.startMinute <= start && end <= w.endMinute);
}
export function validDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const d = new Date(date + "T12:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === date;
}
export function weekday(date: string) { return new Date(date + "T12:00:00Z").getUTCDay(); }
export function localParts(date: Date, zone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const n = (type: string) => Number(parts.find(part => part.type === type)?.value);
  return { date: `${n("year")}-${String(n("month")).padStart(2, "0")}-${String(n("day")).padStart(2, "0")}`,
    minute: n("hour") * 60 + n("minute") };
}
export function localToUtc(date: string, minute: number, zone: string): Date | null {
  const [y, m, d] = date.split("-").map(Number);
  const wall = Date.UTC(y, m - 1, d, 0, minute);
  let ms = wall;
  for (let i = 0; i < 5; i++) {
    const observed = localParts(new Date(ms), zone);
    const [oy, om, od] = observed.date.split("-").map(Number);
    const diff = wall - Date.UTC(oy, om - 1, od, 0, observed.minute);
    ms += diff;
    if (!diff) break;
  }
  const result = new Date(ms);
  const actual = localParts(result, zone);
  return actual.date === date && actual.minute === minute ? result : null;
}
