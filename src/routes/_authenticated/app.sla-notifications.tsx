import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, CheckCircle2 } from "lucide-react";
import { fmtDateTime } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/sla-notifications")({ component: Page });

const KIND_LABEL: Record<string,{txt:string;tone:"warning"|"destructive"}> = {
  warning_ack: { txt:"Warning · Ack", tone:"warning" },
  warning_resolve: { txt:"Warning · Risoluzione", tone:"warning" },
  violated_ack: { txt:"Violazione · Ack", tone:"destructive" },
  violated_resolve: { txt:"Violazione · Risoluzione", tone:"destructive" },
};

function Page() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("all");
  const [status, setStatus] = useState<"open"|"all">("open");

  const { data: items = [] } = useQuery({
    queryKey: ["sla_notifications_history", filter, status],
    queryFn: async () => {
      let q = (supabase as any).from("sla_notifications").select("*, tickets(ticket_number,title,priority,status)").order("created_at",{ascending:false}).limit(200);
      if (filter !== "all") q = q.eq("kind", filter);
      if (status === "open") q = q.is("acknowledged_at", null);
      return (await q).data ?? [];
    },
  });

  const ack = useMutation({
    mutationFn: async (id: string) => {
      const user = (await supabase.auth.getUser()).data.user;
      const { error } = await (supabase as any).from("sla_notifications").update({
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: user?.id ?? null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Notifica presa in carico"); qc.invalidateQueries({ queryKey: ["sla_notifications_history"] }); qc.invalidateQueries({ queryKey: ["sla_notifications"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold flex items-center gap-2"><Bell className="h-5 w-5"/>Notifiche SLA — storico</h1>
        <p className="text-sm text-muted-foreground">Avvisi automatici per SLA in scadenza (entro 30 minuti) e violazioni. Ogni evento è tracciato nell'audit log.</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="font-display text-base">Eventi</CardTitle>
          <div className="flex gap-2">
            <Select value={status} onValueChange={(v)=>setStatus(v as "open"|"all")}>
              <SelectTrigger className="w-[140px]"><SelectValue/></SelectTrigger>
              <SelectContent><SelectItem value="open">Solo aperte</SelectItem><SelectItem value="all">Tutte</SelectItem></SelectContent>
            </Select>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[200px]"><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti i tipi</SelectItem>
                {Object.entries(KIND_LABEL).map(([k,v]) => <SelectItem key={k} value={k}>{v.txt}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <tr><th className="px-3 py-2">Tipo</th><th className="px-3 py-2">Ticket</th><th className="px-3 py-2">Scadenza</th><th className="px-3 py-2">Ritardo</th><th className="px-3 py-2">Generata</th><th className="px-3 py-2">Stato</th><th></th></tr>
            </thead>
            <tbody>
              {items.map((n:any) => {
                const k = KIND_LABEL[n.kind] ?? { txt:n.kind, tone:"warning" as const };
                return (
                  <tr key={n.id} className="border-b border-border/60">
                    <td className="px-3 py-2"><Badge variant="outline" className={k.tone==="destructive"?"bg-destructive/15 text-destructive border-destructive/30":"bg-warning/15 text-warning border-warning/30"}>{k.txt}</Badge></td>
                    <td className="px-3 py-2">
                      <Link to="/app/tickets/$id" params={{ id: n.ticket_id }} className="text-primary hover:underline font-mono">#{n.tickets?.ticket_number}</Link>
                      <div className="text-xs text-muted-foreground">{n.tickets?.title}</div>
                    </td>
                    <td className="px-3 py-2 text-xs">{n.due_at ? fmtDateTime(n.due_at) : "—"}</td>
                    <td className="px-3 py-2 text-xs">{n.delay_minutes != null ? <span className="text-destructive font-semibold">+{n.delay_minutes} min</span> : "—"}</td>
                    <td className="px-3 py-2 text-xs">{fmtDateTime(n.created_at)}</td>
                    <td className="px-3 py-2">
                      {n.acknowledged_at
                        ? <Badge variant="outline" className="bg-success/15 text-success border-success/30">Presa in carico</Badge>
                        : <Badge variant="outline">Aperta</Badge>}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {!n.acknowledged_at && <Button size="sm" variant="outline" onClick={()=>ack.mutate(n.id)}><CheckCircle2 className="h-3 w-3 mr-1"/>Conferma</Button>}
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">Nessuna notifica.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}