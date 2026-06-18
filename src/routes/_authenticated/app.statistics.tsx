import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveStructure } from "@/lib/structure-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const Route = createFileRoute("/_authenticated/app/statistics")({ component: Page });

const COLORS = ["#0891b2","#f59e0b","#10b981","#ef4444","#8b5cf6","#64748b"];
const todayISO = () => new Date().toISOString().slice(0,10);
const daysAgoISO = (d: number) => new Date(Date.now()-d*86400000).toISOString().slice(0,10);

function Page() {
  const { activeStructureId } = useActiveStructure();
  const [from, setFrom] = useState(daysAgoISO(90));
  const [to, setTo] = useState(todayISO());

  const { data } = useQuery({
    queryKey: ["stats", activeStructureId, from, to],
    enabled: !!activeStructureId,
    queryFn: async () => {
      const [tickets, viols, wo, inv] = await Promise.all([
        supabase.from("tickets").select("created_at,resolved_at,resolve_due_at,priority,status").eq("structure_id", activeStructureId!).gte("created_at", from).lte("created_at", to+"T23:59:59"),
        (supabase as any).from("sla_violations").select("created_at,penalty_eur,delay_minutes").eq("structure_id", activeStructureId!).gte("created_at", from).lte("created_at", to+"T23:59:59"),
        supabase.from("work_orders").select("status,cost,created_at").eq("structure_id", activeStructureId!).gte("created_at", from).lte("created_at", to+"T23:59:59"),
        supabase.from("invoices").select("amount_total,status,issue_date,utility_type").eq("structure_id", activeStructureId!).gte("issue_date", from).lte("issue_date", to),
      ]);
      return { tickets: tickets.data ?? [], viols: viols.data ?? [], wo: wo.data ?? [], inv: inv.data ?? [] };
    },
  });

  const series = useMemo(() => {
    if (!data) return { byDay: [], byPriority: [], byStatus: [], penaltyByDay: [], invByType: [] };
    const days: Record<string, any> = {};
    const pen: Record<string, number> = {};
    for (const t of data.tickets as any[]) {
      const d = (t.created_at as string).slice(0,10);
      days[d] = days[d] || { date: d, aperti: 0, risolti: 0 };
      days[d].aperti++;
      if (t.resolved_at) days[d].risolti++;
    }
    for (const v of data.viols as any[]) {
      const d = (v.created_at as string).slice(0,10);
      pen[d] = (pen[d] || 0) + Number(v.penalty_eur || 0);
    }
    const byPriority = Object.entries((data.tickets as any[]).reduce((a:any,b:any)=>(a[b.priority]=(a[b.priority]||0)+1,a),{})).map(([k,v])=>({name:k,value:v as number}));
    const byStatus = Object.entries((data.tickets as any[]).reduce((a:any,b:any)=>(a[b.status]=(a[b.status]||0)+1,a),{})).map(([k,v])=>({name:k,value:v as number}));
    const invByType = Object.entries((data.inv as any[]).reduce((a:any,b:any)=>(a[b.utility_type||"altro"]=(a[b.utility_type||"altro"]||0)+Number(b.amount_total||0),a),{})).map(([k,v])=>({name:k,value:Number(v)}));
    return {
      byDay: Object.values(days).sort((a:any,b:any)=>a.date.localeCompare(b.date)),
      byPriority, byStatus,
      penaltyByDay: Object.entries(pen).sort().map(([date,val])=>({date,penali:val})),
      invByType,
    };
  }, [data]);

  const kpis = useMemo(() => {
    if (!data) return null;
    const t = data.tickets as any[];
    const closed = t.filter(x => x.resolved_at);
    const inSla = closed.filter(x => x.resolve_due_at && new Date(x.resolved_at) <= new Date(x.resolve_due_at)).length;
    const mttr = closed.length ? closed.reduce((a,b)=>a+(new Date(b.resolved_at).getTime()-new Date(b.created_at).getTime()),0)/closed.length/3600000 : 0;
    const totalPenalty = (data.viols as any[]).reduce((a:number,b:any)=>a+Number(b.penalty_eur||0),0);
    return {
      total: t.length, closed: closed.length,
      slaPct: closed.length ? Math.round((inSla/closed.length)*100) : null,
      mttr: mttr.toFixed(1),
      violations: (data.viols as any[]).length,
      totalPenalty,
      invTotal: (data.inv as any[]).reduce((a,b:any)=>a+Number(b.amount_total||0),0),
    };
  }, [data]);

  const exportPdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text("HotelOps - Statistiche operative", 14, 18);
    doc.setFontSize(10); doc.text(`Periodo: ${from} → ${to}`, 14, 26);
    autoTable(doc, { startY: 32, head: [["KPI","Valore"]], body: [
      ["Ticket totali", String(kpis?.total ?? 0)],
      ["Ticket chiusi", String(kpis?.closed ?? 0)],
      ["% SLA rispettati", kpis?.slaPct != null ? `${kpis.slaPct}%` : "—"],
      ["MTTR (ore)", String(kpis?.mttr ?? 0)],
      ["Violazioni SLA", String(kpis?.violations ?? 0)],
      ["Totale penali", `€${(kpis?.totalPenalty ?? 0).toFixed(2)}`],
      ["Totale fatture", `€${(kpis?.invTotal ?? 0).toFixed(2)}`],
    ] });
    autoTable(doc, { head: [["Data","Ticket aperti","Risolti"]], body: series.byDay.map((d:any)=>[d.date,d.aperti,d.risolti]) });
    doc.save(`statistiche-${from}_${to}.pdf`);
  };

  if (!activeStructureId) return <div className="p-10 text-center text-sm text-muted-foreground">Seleziona una struttura.</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div><h1 className="font-display text-2xl font-bold">Statistiche</h1><p className="text-sm text-muted-foreground">Analisi periodica con calcolo SLA e penali.</p></div>
        <div className="ml-auto flex items-end gap-2">
          <div><Label>Da</Label><Input type="date" value={from} onChange={(e)=>setFrom(e.target.value)} /></div>
          <div><Label>A</Label><Input type="date" value={to} onChange={(e)=>setTo(e.target.value)} /></div>
          <Button onClick={exportPdf}>Esporta PDF</Button>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        {[
          {t:"Ticket totali",v:kpis?.total??0},
          {t:"% SLA OK",v:kpis?.slaPct!=null?`${kpis.slaPct}%`:"—"},
          {t:"MTTR (h)",v:kpis?.mttr??0},
          {t:"€ Penali",v:`€${(kpis?.totalPenalty??0).toFixed(2)}`},
        ].map(c=>(<Card key={c.t}><CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">{c.t}</CardTitle></CardHeader><CardContent><div className="font-display text-2xl font-bold">{c.v}</div></CardContent></Card>))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader><CardTitle className="text-sm">Ticket per giorno</CardTitle></CardHeader><CardContent style={{height:260}}>
          <ResponsiveContainer><LineChart data={series.byDay}><CartesianGrid strokeDasharray="3 3" opacity={0.2} /><XAxis dataKey="date" fontSize={10} /><YAxis fontSize={10} /><Tooltip /><Legend /><Line type="monotone" dataKey="aperti" stroke="#0891b2" /><Line type="monotone" dataKey="risolti" stroke="#10b981" /></LineChart></ResponsiveContainer>
        </CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Penali nel periodo (€)</CardTitle></CardHeader><CardContent style={{height:260}}>
          <ResponsiveContainer><BarChart data={series.penaltyByDay}><CartesianGrid strokeDasharray="3 3" opacity={0.2} /><XAxis dataKey="date" fontSize={10} /><YAxis fontSize={10} /><Tooltip /><Bar dataKey="penali" fill="#f59e0b" /></BarChart></ResponsiveContainer>
        </CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Ticket per priorità</CardTitle></CardHeader><CardContent style={{height:260}}>
          <ResponsiveContainer><PieChart><Pie data={series.byPriority} dataKey="value" nameKey="name" outerRadius={80} label>{series.byPriority.map((_,i)=>(<Cell key={i} fill={COLORS[i%COLORS.length]} />))}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer>
        </CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Fatture per tipo (€)</CardTitle></CardHeader><CardContent style={{height:260}}>
          <ResponsiveContainer><BarChart data={series.invByType}><CartesianGrid strokeDasharray="3 3" opacity={0.2} /><XAxis dataKey="name" fontSize={10} /><YAxis fontSize={10} /><Tooltip /><Bar dataKey="value" fill="#0891b2" /></BarChart></ResponsiveContainer>
        </CardContent></Card>
      </div>
    </div>
  );
}