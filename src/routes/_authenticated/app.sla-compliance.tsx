import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Download, FileBarChart } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/sla-compliance")({ component: Page });

function isoDaysAgo(days: number) {
  const d = new Date(); d.setDate(d.getDate() - days); d.setHours(0,0,0,0);
  return d.toISOString();
}

function Page() {
  const [from, setFrom] = useState(isoDaysAgo(30).slice(0,10));
  const [to, setTo] = useState(new Date().toISOString().slice(0,10));
  const [structureId, setStructureId] = useState<string>("");

  const { data: structures = [] } = useQuery({
    queryKey: ["structures-min"],
    queryFn: async () => (await supabase.from("structures").select("id,name").order("name")).data ?? [],
  });

  const { data: rows = [], isFetching } = useQuery({
    queryKey: ["sla-compliance", from, to, structureId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("sla_compliance_report" as any, {
        _from: new Date(from).toISOString(),
        _to: new Date(new Date(to).getTime() + 86400000).toISOString(),
        _structure: structureId || null,
      } as any);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const totals = useMemo(() => {
    const sum = (rows as any[]).reduce((a, r) => ({
      total: a.total + Number(r.total_tickets || 0),
      ack: a.ack + Number(r.ack_on_time || 0),
      res: a.res + Number(r.resolve_on_time || 0),
      vio: a.vio + Number(r.violated || 0),
    }), { total: 0, ack: 0, res: 0, vio: 0 });
    return {
      ...sum,
      ackPct: sum.total ? Math.round(100 * sum.ack / sum.total) : 0,
      resPct: sum.total ? Math.round(100 * sum.res / sum.total) : 0,
    };
  }, [rows]);

  function exportCsv() {
    const headers = ["Struttura","Priorità","Totale","Ack on time","Risolti on time","Violazioni","% Ack","% Risoluzione","Tempo medio (min)"];
    const lines = [headers.join(";")];
    for (const r of rows as any[]) {
      lines.push([
        r.structure_name ?? "Globale", r.priority,
        r.total_tickets, r.ack_on_time, r.resolve_on_time, r.violated,
        r.ack_compliance_pct ?? "—", r.resolve_compliance_pct ?? "—",
        r.avg_resolve_minutes ?? "—",
      ].join(";"));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `sla-compliance_${from}_${to}.csv`;
    a.click();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold flex items-center gap-2"><FileBarChart className="h-5 w-5 text-primary"/>Report di conformità SLA</h1>
        <p className="text-sm text-muted-foreground">Percentuali di rispetto SLA su ack e risoluzione, per priorità e struttura, nel periodo selezionato.</p>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-5">
          <div className="space-y-1"><Label>Da</Label><Input type="date" value={from} onChange={(e)=>setFrom(e.target.value)}/></div>
          <div className="space-y-1"><Label>A</Label><Input type="date" value={to} onChange={(e)=>setTo(e.target.value)}/></div>
          <div className="space-y-1 md:col-span-2"><Label>Struttura</Label>
            <Select value={structureId || "all"} onValueChange={(v)=>setStructureId(v==="all"?"":v)}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent><SelectItem value="all">Tutte</SelectItem>
                {(structures as any[]).map((s)=><SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end"><Button variant="outline" className="w-full" onClick={exportCsv} disabled={rows.length===0}><Download className="mr-2 h-4 w-4"/>CSV</Button></div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-4">
        <Kpi label="Ticket totali" value={totals.total} />
        <Kpi label="Ack on time" value={`${totals.ackPct}%`} tone="success" />
        <Kpi label="Risolti on time" value={`${totals.resPct}%`} tone={totals.resPct>=85?"success":totals.resPct>=60?"warning":"destructive"} />
        <Kpi label="Violazioni" value={totals.vio} tone={totals.vio>0?"destructive":"success"} />
      </div>

      <Card><CardHeader><CardTitle className="font-display text-base">Dettaglio per priorità</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isFetching ? <div className="p-6 text-center text-sm text-muted-foreground">Caricamento…</div>
            : rows.length === 0 ? <div className="p-6 text-center text-sm text-muted-foreground">Nessun ticket nel periodo selezionato.</div>
            : <table className="w-full text-sm">
                <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <tr><th className="p-2">Struttura</th><th className="p-2">Priorità</th><th className="p-2 text-right">Totale</th><th className="p-2 text-right">Ack OK</th><th className="p-2 text-right">Risolti OK</th><th className="p-2 text-right">Viol.</th><th className="p-2 text-right">% Ack</th><th className="p-2 text-right">% Risoluz.</th><th className="p-2 text-right">⌀ min</th></tr>
                </thead>
                <tbody>
                  {(rows as any[]).map((r,i)=>(
                    <tr key={i} className="border-b border-border/60">
                      <td className="p-2">{r.structure_name ?? "—"}</td>
                      <td className="p-2"><Badge variant="outline">{r.priority}</Badge></td>
                      <td className="p-2 text-right">{r.total_tickets}</td>
                      <td className="p-2 text-right">{r.ack_on_time}</td>
                      <td className="p-2 text-right">{r.resolve_on_time}</td>
                      <td className="p-2 text-right">{r.violated > 0 ? <Badge variant="destructive">{r.violated}</Badge> : 0}</td>
                      <td className="p-2 text-right font-mono">{r.ack_compliance_pct ?? "—"}</td>
                      <td className="p-2 text-right font-mono">{r.resolve_compliance_pct ?? "—"}</td>
                      <td className="p-2 text-right font-mono">{r.avg_resolve_minutes ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: any; tone?: "success"|"warning"|"destructive" }) {
  const cls = tone === "success" ? "text-emerald-500"
            : tone === "warning" ? "text-amber-500"
            : tone === "destructive" ? "text-destructive"
            : "text-foreground";
  return (
    <Card><CardContent className="p-4">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className={`mt-1 font-display text-3xl font-bold ${cls}`}>{value}</div>
    </CardContent></Card>
  );
}