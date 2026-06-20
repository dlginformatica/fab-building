import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveStructure } from "@/lib/structure-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";
import { TrendingUp, TrendingDown, Minus, Download } from "lucide-react";
import { exportCSV } from "@/lib/exports";

export const Route = createFileRoute("/_authenticated/app/trends")({ component: Page });

// Benchmark per camera/anno (PMI italiane)
const BENCH = { energy_kwh: 3200, water_mc: 130, gas_smc: 380, sla_compliance_pct: 90 };

type Row = {
  month: string;
  tickets_opened: number; tickets_resolved: number;
  sla_compliance_pct: number | null;
  invoices_total: number; energy_kwh: number; water_mc: number; gas_smc: number;
  housekeeping_done: number; guest_issues: number;
};

function Page() {
  const { activeStructureId } = useActiveStructure();
  const [metric, setMetric] = useState<keyof Row>("tickets_opened");
  const now = new Date();
  const yearStart = `${now.getFullYear()}-01-01`;
  const yearEnd = `${now.getFullYear()}-12-31`;
  const prevStart = `${now.getFullYear() - 1}-01-01`;
  const prevEnd = `${now.getFullYear() - 1}-12-31`;

  const { data: cur = [] } = useQuery({
    queryKey: ["trends_cur", activeStructureId, yearStart, yearEnd],
    enabled: !!activeStructureId,
    queryFn: async () => (await (supabase as any).rpc("trends_monthly", { _structure: activeStructureId, _from: yearStart, _to: yearEnd })).data ?? [],
  });
  const { data: prev = [] } = useQuery({
    queryKey: ["trends_prev", activeStructureId, prevStart, prevEnd],
    enabled: !!activeStructureId,
    queryFn: async () => (await (supabase as any).rpc("trends_monthly", { _structure: activeStructureId, _from: prevStart, _to: prevEnd })).data ?? [],
  });

  const chartData = useMemo(() => {
    return (cur as Row[]).map((r, i) => {
      const p = (prev as Row[])[i];
      const label = new Date(r.month).toLocaleDateString("it-IT", { month: "short" });
      return {
        month: label,
        current: Number(r[metric] ?? 0),
        previous: Number(p?.[metric] ?? 0),
      };
    });
  }, [cur, prev, metric]);

  const totals = useMemo(() => {
    const sum = (arr: Row[], k: keyof Row) => arr.reduce((s, r) => s + Number(r[k] ?? 0), 0);
    const t = { current: sum(cur as Row[], metric), previous: sum(prev as Row[], metric) };
    const delta = t.previous === 0 ? 0 : ((t.current - t.previous) / t.previous) * 100;
    return { ...t, delta };
  }, [cur, prev, metric]);

  const METRICS: Array<{ key: keyof Row; label: string }> = [
    { key: "tickets_opened", label: "Ticket aperti" },
    { key: "tickets_resolved", label: "Ticket risolti" },
    { key: "sla_compliance_pct", label: "SLA compliance %" },
    { key: "invoices_total", label: "Fatture totali €" },
    { key: "energy_kwh", label: "Energia kWh" },
    { key: "water_mc", label: "Acqua mc" },
    { key: "gas_smc", label: "Gas Smc" },
    { key: "housekeeping_done", label: "Housekeeping completati" },
    { key: "guest_issues", label: "Segnalazioni ospiti" },
  ];

  const benchmark = (BENCH as any)[metric] as number | undefined;

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Trend avanzati · YoY</h1>
          <p className="text-sm text-muted-foreground">Confronto anno su anno per ogni KPI con benchmark di settore quando disponibile.</p>
        </div>
        <div className="flex gap-2">
          <Select value={metric as string} onValueChange={(v) => setMetric(v as keyof Row)}>
            <SelectTrigger className="w-[240px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {METRICS.map((m) => <SelectItem key={m.key as string} value={m.key as string}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => exportCSV(`trend_${String(metric)}.csv`, chartData, [
            { header: "Mese", key: "month" }, { header: now.getFullYear().toString(), key: "current" }, { header: (now.getFullYear() - 1).toString(), key: "previous" }
          ])}><Download className="h-4 w-4 mr-1" />CSV</Button>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm">Totale {now.getFullYear()}</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-semibold tabular-nums">{totals.current.toFixed(0)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm">Totale {now.getFullYear() - 1}</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-semibold tabular-nums text-muted-foreground">{totals.previous.toFixed(0)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm">Variazione</CardTitle></CardHeader>
          <CardContent className="flex items-center gap-2">
            {totals.delta > 0 ? <TrendingUp className="h-6 w-6 text-emerald-500" /> : totals.delta < 0 ? <TrendingDown className="h-6 w-6 text-red-500" /> : <Minus className="h-6 w-6" />}
            <span className="text-3xl font-semibold">{totals.delta.toFixed(1)}%</span>
            {benchmark !== undefined && <Badge variant="outline" className="ml-auto">Benchmark: {benchmark}</Badge>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Andamento mensile</CardTitle></CardHeader>
        <CardContent style={{ height: 360 }}>
          <ResponsiveContainer>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="month" /><YAxis /><Tooltip /><Legend />
              <Line type="monotone" dataKey="current" name={now.getFullYear().toString()} stroke="#0891b2" strokeWidth={2} />
              <Line type="monotone" dataKey="previous" name={(now.getFullYear() - 1).toString()} stroke="#94a3b8" strokeDasharray="4 4" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {!activeStructureId && <p className="text-sm text-muted-foreground">Seleziona una struttura per vedere i trend.</p>}
    </div>
  );
}