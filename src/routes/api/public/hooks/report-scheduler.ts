import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

/**
 * Cron-driven scheduler for Report Builder templates.
 * Picks every template with `next_run_at <= now()` and `recipients` not empty,
 * runs the underlying query with the service role, records a `scheduled_report_runs`
 * row and (if email infrastructure is configured) enqueues an email per recipient.
 *
 * Called by pg_cron via stable URL — see docs/MANUALE_OPERATIVO.md.
 * Use Bearer + project anon key, or call from pg_net with the `apikey` header.
 */
export const Route = createFileRoute("/api/public/hooks/report-scheduler")({
  server: {
    handlers: {
      POST: async ({ request }) => guard(request) ?? runScheduler(),
      GET: async ({ request }) => guard(request) ?? runScheduler(),
    },
  },
});

/**
 * Allowlist of tables the scheduler is permitted to read with the service role.
 * Any other `tpl.source` value (e.g. profiles, user_roles) is rejected so that
 * an authenticated user cannot exfiltrate sensitive data by crafting a template.
 */
const ALLOWED_SOURCES = new Set([
  "tickets", "assets", "work_orders", "invoices", "contracts",
  "inventory_items", "sla_violations", "suppliers", "maintenance_plans",
]);

function guard(request: Request): Response | null {
  const auth = request.headers.get("authorization") ?? "";
  const apikey = request.headers.get("apikey") ?? "";
  const expected = process.env.SCHEDULER_SECRET
    ?? process.env.SUPABASE_PUBLISHABLE_KEY
    ?? process.env.SUPABASE_SERVICE_ROLE_KEY
    ?? "";
  if (!expected) return json({ ok: false, error: "Scheduler non configurato" }, 500);
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (bearer === expected || apikey === expected) return null;
  return json({ ok: false, error: "Unauthorized" }, 401);
}

async function runScheduler() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY!;
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const nowIso = new Date().toISOString();

  // === 1) Process the delivery queue (retry with back-off, DLQ) ===
  await processDeliveryQueue(sb);

  // === 2) Enqueue PDFs for templates whose schedule fired ===
  const { data: due, error } = await sb
    .from("report_templates")
    .select("*")
    .lte("next_run_at", nowIso)
    .not("next_run_at", "is", null);

  if (error) return json({ ok: false, error: error.message }, 500);
  const results: any[] = [];

  for (const tpl of due ?? []) {
    if (!ALLOWED_SOURCES.has(tpl.source)) {
      await sb.from("report_templates").update({ next_run_at: null, last_error_at: new Date().toISOString() }).eq("id", tpl.id);
      results.push({ template: tpl.name, error: `Sorgente non consentita: ${tpl.source}` });
      continue;
    }
    const recipients: string[] = tpl.recipients ?? [];
    const { data: run } = await sb.from("scheduled_report_runs").insert({
      template_id: tpl.id, structure_id: tpl.structure_id,
      status: "running", recipients, triggered_by: "cron",
    }).select("id").single();
    const runId = run?.id as string | undefined;

    try {
      let q: any = sb.from(tpl.source).select((tpl.columns ?? ["*"]).join(","));
      if (tpl.structure_id) {
        try { q = q.eq("structure_id", tpl.structure_id); } catch { /* table has no structure_id */ }
      }
      const { data: rowsData, error: qErr } = await q.limit(5000);
      if (qErr) throw qErr;

      // Enqueue one delivery row per recipient (with per-recipient layout override)
      const recipientLayouts: Array<any> = Array.isArray(tpl.recipient_layouts) ? tpl.recipient_layouts : [];
      const allRecipients = Array.from(new Set([
        ...recipients,
        ...recipientLayouts.map((r) => r.email).filter(Boolean),
      ]));
      const enqueued: string[] = [];
      for (const recipient of allRecipients) {
        const override = recipientLayouts.find((r) => r.email?.toLowerCase() === recipient.toLowerCase());
        const subject = override?.subject ?? `[HotelOps] ${tpl.name}`;
        const { error: qe } = await sb.from("report_delivery_queue").insert({
          run_id: runId, template_id: tpl.id, structure_id: tpl.structure_id,
          recipient, subject, status: "pending",
          max_attempts: tpl.max_retries ?? 3,
          payload: {
            template_name: tpl.name, source: tpl.source, columns: tpl.columns,
            rows_count: rowsData?.length ?? 0, layout: override ?? tpl.pdf_layout ?? tpl.layout,
          },
        });
        if (!qe) enqueued.push(recipient);
      }

      const nextRun = bumpNextRun(tpl.schedule_cron);
      await sb.from("report_templates").update({
        last_run_at: new Date().toISOString(),
        next_run_at: nextRun,
      }).eq("id", tpl.id);

      await sb.from("scheduled_report_runs").update({
        status: "ok", rows_count: rowsData?.length ?? 0,
        finished_at: new Date().toISOString(),
        recipient_logs: enqueued.map((r) => ({ recipient: r, status: "queued", at: new Date().toISOString() })),
      }).eq("id", runId);

      results.push({ template: tpl.name, rows: rowsData?.length ?? 0, enqueued: enqueued.length, next_run_at: nextRun });
    } catch (e: any) {
      await sb.from("scheduled_report_runs").update({
        status: "error", error: String(e?.message ?? e),
        finished_at: new Date().toISOString(), last_error_at: new Date().toISOString(),
      }).eq("id", runId);
      results.push({ template: tpl.name, error: String(e?.message ?? e) });
    }
  }

  return json({ ok: true, processed: results.length, results });
}

