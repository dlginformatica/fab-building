/**
 * Lightweight cron utilities for the Report Builder pianificazione wizard.
 * Supports the 5-field cron subset the UI guides users toward:
 *   m h dom mon dow  with values: *  N  *\/N  a,b,c
 * Computes the next N occurrences honoring a IANA timezone (Europe/Rome by default).
 */

export type CronParts = { m: string; h: string; dom: string; mon: string; dow: string };

export function parseCron(expr: string): { ok: true; parts: CronParts } | { ok: false; error: string } {
  if (!expr || !expr.trim()) return { ok: false, error: "Espressione vuota" };
  const t = expr.trim().split(/\s+/);
  if (t.length !== 5) return { ok: false, error: "Servono 5 campi: m h dom mon dow" };
  const [m, h, dom, mon, dow] = t;
  const ranges: Array<[string, number, number]> = [["minuto", 0, 59], ["ora", 0, 23], ["giorno mese", 1, 31], ["mese", 1, 12], ["giorno settimana", 0, 6]];
  const fields = [m, h, dom, mon, dow];
  for (let i = 0; i < 5; i++) {
    const f = fields[i]; const [name, lo, hi] = ranges[i];
    if (!validField(f, lo, hi)) return { ok: false, error: `Campo "${name}" non valido: ${f}` };
  }
  return { ok: true, parts: { m, h, dom, mon, dow } };
}

function validField(f: string, lo: number, hi: number): boolean {
  if (f === "*") return true;
  const stepMatch = /^\*\/(\d+)$/.exec(f);
  if (stepMatch) { const n = Number(stepMatch[1]); return n > 0 && n <= hi; }
  return f.split(",").every((v) => /^\d+$/.test(v) && Number(v) >= lo && Number(v) <= hi);
}

function matchField(value: number, f: string, lo: number, hi: number): boolean {
  if (f === "*") return true;
  const stepMatch = /^\*\/(\d+)$/.exec(f);
  if (stepMatch) { const n = Number(stepMatch[1]); return (value - lo) % n === 0; }
  return f.split(",").map(Number).includes(value);
}

/** Get the wall-clock parts of `date` in the requested IANA timezone. */
function partsInTZ(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "short", hour12: false,
  });
  const map: Record<string, string> = {};
  for (const p of fmt.formatToParts(date)) if (p.type !== "literal") map[p.type] = p.value;
  const dowMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    y: Number(map.year), mo: Number(map.month), d: Number(map.day),
    h: Number(map.hour === "24" ? "0" : map.hour), mi: Number(map.minute), s: Number(map.second),
    dow: dowMap[map.weekday] ?? 0,
  };
}

/** Returns the next N executions (UTC ISO strings) of a cron expression in the given timezone. */
export function nextRuns(expr: string, timeZone = "Europe/Rome", count = 5, from: Date = new Date()): string[] {
  const parsed = parseCron(expr);
  if (!parsed.ok) return [];
  const { parts } = parsed;
  const results: string[] = [];
  // Step minute-by-minute up to 366 days * 24*60 = ~527k iterations worst case; cap to 60 days for safety.
  const cap = 60 * 24 * 60;
  let cursor = new Date(Math.ceil(from.getTime() / 60000) * 60000); // round up to next minute
  for (let i = 0; i < cap && results.length < count; i++) {
    const p = partsInTZ(cursor, timeZone);
    if (
      matchField(p.mi, parts.m, 0, 59) &&
      matchField(p.h, parts.h, 0, 23) &&
      matchField(p.d, parts.dom, 1, 31) &&
      matchField(p.mo, parts.mon, 1, 12) &&
      matchField(p.dow, parts.dow, 0, 6)
    ) {
      results.push(cursor.toISOString());
      cursor = new Date(cursor.getTime() + 60000);
    } else {
      cursor = new Date(cursor.getTime() + 60000);
    }
  }
  return results;
}

export const COMMON_TIMEZONES = [
  "Europe/Rome", "Europe/London", "Europe/Paris", "Europe/Madrid", "Europe/Berlin",
  "UTC", "America/New_York", "America/Los_Angeles", "Asia/Dubai", "Asia/Tokyo",
];

export const CRON_PRESETS: Array<{ label: string; value: string }> = [
  { label: "Ogni giorno 08:00", value: "0 8 * * *" },
  { label: "Lun-Ven 09:00", value: "0 9 * * 1,2,3,4,5" },
  { label: "Lunedì 08:00", value: "0 8 * * 1" },
  { label: "Primo del mese 07:00", value: "0 7 1 * *" },
  { label: "Ogni ora", value: "0 * * * *" },
];