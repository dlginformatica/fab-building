import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, RotateCw, AlertTriangle, CheckCircle2, Clock, RefreshCw, Trash2 } from "lucide-react";
import { fmtDateTime } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/delivery-queue/$id")({ component: Detail });

const STATUS_BADGE: Record<string, { cls: string; icon: any }> = {
  pending: { cls: "bg-amber-500/15 text-amber-600", icon: Clock },
  sending: { cls: "bg-blue-500/15 text-blue-600", icon: RefreshCw },
  sent: { cls: "bg-green-500/15 text-green-600", icon: CheckCircle2 },
  error: { cls: "bg-red-500/15 text-red-600", icon: AlertTriangle },
  dlq: { cls: "bg-red-700/20 text-red-700", icon: AlertTriangle },
};

function Detail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();

  const { data: item } = useQuery({
    queryKey: ["delivery_item", id],
    queryFn: async () => (await (supabase as any).from("report_delivery_queue").select("*").eq("id", id).maybeSingle()).data,
    refetchInterval: 4000,
  });

  const { data: run } = useQuery({
    queryKey: ["delivery_run", item?.run_id],
    enabled: !!item?.run_id,
    queryFn: async () => (await (supabase as any).from("scheduled_report_runs").select("*").eq("id", item.run_id).maybeSingle()).data,
  });

  const { data: siblings } = useQuery({
    queryKey: ["delivery_siblings", item?.run_id],
    enabled: !!item?.run_id,
    queryFn: async () => ((await (supabase as any).from("report_delivery_queue").select("*").eq("run_id", item.run_id).order("created_at",{ascending:true})).data ?? []),
  });

  const requeue = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("report_delivery_queue")
        .update({ status: "pending", attempts: 0, next_attempt_at: new Date().toISOString(), last_error: null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Rilanciato"); qc.invalidateQueries({ queryKey: ["delivery_item", id] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const drop = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("report_delivery_queue").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => toast.success("Job rimosso. Torna alla coda."),
    onError: (e: Error) => toast.error(e.message),
  });

  if (!item) return <div className="p-6 text-sm text-muted-foreground">Caricamento job…</div>;
  const cfg = STATUS_BADGE[item.status] ?? STATUS_BADGE.pending;
  const Icon = cfg.icon;
  const payload = item.payload ?? {};

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm"><Link to="/app/delivery-queue"><ArrowLeft className="mr-1 h-4 w-4" />Coda</Link></Button>
        <h1 className="font-display text-xl font-bold">Job invio · {item.recipient}</h1>
        <Badge className={cfg.cls}><Icon className="mr-1 h-3 w-3" />{item.status}</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="font-display text-base">Stato</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row k="Creato" v={fmtDateTime(item.created_at)} />
            <Row k="Aggiornato" v={fmtDateTime(item.updated_at)} />
            <Row k="Tentativi" v={`${item.attempts} / ${item.max_attempts}`} />
            <Row k="Prossimo tentativo" v={fmtDateTime(item.next_attempt_at)} />
            <Row k="Oggetto" v={item.subject ?? "—"} />
            {payload.pdf_url && <Row k="PDF allegato" v={<a className="underline" href={payload.pdf_url} target="_blank" rel="noopener noreferrer">scarica</a>} />}
            <div className="flex gap-2 pt-2">
              <Button size="sm" onClick={() => requeue.mutate()} disabled={requeue.isPending}><RotateCw className="mr-1 h-4 w-4" />Rilancia</Button>
              <Button size="sm" variant="ghost" onClick={() => drop.mutate()}><Trash2 className="mr-1 h-4 w-4" />Rimuovi</Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="font-display text-base">Errore</CardTitle></CardHeader>
          <CardContent>
            {item.last_error
              ? <pre className="whitespace-pre-wrap rounded bg-destructive/10 p-3 text-xs text-destructive">{item.last_error}</pre>
              : <div className="text-xs text-muted-foreground">Nessun errore registrato.</div>}
          </CardContent>
        </Card>
      </div>

      {run && (
        <Card>
          <CardHeader><CardTitle className="font-display text-base">Esecuzione pianificata</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row k="Run ID" v={<code className="text-xs">{run.id}</code>} />
            <Row k="Stato" v={run.status} />
            <Row k="Avviato da" v={run.triggered_by ?? "cron"} />
            <Row k="Righe" v={String(run.rows_count ?? 0)} />
            <Row k="Finito" v={run.finished_at ? fmtDateTime(run.finished_at) : "—"} />
          </CardContent>
        </Card>
      )}

      {siblings && siblings.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="font-display text-base">Altri destinatari della stessa esecuzione · {siblings.length}</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-xs">
              <thead className="border-b border-border bg-muted/30"><tr><th className="px-3 py-2 text-left">Destinatario</th><th className="px-3 py-2 text-left">Stato</th><th className="px-3 py-2 text-left">Tentativi</th><th className="px-3 py-2 text-left">Errore</th></tr></thead>
              <tbody>
                {siblings.map((s: any) => (
                  <tr key={s.id} className={`border-b border-border/40 ${s.id === id ? "bg-muted/40" : ""}`}>
                    <td className="px-3 py-1.5"><Link className="underline" to="/app/delivery-queue/$id" params={{ id: s.id }}>{s.recipient}</Link></td>
                    <td className="px-3 py-1.5"><Badge variant="secondary">{s.status}</Badge></td>
                    <td className="px-3 py-1.5 font-mono">{s.attempts}/{s.max_attempts}</td>
                    <td className="px-3 py-1.5 max-w-[300px] truncate text-destructive" title={s.last_error ?? ""}>{s.last_error ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="font-display text-base">Payload</CardTitle></CardHeader>
        <CardContent><pre className="overflow-x-auto rounded bg-muted/30 p-3 text-xs">{JSON.stringify(payload, null, 2)}</pre></CardContent>
      </Card>
    </div>
  );
}

function Row({ k, v }: { k: string; v: any }) {
  return <div className="flex items-baseline justify-between gap-3"><span className="text-xs text-muted-foreground">{k}</span><span className="font-mono text-xs">{v}</span></div>;
}