/**
 * Pulls ready items off the delivery queue, tries to send the PDF as an email
 * (best effort — falls back to logging if email infra isn't configured), and
 * reschedules failures with an exponential back-off. After max_attempts moves
 * to "dlq" so the operator can retry from the UI.
 */
async function processDeliveryQueue(sb: any) {
  const nowIso = new Date().toISOString();
  const { data: pending } = await sb.from("report_delivery_queue")
    .select("*").eq("status", "pending").lte("next_attempt_at", nowIso).limit(50);
  for (const item of pending ?? []) {
    await sb.from("report_delivery_queue").update({ status: "sending" }).eq("id", item.id);
    try {
      const subject = item.subject ?? "[HotelOps] Report";
      const { error: eErr } = await sb.rpc("enqueue_email", {
        queue_name: "transactional_emails",
        email_payload: {
          to: item.recipient,
          subject,
          html: `<p>${subject}</p><p>Righe: ${item.payload?.rows_count ?? 0}</p>
                 <p>Apri HotelOps → Report Builder per scaricare il PDF.</p>`,
          from: "noreply@hotelops.app",
        },
      });
      if (eErr) throw eErr;
      await sb.from("report_delivery_queue").update({
        status: "sent", attempts: (item.attempts ?? 0) + 1, last_error: null,
      }).eq("id", item.id);
    } catch (e: any) {
      const attempts = (item.attempts ?? 0) + 1;
      const backoffMin = 15;
      const isDlq = attempts >= (item.max_attempts ?? 3);
      const nextAttempt = new Date(Date.now() + backoffMin * attempts * 60000).toISOString();
      await sb.from("report_delivery_queue").update({
        status: isDlq ? "dlq" : "error",
        attempts, last_error: String(e?.message ?? e),
        next_attempt_at: isDlq ? item.next_attempt_at : nextAttempt,
      }).eq("id", item.id);
    }
  }
  // re-arm "error" items whose back-off elapsed
  await sb.from("report_delivery_queue")
    .update({ status: "pending" })
    .eq("status", "error")
    .lte("next_attempt_at", nowIso);
}

/** Very small cron bumper: handles the few common patterns the UI guides toward.
 * Falls back to "+1 day" for unknown patterns. The next-run scheduling is best
 * effort; pg_cron remains the source of truth for the actual invocation cadence. */
function bumpNextRun(cron: string | null): string {
  const d = new Date();
  if (!cron) { d.setDate(d.getDate() + 1); return d.toISOString(); }
  const parts = cron.trim().split(/\s+/);
  // m h dom mon dow
  if (parts.length === 5) {
    const [, , , , dow] = parts;
    if (dow !== "*" && /^[0-6]$/.test(dow)) {
      const target = Number(dow);
      const cur = d.getDay();
      const add = ((target - cur + 7) % 7) || 7;
      d.setDate(d.getDate() + add);
      return d.toISOString();
    }
    if (parts[2] !== "*" && /^\d+$/.test(parts[2])) {
      d.setMonth(d.getMonth() + 1);
      return d.toISOString();
    }
  }
  d.setDate(d.getDate() + 1);
  return d.toISOString();
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}