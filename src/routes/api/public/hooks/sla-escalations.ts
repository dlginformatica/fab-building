import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

/**
 * Cron orario: processa escalation SLA pendenti e dispatcha sui canali
 * configurati (Teams/Email). Idempotente: aggiorna `last_escalation_level`
 * sulla violazione.
 *
 * Auth: `apikey: SCHEDULER_SECRET` (Bearer accettato).
 */
export const Route = createFileRoute("/api/public/hooks/sla-escalations")({
  server: {
    handlers: {
      POST: async ({ request }) => guard(request) ?? run(),
      GET: async ({ request }) => guard(request) ?? run(),
    },
  },
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
}

function guard(request: Request): Response | null {
  const expected = process.env.SCHEDULER_SECRET ?? "";
  if (!expected) return json({ ok: false, error: "SCHEDULER_SECRET mancante" }, 500);
  const auth = request.headers.get("authorization") ?? "";
  const apikey = request.headers.get("apikey") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (bearer === expected || apikey === expected) return null;
  return json({ ok: false, error: "Unauthorized" }, 401);
}

async function sendTeams(webhook: string, subject: string, message: string) {
  return fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      "@type": "MessageCard", "@context": "https://schema.org/extensions",
      summary: subject, themeColor: "dc2626", title: subject, text: message,
    }),
  });
}

async function run() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY!;
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: pending, error } = await sb.rpc("sla_pending_escalations");
  if (error) return json({ ok: false, error: error.message }, 500);

  const results: any[] = [];
  for (const p of (pending ?? []) as any[]) {
    const subject = `SLA escalation L${p.next_level} — ticket in ritardo`;
    const message = `Ticket ${p.ticket_id} in ritardo di ${p.delay_minutes} min sulla risoluzione. Escalation di livello ${p.next_level}.`;

    let dispatched = 0;
    if (p.notify_channel_id) {
      const { data: ch } = await sb.from("notification_channels").select("*").eq("id", p.notify_channel_id).eq("active", true).maybeSingle();
      if (ch) {
        try {
          if (ch.type === "teams") await sendTeams(ch.target, subject, message);
          await sb.from("notification_log").insert({
            structure_id: p.structure_id, channel_id: ch.id, event: p.event,
            channel_type: ch.type, target: ch.target, subject,
            payload: { ticket_id: p.ticket_id, level: p.next_level, delay_minutes: p.delay_minutes },
            status: "ok",
          });
          dispatched++;
        } catch (e: any) {
          await sb.from("notification_log").insert({
            structure_id: p.structure_id, channel_id: ch.id, event: p.event,
            channel_type: ch.type, target: ch.target, subject,
            payload: { ticket_id: p.ticket_id }, status: "error", error: String(e?.message ?? e),
          });
        }
      }
    } else {
      // fallback: dispatch su tutti i canali della struttura sottoscritti all'evento
      const { data: chs } = await sb.from("notification_channels").select("*")
        .eq("active", true).or(`structure_id.eq.${p.structure_id},structure_id.is.null`);
      const targets = (chs ?? []).filter((c: any) => (c.events ?? []).includes(p.event));
      for (const ch of targets) {
        try {
          if (ch.type === "teams") await sendTeams(ch.target, subject, message);
          await sb.from("notification_log").insert({
            structure_id: p.structure_id, channel_id: ch.id, event: p.event,
            channel_type: ch.type, target: ch.target, subject,
            payload: { ticket_id: p.ticket_id, level: p.next_level }, status: "ok",
          });
          dispatched++;
        } catch (e: any) {
          await sb.from("notification_log").insert({
            structure_id: p.structure_id, channel_id: ch.id, event: p.event,
            channel_type: ch.type, target: ch.target, subject,
            payload: { ticket_id: p.ticket_id }, status: "error", error: String(e?.message ?? e),
          });
        }
      }
    }

    await sb.from("sla_violations").update({
      last_escalation_level: p.next_level,
      last_escalation_at: new Date().toISOString(),
    }).eq("id", p.violation_id);

    results.push({ violation_id: p.violation_id, level: p.next_level, dispatched });
  }

  return json({ ok: true, processed: results.length, results });
}