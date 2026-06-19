import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { Activity, AlertTriangle, FileSignature, Receipt, Wrench, CalendarClock, ShieldCheck, ArrowUpRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/structure-kpi")({ component: Page });

function Page() {
  const [structureId, setStructureId] = useState<string>("");

  const { data: structures = [] } = useQuery({
    queryKey: ["structures-list"],
    queryFn: async () => (await supabase.from("structures").select("id,name").order("name")).data ?? [],
  });

  useEffect(() => {
    if (!structureId && structures.length > 0) setStructureId(structures[0].id);
  }, [structures, structureId]);

  const { data: kpi } = useQuery({
    queryKey: ["dashboard_structure_kpi", structureId],
    enabled: !!structureId,
    queryFn: async () => (await (supabase as any).rpc("dashboard_structure_kpi", { _structure: structureId })).data?.[0] ?? null,
  });
  const { data: weekly = [] } = useQuery({
    queryKey: ["dashboard_weekly_tickets", structureId],
    enabled: !!structureId,
    queryFn: async () => (await (supabase as any).rpc("dashboard_weekly_tickets", { _structure: structureId })).data ?? [],
  });
  const { data: topSuppliers = [] } = useQuery({
    queryKey: ["dashboard_top_suppliers", structureId],
    enabled: !!structureId,
    queryFn: async () => (await (supabase as any).rpc("dashboard_top_suppliers", { _structure: structureId })).data ?? [],
  });
  const { data: byCategory = [] } = useQuery({
    queryKey: ["dashboard_tickets_by_category", structureId],
    enabled: !!structureId,
    queryFn: async () => (await (supabase as any).rpc("dashboard_tickets_by_category", { _structure: structureId })).data ?? [],
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl">Dashboard KPI struttura</h1>
          <p className="text-sm text-muted-foreground">Stato operativo, SLA, contratti, costi e performance fornitori.</p>
        </div>
        <Select value={structureId} onValueChange={setStructureId}>
          <SelectTrigger className="w-72"><SelectValue placeholder="Seleziona struttura" /></SelectTrigger>
          <SelectContent>{structures.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Ticket aperti" value={kpi?.open_tickets ?? 0} icon={Activity} link="/app/tickets" />
        <KpiCard label="In ritardo" value={kpi?.overdue_tickets ?? 0} icon={AlertTriangle} tone={Number(kpi?.overdue_tickets ?? 0) > 0 ? "danger" : "ok"} />
        <KpiCard label="SLA risolti on time (30g)" value={kpi?.sla_resolve_30d_pct != null ? `${kpi.sla_resolve_30d_pct}%` : "—"} icon={ShieldCheck} link="/app/sla-compliance" />
        <KpiCard label="Contratti in scadenza 90g" value={kpi?.expiring_contracts_90d ?? 0} icon={FileSignature} link="/app/contracts" />
        <KpiCard label="Bollette ultimi 30g" value={kpi?.invoice_total_30d != null ? `€ ${Number(kpi.invoice_total_30d).toLocaleString("it-IT",{maximumFractionDigits:0})}` : "—"} icon={Receipt} link="/app/invoices" />
        <KpiCard label="Asset totali" value={kpi?.total_assets ?? 0} icon={Wrench} link="/app/assets" />
        <KpiCard label="Manutenzioni pending" value={kpi?.pending_maintenance ?? 0} icon={CalendarClock} link="/app/maintenance" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base font-display">Trend ticket (ultime 12 settimane)</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={(weekly as any[]).map(w => ({ week: new Date(w.week_start).toLocaleDateString("it-IT",{day:"2-digit",month:"2-digit"}), Aperti: Number(w.opened), Risolti: Number(w.resolved) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="week" tick={{fontSize:11}} /><YAxis tick={{fontSize:11}} />
                <Tooltip contentStyle={{background:"hsl(var(--card))",border:"1px solid hsl(var(--border))"}} />
                <Legend />
                <Line type="monotone" dataKey="Aperti" stroke="#f59e0b" strokeWidth={2} />
                <Line type="monotone" dataKey="Risolti" stroke="#0891b2" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base font-display">Ticket aperti per categoria</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={(byCategory as any[]).slice(0,8).map(c => ({ category: (c.category ?? "altro").slice(0,12), Ticket: Number(c.count) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="category" tick={{fontSize:11}} /><YAxis tick={{fontSize:11}} />
                <Tooltip contentStyle={{background:"hsl(var(--card))",border:"1px solid hsl(var(--border))"}} />
                <Bar dataKey="Ticket" fill="#0891b2" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base font-display">Top 5 fornitori (ultimi 90 giorni)</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <tr><th className="px-3 py-2">Fornitore</th><th className="px-3 py-2">Ticket gestiti</th><th className="px-3 py-2">Rating</th><th className="px-3 py-2"></th></tr>
            </thead>
            <tbody>
              {(topSuppliers as any[]).map(s => (
                <tr key={s.supplier_id} className="border-b border-border/60">
                  <td className="px-3 py-2">{s.supplier_name}</td>
                  <td className="px-3 py-2"><Badge variant="outline">{s.tickets_count}</Badge></td>
                  <td className="px-3 py-2 text-xs">{s.rating ?? "—"}{s.rating ? " ★" : ""}</td>
                  <td className="px-3 py-2 text-right"><Link to="/app/suppliers" className="text-xs text-primary inline-flex items-center gap-1">Dettagli<ArrowUpRight className="h-3 w-3"/></Link></td>
                </tr>
              ))}
              {topSuppliers.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">Nessun fornitore attivo nel periodo.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, link, tone }: { label: string; value: React.ReactNode; icon: any; link?: string; tone?: "ok"|"danger" }) {
  const body = (
    <Card className={tone === "danger" ? "border-destructive/40" : ""}>
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">{label}</CardTitle>
        <Icon className={`h-4 w-4 ${tone === "danger" ? "text-destructive" : "text-primary"}`} />
      </CardHeader>
      <CardContent><div className="text-2xl font-display">{value}</div></CardContent>
    </Card>
  );
  return link ? <Link to={link as any}>{body}</Link> : body;
}