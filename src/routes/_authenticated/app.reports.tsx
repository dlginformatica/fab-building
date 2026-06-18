import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveStructure } from "@/lib/structure-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/app/reports")({ component: Page });

function Page() {
  const { activeStructureId } = useActiveStructure();
  const { data: kpis } = useQuery({
    queryKey: ["reports-kpi", activeStructureId], enabled: !!activeStructureId,
    queryFn: async () => {
      const [tickets, invoices, wo, inv] = await Promise.all([
        supabase.from("tickets").select("status,priority,resolve_due_at,resolved_at").eq("structure_id", activeStructureId!),
        supabase.from("invoices").select("amount_total,status,utility_type").eq("structure_id", activeStructureId!),
        supabase.from("work_orders").select("status,cost").eq("structure_id", activeStructureId!),
        supabase.from("inventory_items").select("quantity,min_quantity,unit_cost").eq("structure_id", activeStructureId!),
      ]);
      const t = tickets.data ?? [];
      const inSla = t.filter((x:any)=>x.resolved_at && x.resolve_due_at && new Date(x.resolved_at)<=new Date(x.resolve_due_at)).length;
      const closed = t.filter((x:any)=>x.resolved_at).length;
      const ivs = invoices.data ?? [];
      return {
        ticketTotal: t.length,
        ticketOpen: t.filter((x:any)=>!["risolto","chiuso","annullato"].includes(x.status)).length,
        slaCompliance: closed ? Math.round((inSla/closed)*100) : null,
        invoiceTotalDue: ivs.filter((x:any)=>x.status==="da_pagare").reduce((a:any,b:any)=>a+Number(b.amount_total||0),0),
        invoicePaid: ivs.filter((x:any)=>x.status==="pagata").reduce((a:any,b:any)=>a+Number(b.amount_total||0),0),
        woTotal: (wo.data ?? []).length,
        woCost: (wo.data ?? []).reduce((a:any,b:any)=>a+Number(b.cost||0),0),
        invLowStock: (inv.data ?? []).filter((x:any)=>Number(x.quantity)<=Number(x.min_quantity)).length,
        invValue: (inv.data ?? []).reduce((a:any,b:any)=>a+Number(b.quantity||0)*Number(b.unit_cost||0),0),
      };
    },
  });
  if (!activeStructureId) return <div className="p-10 text-center text-sm text-muted-foreground">Seleziona una struttura.</div>;
  const cards = [
    { t: "Ticket totali", v: kpis?.ticketTotal ?? 0 },
    { t: "Ticket aperti", v: kpis?.ticketOpen ?? 0 },
    { t: "% SLA rispettati", v: kpis?.slaCompliance != null ? `${kpis.slaCompliance}%` : "—" },
    { t: "€ Fatture da pagare", v: `€${(kpis?.invoiceTotalDue ?? 0).toFixed(2)}` },
    { t: "€ Fatture pagate", v: `€${(kpis?.invoicePaid ?? 0).toFixed(2)}` },
    { t: "Ordini di lavoro", v: kpis?.woTotal ?? 0 },
    { t: "€ Costo interventi", v: `€${(kpis?.woCost ?? 0).toFixed(2)}` },
    { t: "Articoli sotto-scorta", v: kpis?.invLowStock ?? 0 },
    { t: "€ Valore magazzino", v: `€${(kpis?.invValue ?? 0).toFixed(2)}` },
  ];
  return (
    <div className="space-y-6">
      <div><h1 className="font-display text-2xl font-bold">Report direzionale</h1><p className="text-sm text-muted-foreground">KPI operativi e finanziari di struttura.</p></div>
      <div className="grid gap-3 md:grid-cols-3">
        {cards.map(c=>(
          <Card key={c.t}><CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">{c.t}</CardTitle></CardHeader>
            <CardContent><div className="font-display text-3xl font-bold">{c.v}</div></CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}