import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveStructure } from "@/lib/structure-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { BedDouble, MessageSquare, ShieldCheck, Receipt, Leaf, Download, Activity } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { exportPDF, type Column } from "@/lib/exports";

export const Route = createFileRoute("/_authenticated/app/overview")({ component: Page });

function Page() {
  const { activeStructureId } = useActiveStructure();
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);

  const { data: hk } = useQuery({
    queryKey: ["ov_hk", activeStructureId, to], enabled: !!activeStructureId,
    queryFn: async () => (await (supabase as any).rpc("housekeeping_kpi", { _structure: activeStructureId, _date: to })).data?.[0] ?? null,
  });
  const { data: guestOpen = 0 } = useQuery({
    queryKey: ["ov_guest", activeStructureId], enabled: !!activeStructureId,
    queryFn: async () => (await (supabase as any).from("guest_issues").select("id", { count: "exact", head: true }).eq("structure_id", activeStructureId).eq("status", "new")).count ?? 0,
  });
  const { data: alerts = [] } = useQuery({
    queryKey: ["ov_alerts", activeStructureId], enabled: !!activeStructureId,
    queryFn: async () => (await (supabase as any).rpc("alerts_for_structure", { _structure: activeStructureId })).data ?? [],
  });
  const { data: invoices = [] } = useQuery({
    queryKey: ["ov_inv", activeStructureId, from, to], enabled: !!activeStructureId,
    queryFn: async () => (await (supabase as any).from("invoices").select("amount_total,status,issue_date,due_date").eq("structure_id", activeStructureId).gte("issue_date", from).lte("issue_date", to)).data ?? [],
  });
  const { data: tickets = [] } = useQuery({
    queryKey: ["ov_tk", activeStructureId, from, to], enabled: !!activeStructureId,
    queryFn: async () => (await (supabase as any).from("tickets").select("status,resolved_at,resolve_due_at,created_at").eq("structure_id", activeStructureId).gte("created_at", from + "T00:00:00").lte("created_at", to + "T23:59:59")).data ?? [],
  });
  const { data: readings = [] } = useQuery({
    queryKey: ["ov_meters", from, to], enabled: !!activeStructureId,
    queryFn: async () => (await (supabase as any).from("meter_readings").select("reading_date,value,utility_meters(utility_type)").gte("reading_date", from).lte("reading_date", to).order("reading_date")).data ?? [],
  });

  const stats = useMemo(() => {
    const closed = tickets.filter((t: any) => t.resolved_at).length;
    const inSla = tickets.filter((t: any) => t.resolved_at && t.resolve_due_at && new Date(t.resolved_at) <= new Date(t.resolve_due_at)).length;
    const due = invoices.filter((i: any) => i.status === "da_pagare").reduce((s: number, i: any) => s + Number(i.amount_total || 0), 0);
    const paid = invoices.filter((i: any) => i.status === "pagata").reduce((s: number, i: any) => s + Number(i.amount_total || 0), 0);
    return { closed, slaPct: closed ? Math.round((inSla / closed) * 100) : null, due, paid };
  }, [tickets, invoices]);

  const energyTrend = useMemo(() => {
    const byDay: Record<string, number> = {};
    for (const r of readings) {
      const t = r.utility_meters?.utility_type;
      if (t !== "elettrica") continue;
      byDay[r.reading_date] = (byDay[r.reading_date] ?? 0) + Number(r.value || 0);
    }
    return Object.entries(byDay).map(([d, v]) => ({ date: d.slice(5), kWh: v }));
  }, [readings]);

  const cols: Column<any>[] = [
    { header: "KPI", key: "k" }, { header: "Valore", key: "v" },
  ];
  const exportPdf = () => exportPDF(`overview_${Date.now()}`, "Overview struttura", [
    { k: "Camere pulite", v: hk?.clean ?? 0 },
    { k: "Camere sporche", v: hk?.dirty ?? 0 },
    { k: "Segnalazioni ospiti aperte", v: guestOpen },
    { k: "Alert attivi", v: alerts.length },
    { k: "Ticket chiusi nel periodo", v: stats.closed },
    { k: "% SLA rispettati", v: stats.slaPct != null ? `${stats.slaPct}%` : "—" },
    { k: "Fatture da pagare €", v: stats.due.toFixed(2) },
    { k: "Fatture pagate €", v: stats.paid.toFixed(2) },
  ], cols, `Periodo ${from} → ${to}`);

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold flex items-center gap-2"><Activity className="h-6 w-6"/>Overview unificata</h1>
          <p className="text-sm text-muted-foreground">KPI e trend di Housekeeping, Guest, SLA, Fatture ed ESG, filtrabili per periodo.</p>
        </div>
        <div className="flex items-end gap-2">
          <div><Label className="text-xs">Da</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40"/></div>
          <div><Label className="text-xs">A</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40"/></div>
          <Button variant="outline" size="sm" onClick={exportPdf}><Download className="h-4 w-4 mr-1"/>PDF</Button>
        </div>
      </header>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <Tile icon={BedDouble} label="Housekeeping" sub={`${hk?.clean ?? 0} pulite · ${hk?.dirty ?? 0} sporche`} value={hk ? `${hk.clean + hk.inspected}/${hk.total ?? 0}` : "—"} href="/app/housekeeping"/>
        <Tile icon={MessageSquare} label="Segnalazioni ospiti" value={String(guestOpen)} sub="nuove da gestire" href="/app/guest-issues"/>
        <Tile icon={ShieldCheck} label="SLA periodo" value={stats.slaPct != null ? `${stats.slaPct}%` : "—"} sub={`${stats.closed} chiusi`} href="/app/sla-compliance"/>
        <Tile icon={Receipt} label="Fatture" value={`€ ${stats.due.toFixed(0)}`} sub={`da pagare · pagate € ${stats.paid.toFixed(0)}`} href="/app/invoices"/>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Leaf className="h-4 w-4 text-emerald-500"/>Consumi elettrici nel periodo</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={energyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))"/>
                <XAxis dataKey="date" tick={{ fontSize: 11 }}/><YAxis tick={{ fontSize: 11 }}/>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}/>
                <Line dataKey="kWh" stroke="#10b981" strokeWidth={2} dot={false}/>
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Alert recenti</CardTitle></CardHeader>
          <CardContent className="space-y-2 max-h-[256px] overflow-y-auto">
            {alerts.length === 0 ? <p className="text-sm text-muted-foreground">Nessun alert attivo.</p> :
              alerts.slice(0, 10).map((a: any, i: number) => (
                <div key={i} className="rounded-md border border-border/40 p-2 text-sm">
                  <div className="flex justify-between">
                    <Badge variant="outline" className={a.severity === "high" ? "bg-red-500/10 text-red-500" : "bg-amber-500/10 text-amber-500"}>{a.severity}</Badge>
                    <span className="text-xs text-muted-foreground">{a.due_at ? new Date(a.due_at).toLocaleDateString("it-IT") : "—"}</span>
                  </div>
                  <p className="mt-1 font-medium">{a.title}</p>
                  <p className="text-xs text-muted-foreground">{a.detail}</p>
                </div>
              ))
            }
            <Link to="/app/alerts" className="block text-xs text-primary hover:underline">Vai a tutti gli alert →</Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Tile({ icon: Icon, label, value, sub, href }: { icon: any; label: string; value: string; sub: string; href: string }) {
  return (
    <Link to={href as any} className="block rounded-lg border border-border/40 bg-card/40 p-4 hover:bg-muted/40 transition-colors">
      <div className="flex items-center justify-between"><span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span><Icon className="h-4 w-4 text-primary"/></div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </Link>
  );
}