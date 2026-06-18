export function fmtDateTime(s: string | null | undefined) {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return s ?? "—";
  }
}

export function fmtDate(s: string | null | undefined) {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleDateString("it-IT");
  } catch {
    return s ?? "—";
  }
}

export function timeUntil(s: string | null | undefined): { label: string; status: "ok" | "warn" | "violated" | "none" } {
  if (!s) return { label: "—", status: "none" };
  const target = new Date(s).getTime();
  const diffMs = target - Date.now();
  const abs = Math.abs(diffMs);
  const mins = Math.floor(abs / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const label = (diffMs < 0 ? "-" : "") + (h > 0 ? `${h}h ${m}m` : `${m}m`);
  let status: "ok" | "warn" | "violated" = "ok";
  if (diffMs < 0) status = "violated";
  else if (diffMs < 30 * 60_000) status = "warn";
  return { label, status };
}