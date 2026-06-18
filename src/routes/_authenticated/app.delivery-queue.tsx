import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { RefreshCw, RotateCw, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { fmtDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/app/delivery-queue")({ component: Page });

const STATUS = ["all", "pending", "sending", "sent", "error", "dlq"];

const STATUS_BADGE: Record<string, { cls: string; icon: any }> = {
  pending: { cls: "bg-amber-500/15 text-amber-600", icon: Clock },
  sending: { cls: "bg-blue-500/15 text-blue-600", icon: RefreshCw },
  sent: { cls: "bg-green-500/15 text-green-600", icon: CheckCircle2 },
  error: { cls: "bg-red-500/15 text-red-600", icon: AlertTriangle },
  dlq: { cls: "bg-red-700/20 text-red-700", icon: AlertTriangle },
};

function Page() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data: rows, refetch } = useQuery({
    queryKey: ["report_delivery_queue", status],
    queryFn: async () => {
      let q: any = (supabase as any).from("report_delivery_queue").select("*").order("created_at", { ascending: false }).limit(500);
      if (status !== "all") q = q.eq("status", status);
      return (await q).data ?? [];
    },
    refetchInterval: 5000,
  });

  const requeue = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("report_delivery_queue")
        .update({ status: "pending", attempts: 0, next_attempt_at: new Date().toISOString(), last_error: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Rimesso in coda"); qc.invalidateQueries({ queryKey: ["report_delivery_queue"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = (rows ?? []).filter((r: any) =>
    !search || r.recipient.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold flex items-center gap-2"><RefreshCw className="h-5 w-5" />Coda invii report</h1>
        <p className="text-sm text-muted-foreground">Coda persistente con retry e back-off per ogni PDF/destinatario. Errori dettagliati per ogni esecuzione pianificata.</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="font-display text-base">Filtri</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <div className="space-y-1"><Label className="text-xs">Stato</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="space-y-1 md:col-span-2"><Label className="text-xs">Destinatario</Label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="email" /></div>
          <div className="flex items-end"><Button variant="outline" onClick={() => refetch()}><RefreshCw className="mr-1 h-4 w-4" />Aggiorna</Button></div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="font-display text-base">Elementi · {filtered.length}</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-xs">
            <thead className="border-b border-border bg-muted/30">
              <tr><th className="px-3 py-2 text-left">Creato</th><th className="px-3 py-2 text-left">Destinatario</th><th className="px-3 py-2 text-left">Oggetto</th><th className="px-3 py-2 text-left">Stato</th><th className="px-3 py-2 text-left">Tentativi</th><th className="px-3 py-2 text-left">Prossimo tentativo</th><th className="px-3 py-2 text-left">Errore</th><th></th></tr>
            </thead>
            <tbody>
              {filtered.map((r: any) => {
                const cfg = STATUS_BADGE[r.status] ?? { cls: "bg-muted", icon: Clock };
                const Icon = cfg.icon;
                return (
                  <tr key={r.id} className="border-b border-border/40">
                    <td className="px-3 py-1.5 font-mono">{fmtDateTime(r.created_at)}</td>
                    <td className="px-3 py-1.5">{r.recipient}</td>
                    <td className="px-3 py-1.5">{r.subject ?? "—"}</td>
                    <td className="px-3 py-1.5"><Badge className={cfg.cls}><Icon className="mr-1 h-3 w-3 inline" />{r.status}</Badge></td>
                    <td className="px-3 py-1.5 font-mono">{r.attempts} / {r.max_attempts}</td>
                    <td className="px-3 py-1.5 font-mono">{fmtDateTime(r.next_attempt_at)}</td>
                    <td className="px-3 py-1.5 max-w-[260px] truncate text-destructive" title={r.last_error ?? ""}>{r.last_error ?? "—"}</td>
                    <td className="px-3 py-1.5 text-right">
                      {(r.status === "error" || r.status === "dlq") && (
                        <Button size="sm" variant="outline" onClick={() => requeue.mutate(r.id)}><RotateCw className="mr-1 h-3 w-3" />Riprova</Button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">Nessun elemento in coda.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}