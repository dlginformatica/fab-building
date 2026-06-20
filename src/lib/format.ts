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

/**
 * Tempo residuo (o di sforamento) verso una scadenza SLA.
 * Se `stopAt` è valorizzato (es. data risoluzione/chiusura del ticket),
 * il conteggio si ferma a quell'istante: il countdown NON continua a correre
 * e lo stato indica se la chiusura è avvenuta entro o fuori SLA.
 */
export function timeUntil(
  due: string | null | undefined,
  stopAt?: string | null | undefined,
): { label: string; status: "ok" | "warn" | "violated" | "none"; stopped: boolean } {
  if (!due) return { label: "—", status: "none", stopped: false };
  const target = new Date(due).getTime();
  const stopped = !!stopAt;
  const reference = stopped ? new Date(stopAt!).getTime() : Date.now();
  const diffMs = target - reference;
  const abs = Math.abs(diffMs);
  const mins = Math.floor(abs / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const time = h > 0 ? `${h}h ${m}m` : `${m}m`;
  let status: "ok" | "warn" | "violated" = "ok";
  if (diffMs < 0) status = "violated";
  else if (!stopped && diffMs < 30 * 60_000) status = "warn";
  const label = stopped
    ? (status === "violated" ? `Fuori SLA (+${time})` : `In SLA (-${time})`)
    : (diffMs < 0 ? `-${time}` : time);
  return { label, status, stopped };
}

/**
 * Formatta importi in euro in locale italiano (es. € 1.464,00).
 */
const EUR_FMT = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
export function fmtEUR(value: number | string | null | undefined): string {
  if (value == null || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "—";
  return EUR_FMT.format(n);
}