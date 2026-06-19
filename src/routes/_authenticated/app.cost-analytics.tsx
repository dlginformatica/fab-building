import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveStructure } from "@/lib/structure-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend, LineChart, Line } from "recharts";
import { Activity, AlertTriangle, TrendingUp, Wallet } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const Route = createFileRoute("/_authenticated/app/cost-analytics")({ component: Page });

const AREAS = ["camere","spa","ristorante","cucina","aree_comuni","esterno","uffici","altro"] as const;
const COLORS = ["#0891b2","#f59e0b","#10b981","#ef4444","#8b5cf6","#64748b","#0f3a4a","#a3e635"];
const todayISO = () => new Date().toISOString().slice(0,10);
const daysAgoISO = (d:number) => new Date(Date.now()-d*86400000).toISOString().slice(0,10);
const eur = (n:number) => `€ ${(n||0).toLocaleString("it-IT",{minimumFractionDigits:2,maximumFractionDigits:2})}`;

function Page() {
  const { activeStructureId } = useActiveStructure();
  const [from, setFrom] = useState(daysAgoISO(180));
  const [to, setTo] = useState(todayISO());

  const { data } = useQuery({
    queryKey: ["cost-analytics", activeStructureId, from, to],
    enabled: !!activeStructureId,
    queryFn: async () => {
      const [inv, wo, viol, tickets] = await Promise.all([
        supabase.from("invoices").select("amount_total,issue_date,area,utility_type,status").eq("structure_id", activeStructureId!).gte("issue_date", from).lte("issue_date", to),
        supabase.from("work_orders").select("cost,created_at,area,status").eq("structure_id", activeStructureId!).gte("created_at", from).lte("created_at", to+"T23:59:59"),
        (supabase as any).from("sla_violations").select("penalty_eur,created_at,ticket_id").eq("structure_id", activeStructureId!).gte("created_at", from).lte("created_at", to+"T23:59:59"),
        supabase.from("tickets").select("id,area,created_at,resolved_at,resolve_due_at").eq("structure_id", activeStructureId!).gte("created_at", from).lte("created_at", to+"T23:59:59"),
      ]);
      return { inv: inv.data ?? [], wo: wo.data ?? [], viol: viol.data ?? [], tickets: tickets.data ?? [] };
    },
  });

  const stats = useMemo(() => {
    const empty = AREAS.map(a => ({ area: a, fatture: 0, ordini: 0, penali: 0, tickets: 0, totale: 0 }));
    if (!data) return { byArea: empty, byMonth: [], totals: { inv: 0, wo: 0, pen: 0 }, slaByArea: [] };
    const map: Record<string, any> = Object.fromEntries(empty.map(e => [e.area, { ...e }]));
    for (const r of data.inv as any[]) {
      const k = r.area ?? "altro";
      map[k] = map[k] || { area: k, fatture: 0, ordini: 0, penali: 0, tickets: 0, totale: 0 };
      map[k].fatture += Number(r.amount_total || 0);
    }
    for (const r of data.wo as any[]) {
      const k = r.area ?? "altro";
      map[k] = map[k] || { area: k, fatture: 0, ordini: 0, penali: 0, tickets: 0, totale: 0 };
      map[k].ordini += Number(r.cost || 0);
    }
    const ticketArea = new Map<string,string>();
    for (const t of data.tickets as any[]) {
      const k = t.area ?? "altro";
      ticketArea.set(t.id, k);
      map[k] = map[k] || { area: k, fatture: 0, ordini: 0, penali: 0, tickets: 0, totale: 0 };
      map[k].tickets++;
    }
    for (const v of data.viol as any[]) {
      const k = ticketArea.get(v.ticket_id) ?? "altro";
      map[k] = map[k] || { area: k, fatture: 0, ordini: 0, penali: 0, tickets: 0, totale: 0 };
      map[k].penali += Number(v.penalty_eur || 0);
    }
    const byArea = Object.values(map).map((r:any) => ({ ...r, totale: r.fatture + r.ordini + r.penali }));
    // by month
    const months: Record<string, any> = {};
    for (const r of data.inv as any[]) {
      const m = (r.issue_date as string).slice(0,7);
      months[m] = months[m] || { mese: m, fatture: 0, ordini: 0, penali: 0 };
      months[m].fatture += Number(r.amount_total || 0);
    }
    for (const r of data.wo as any[]) {
      const m = (r.created_at as string).slice(0,7);
      months[m] = months[m] || { mese: m, fatture: 0, ordini: 0, penali: 0 };
      months[m].ordini += Number(r.cost || 0);
    }
    for (const r of data.viol as any[]) {
      const m = (r.created_at as string).slice(0,7);
      months[m] = months[m] || { mese: m, fatture: 0, ordini: 0, penali: 0 };
      months[m].penali += Number(r.penalty_eur || 0);
    }
    const byMonth = Object.values(months).sort((a:any,b:any)=>a.mese.localeCompare(b.mese));
    // SLA per area
    const slaMap: Record<string, { area: string; chiusi: number; in_sla: number }> = {};
    for (const t of data.tickets as any[]) {
      const k = t.area ?? "altro";
      slaMap[k] = slaMap[k] || { area: k, chiusi: 0, in_sla: 0 };
      if (t.resolved_at) {
        slaMap[k].chiusi++;
        if (t.resolve_due_at && new Date(t.resolved_at) <= new Date(t.resolve_due_at)) slaMap[k].in_sla++;
      }
    }
    const slaByArea = Object.values(slaMap).map(r => ({ area: r.area, pct: r.chiusi ? Math.round(100*r.in_sla/r.chiusi) : 0, chiusi: r.chiusi }));
    const totals = byArea.reduce((a,b)=>({ inv: a.inv+b.fatture, wo: a.wo+b.ordini, pen: a.pen+b.penali }), { inv: 0, wo: 0, pen: 0 });
    return { byArea, byMonth, totals, slaByArea };
  }, [data]);

  const exportPdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text("HotelOps · Analisi costi per area", 14, 16);
    doc.setFontSize(10); doc.text(`Periodo: ${from} → ${to}`, 14, 22);
    autoTable(doc, { startY: 28, head: [["Area","Fatture €","Ordini €","Penali €","Totale €","# Ticket"]],
      body: stats.byArea.map((r:any) => [r.area, eur(r.fatture), eur(r.ordini), eur(r.penali), eur(r.totale), String(r.tickets)]),
      foot: [["TOTALE", eur(stats.totals.inv), eur(stats.totals.wo), eur(stats.totals.pen), eur(stats.totals.inv+stats.totals.wo+stats.totals.pen), ""]],
    });
    autoTable(doc, { head: [["Area","% SLA OK","Ticket chiusi"]], body: stats.slaByArea.map((r:any) => [r.area, `${r.pct}%`, String(r.chiusi)]) });
    doc.save(`costi-aree_${from}_${to}.pdf`);
  };

  if (!activeStructureId) return <div className="p-10 text-center text-sm text-muted-foreground">Seleziona una struttura.</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2"><TrendingUp className="h-5 w-5"/>Costi per area</h1>
          <p className="text-sm text-muted-foreground">Camere, SPA, ristorante, cucina, aree comuni: KPI executive 5★.</p>
        </div>
        <div className="ml-auto flex items-end gap-2">
          <div><Label>Da</Label><Input type="date" value={from} onChange={(e)=>setFrom(e.target.value)}/></div>
          <div><Label>A</Label><Input type="date" value={to} onChange={(e)=>setTo(e.target.value)}/></div>
          <Button onClick={exportPdf}>Esporta PDF</Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Kpi icon={<Wallet className="h-4 w-4"/>} label="Fatture & bollette" value={eur(stats.totals.inv)} />
        <Kpi icon={<Activity className="h-4 w-4"/>} label="Ordini di lavoro" value={eur(stats.totals.wo)} />
        <Kpi icon={<AlertTriangle className="h-4 w-4"/>} label="Penali SLA" value={eur(stats.totals.pen)} tone="warn"/>
        <Kpi icon={<TrendingUp className="h-4 w-4"/>} label="Spesa operativa totale" value={eur(stats.totals.inv + stats.totals.wo + stats.totals.pen)} tone="primary"/>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Spesa per area (€)</CardTitle></CardHeader>
          <CardContent style={{height:300}}>
            <ResponsiveContainer>
              <BarChart data={stats.byArea}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2}/>
                <XAxis dataKey="area" fontSize={10}/><YAxis fontSize={10}/><Tooltip formatter={(v:any)=>eur(Number(v))}/>
                <Legend/>
                <Bar dataKey="fatture" stackId="a" fill="#0891b2" name="Fatture"/>
                <Bar dataKey="ordini"  stackId="a" fill="#10b981" name="Ordini"/>
                <Bar dataKey="penali"  stackId="a" fill="#ef4444" name="Penali"/>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Ripartizione spesa totale</CardTitle></CardHeader>
          <CardContent style={{height:300}}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={stats.byArea.filter((r:any)=>r.totale>0)} dataKey="totale" nameKey="area" outerRadius={100} label={(e:any)=>`${e.area} ${eur(e.totale)}`}>
                  {stats.byArea.map((_:any,i:number)=>(<Cell key={i} fill={COLORS[i%COLORS.length]}/>))}
                </Pie>
                <Tooltip formatter={(v:any)=>eur(Number(v))}/>
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-sm">Trend mensile</CardTitle></CardHeader>
          <CardContent style={{height:280}}>
            <ResponsiveContainer>
              <LineChart data={stats.byMonth}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2}/>
                <XAxis dataKey="mese" fontSize={10}/><YAxis fontSize={10}/><Tooltip formatter={(v:any)=>eur(Number(v))}/><Legend/>
                <Line type="monotone" dataKey="fatture" stroke="#0891b2"/>
                <Line type="monotone" dataKey="ordini"  stroke="#10b981"/>
                <Line type="monotone" dataKey="penali"  stroke="#ef4444"/>
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-sm">SLA per area</CardTitle></CardHeader>
          <CardContent style={{height:240}}>
            <ResponsiveContainer>
              <BarChart data={stats.slaByArea}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2}/>
                <XAxis dataKey="area" fontSize={10}/><YAxis domain={[0,100]} fontSize={10}/><Tooltip formatter={(v:any,n:string)=>n==="pct"?`${v}%`:v}/>
                <Bar dataKey="pct" fill="#0891b2" name="% SLA OK"/>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Dettaglio per area</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <tr><th className="px-4 py-2">Area</th><th className="px-4 py-2 text-right">Fatture</th><th className="px-4 py-2 text-right">Ordini</th><th className="px-4 py-2 text-right">Penali</th><th className="px-4 py-2 text-right">Ticket</th><th className="px-4 py-2 text-right">Totale</th></tr>
            </thead>
            <tbody>
              {stats.byArea.map((r:any)=>(
                <tr key={r.area} className="border-b border-border/60">
                  <td className="px-4 py-2 font-medium">{r.area}</td>
                  <td className="px-4 py-2 text-right">{eur(r.fatture)}</td>
                  <td className="px-4 py-2 text-right">{eur(r.ordini)}</td>
                  <td className="px-4 py-2 text-right text-destructive">{eur(r.penali)}</td>
                  <td className="px-4 py-2 text-right">{r.tickets}</td>
                  <td className="px-4 py-2 text-right font-semibold">{eur(r.totale)}</td>
                </tr>
              ))}
              <tr className="bg-muted/40 font-semibold">
                <td className="px-4 py-2">TOTALE</td>
                <td className="px-4 py-2 text-right">{eur(stats.totals.inv)}</td>
                <td className="px-4 py-2 text-right">{eur(stats.totals.wo)}</td>
                <td className="px-4 py-2 text-right">{eur(stats.totals.pen)}</td>
                <td className="px-4 py-2 text-right">—</td>
                <td className="px-4 py-2 text-right">{eur(stats.totals.inv+stats.totals.wo+stats.totals.pen)}</td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone?: "warn"|"primary" }) {
  const c = tone === "warn" ? "text-warning" : tone === "primary" ? "text-primary" : "text-foreground";
  return (
    <Card>
      <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground flex items-center gap-2">{icon}{label}</CardTitle></CardHeader>
      <CardContent><div className={`font-display text-2xl font-bold ${c}`}>{value}</div></CardContent>
    </Card>
  );
}