import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

/**
 * Cron giornaliero: invia notifica `contract_expiring` per i contratti
 * in scadenza entro `notice_period_days`. Idempotente grazie a
 * `last_notified_at` (24h rolling).
 *
 * Auth: `apikey` header con SCHEDULER_SECRET (Bearer accettato).
 */
export const Route = createFileRoute("/api/public/hooks/contracts-notify")({
  server: {
    handlers: {
      POST: async ({ request }) => guard(request) ?? run(),
      GET: async ({ request }) => guard(request) ?? run(),
    },
  },
});

function guard(request: Request): Response | null {
  const expected = process.env.SCHEDULER_SECRET ?? "";
  if (!expected) return json({ ok: false, error: "SCHEDULER_SECRET mancante" }, 500);
  const auth = request.headers.get("authorization") ?? "";
  const apikey = request.headers.get("apikey") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (bearer === expected || apikey === expected) return null;
  return json({ ok: false, error: "Unauthorized" }, 401);
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function sendTeams(webhook: string, subject: string, message: string, link?: string | null) {
  const card = {
    "@type": "MessageCard",
    "@context": "https://schema.org/extensions",
    summary: subject,
    themeColor: "f59e0b",
    title: subject,
    text: message,
    potentialAction: link
      ? [{ "@type": "OpenUri", name: "Apri in HotelOps", targets: [{ os: "default", uri: link }] }]
      : undefined,
  };
  return fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(card),
  });
}

async function run() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY!;
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: rows, error } = await sb.rpc("contracts_due_for_notice");
  if (error) return json({ ok: false, error: error.message }, 500);

  const results: any[] = [];
  for (const c of rows ?? []) {
    const subject = `Contratto in scadenza: ${c.title}`;
    const message = `Il contratto ${c.code} con ${c.supplier_name} scade il ${c.end_date} (${c.days_left} giorni). ${c.auto_renew ? "Rinnovo automatico attivo." : "Verificare la disdetta o il rinnovo."}`;

    const { data: channels } = await sb
      .from("notification_channels")
      .select("*")
      .eq("active", true)
      .or(`structure_id.eq.${c.structure_id},structure_id.is.null`);

    const targets = (channels ?? []).filter((ch: any) => (ch.events ?? []).includes("contract_expiring"));
    for (const ch of targets) {
      try {
        if (ch.type === "teams") {
          const res = await sendTeams(ch.target, subject, message, null);
          if (!res.ok) throw new Error(`Teams ${res.status}`);
        }
        await sb.from("notification_log").insert({
          structure_id: c.structure_id, channel_id: ch.id, event: "contract_expiring",
          channel_type: ch.type, target: ch.target, subject,
          payload: { contract_id: c.contract_id, days_left: c.days_left }, status: "ok",
        });
        results.push({ contract: c.code, channel: ch.id, ok: true });
      } catch (e: any) {
        await sb.from("notification_log").insert({
          structure_id: c.structure_id, channel_id: ch.id, event: "contract_expiring",
          channel_type: ch.type, target: ch.target, subject,
          payload: { contract_id: c.contract_id }, status: "error", error: String(e?.message ?? e),
        });
        results.push({ contract: c.code, channel: ch.id, ok: false, error: String(e?.message ?? e) });
      }
    }

    await sb.from("contracts").update({ last_notified_at: new Date().toISOString() }).eq("id", c.contract_id);
  }

  return json({ ok: true, processed: rows?.length ?? 0, dispatched: results.length });
}