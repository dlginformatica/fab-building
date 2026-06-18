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
      POST: async () => runScheduler(),
      GET: async () => runScheduler(),
    },
  },
});

async function runScheduler() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY!;
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const nowIso = new Date().toISOString();
  const { data: due, error } = await sb
    .from("report_templates")
    .select("*")
    .lte("next_run_at", nowIso)
    .not("next_run_at", "is", null);

  if (error) return json({ ok: false, error: error.message }, 500);
  const results: any[] = [];

  for (const tpl of due ?? []) {
    const recipients: string[] = tpl.recipients ?? [];
    const { data: run } = await sb.from("scheduled_report_runs").insert({
      template_id: tpl.id, structure_id: tpl.structure_id,
      status: "running", recipients,
    }).select("id").single();
    const runId = run?.id as string | undefined;

    try {
      let q: any = sb.from(tpl.source).select((tpl.columns ?? ["*"]).join(","));
      if (tpl.structure_id) {
        try { q = q.eq("structure_id", tpl.structure_id); } catch { /* table has no structure_id */ }
      }
      const { data: rowsData, error: qErr } = await q.limit(5000);
      if (qErr) throw qErr;

      // Best-effort email enqueue (no-op if email infra is not configured).
      let emailed = 0;
      try {
        for (const r of recipients) {
          const { error: eErr } = await sb.rpc("enqueue_email", {
            queue_name: "transactional_emails",
            email_payload: {
              to: r,
              subject: `[HotelOps] Report pianificato: ${tpl.name}`,
              html: `<p>Esecuzione pianificata del report <b>${tpl.name}</b>.</p>
                     <p>Righe: ${rowsData?.length ?? 0}</p>
                     <p>Apri HotelOps → Report Builder per scaricare il PDF con intestazione, piè di pagina, firma e QR.</p>`,
              from: "noreply@hotelops.app",
            },
          });
          if (!eErr) emailed++;
        }
      } catch { /* email infra not enabled — record only */ }

      const nextRun = bumpNextRun(tpl.schedule_cron);
      await sb.from("report_templates").update({
        last_run_at: new Date().toISOString(),
        next_run_at: nextRun,
      }).eq("id", tpl.id);

      await sb.from("scheduled_report_runs").update({
        status: "ok", rows_count: rowsData?.length ?? 0,
        finished_at: new Date().toISOString(),
      }).eq("id", runId);

      results.push({ template: tpl.name, rows: rowsData?.length ?? 0, emailed, next_run_at: nextRun });
    } catch (e: any) {
      await sb.from("scheduled_report_runs").update({
        status: "error", error: String(e?.message ?? e),
        finished_at: new Date().toISOString(),
      }).eq("id", runId);
      results.push({ template: tpl.name, error: String(e?.message ?? e) });
    }
  }

  return json({ ok: true, processed: results.length, results });
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