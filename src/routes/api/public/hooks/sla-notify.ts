import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

/**
 * Cron ogni minuto: scansiona `sla_notifications` non ancora dispatchate
 * (`dispatched_at IS NULL`) e invia notifiche email/Teams/push usando i
 * template editabili in `notification_templates`. Idempotente: aggiorna
 * `dispatched_at` e `dispatched_count`.
 *
 * Auth: `apikey: SCHEDULER_SECRET` (Bearer accettato).
 */
export const Route = createFileRoute("/api/public/hooks/sla-notify")({
  server: {
    handlers: {
      POST: async ({ request }) => guard(request) ?? run(),
      GET: async ({ request }) => guard(request) ?? run(),
    },
  },
});

function json(p: unknown, s = 200) {
  return new Response(JSON.stringify(p), { status: s, headers: { "Content-Type": "application/json" } });
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

function render(tpl: string, vars: Record<string, string | number | null | undefined>) {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k) => {
    const v = vars[k];
    return v === null || v === undefined ? "" : String(v);
  });
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

  const { data: pending, error } = await sb
    .from("sla_notifications")
    .select("id, ticket_id, kind, due_at, delay_minutes, structure_id, tickets(ticket_number,title,priority)")
    .is("dispatched_at", null)
    .limit(100);
  if (error) return json({ ok: false, error: error.message }, 500);

  const out: any[] = [];

  for (const n of (pending ?? []) as any[]) {
    const event = n.kind?.startsWith("violated") ? "sla_violated" : "sla_warning";
    const vars = {
      ticket_number: n.tickets?.ticket_number ?? "",
      title: n.tickets?.title ?? "",
      priority: n.tickets?.priority ?? "",
      due_at: n.due_at ? new Date(n.due_at).toLocaleString("it-IT") : "",
      delay_minutes: n.delay_minutes ?? 0,
    };

    const { data: channels } = await sb
      .from("notification_channels")
      .select("*")
      .eq("active", true)
      .or(n.structure_id ? `structure_id.eq.${n.structure_id},structure_id.is.null` : `structure_id.is.null`);

    const targets = (channels ?? []).filter((c: any) => (c.events ?? []).includes(event));
    let sent = 0;

    for (const ch of targets) {
      // Risolvi template: prima struttura specifica, poi globale
      const { data: tpls } = await sb
        .from("notification_templates")
        .select("*")
        .eq("event", event)
        .eq("channel_type", ch.type)
        .eq("active", true)
        .or(n.structure_id ? `structure_id.eq.${n.structure_id},structure_id.is.null` : `structure_id.is.null`)
        .order("structure_id", { ascending: false, nullsFirst: false })
        .limit(1);
      const tpl = tpls?.[0];
      const subject = tpl ? render(tpl.subject, vars) : `[HotelOps] ${event} · #${vars.ticket_number}`;
      const body = tpl ? render(tpl.body_md, vars) : `Ticket #${vars.ticket_number} — ${vars.title}`;

      try {
        if (ch.type === "teams") await sendTeams(ch.target, subject, body);
        // email/push: registriamo solo nel log (l'infra email è gestita da Lovable Emails se attiva;
        // push è in-app via NotificationsBell che legge sla_notifications).
        await sb.from("notification_log").insert({
          structure_id: n.structure_id, channel_id: ch.id, event,
          channel_type: ch.type, target: ch.target, subject,
          payload: { sla_notification_id: n.id, body, vars }, status: "ok",
        });
        sent++;
      } catch (e: any) {
        await sb.from("notification_log").insert({
          structure_id: n.structure_id, channel_id: ch.id, event,
          channel_type: ch.type, target: ch.target, subject,
          payload: { sla_notification_id: n.id }, status: "error", error: String(e?.message ?? e),
        });
      }
    }

    await sb.from("sla_notifications").update({
      dispatched_at: new Date().toISOString(),
      dispatched_count: sent,
    }).eq("id", n.id);

    out.push({ id: n.id, event, sent });
  }

  return json({ ok: true, processed: out.length, results: out });
}