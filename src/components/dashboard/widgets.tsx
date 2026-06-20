import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Ticket as TicketIcon, Wrench, Receipt, Package, Truck, Clock } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { fmtDateTime, fmtEUR, timeUntil } from "@/lib/format";

export type WidgetKey =
  | "kpi_open_tickets" | "kpi_critical_tickets" | "kpi_sla_pct" | "kpi_assets"
  | "kpi_open_invoices" | "kpi_stock_value" | "kpi_active_suppliers"
  | "list_recent_tickets" | "list_sla_violations" | "list_open_work_orders"
  | "list_maintenance_due" | "list_low_stock";

export const WIDGET_CATALOG: Array<{ key: WidgetKey; label: string; defaultSize: "sm"|"md"|"lg"|"xl"; group: string }> = [
  { key: "kpi_open_tickets", label: "KPI: Ticket aperti", defaultSize: "sm", group: "KPI" },
  { key: "kpi_critical_tickets", label: "KPI: Ticket critici aperti", defaultSize: "sm", group: "KPI" },
  { key: "kpi_sla_pct", label: "KPI: Rispetto SLA", defaultSize: "sm", group: "KPI" },
  { key: "kpi_assets", label: "KPI: Asset censiti", defaultSize: "sm", group: "KPI" },
  { key: "kpi_open_invoices", label: "KPI: Fatture da pagare", defaultSize: "sm", group: "Economato" },
  { key: "kpi_stock_value", label: "KPI: Valore magazzino", defaultSize: "sm", group: "Magazzino" },
  { key: "kpi_active_suppliers", label: "KPI: Fornitori attivi", defaultSize: "sm", group: "Fornitori" },
  { key: "list_recent_tickets", label: "Lista: Ticket recenti", defaultSize: "lg", group: "Liste" },
  { key: "list_sla_violations", label: "Lista: Violazioni SLA", defaultSize: "md", group: "Liste" },
  { key: "list_open_work_orders", label: "Lista: Ordini di lavoro aperti", defaultSize: "md", group: "Liste" },
  { key: "list_maintenance_due", label: "Lista: Manutenzioni in scadenza", defaultSize: "md", group: "Liste" },
  { key: "list_low_stock", label: "Lista: Sotto-scorta magazzino", defaultSize: "md", group: "Liste" },
];

export function sizeClass(size: string) {
  switch (size) {
    case "sm": return "md:col-span-3";
    case "md": return "md:col-span-6";
    case "lg": return "md:col-span-8";
    case "xl": return "md:col-span-12";
    default: return "md:col-span-6";
  }
}

export function WidgetRenderer({ wkey, structureId, title }: { wkey: WidgetKey; structureId: string | null; title?: string }) {
  switch (wkey) {
    case "kpi_open_tickets": return <KPI title={title ?? "Ticket aperti"} icon={<TicketIcon className="h-4 w-4"/>} q={async()=>(await supabase.from("tickets").select("id",{count:"exact",head:true}).eq("structure_id",structureId!).in("status",["aperto","assegnato","in_corso"])).count ?? 0} dep={["k-open",structureId]} enabled={!!structureId}/>;
    case "kpi_critical_tickets": return <KPI title={title ?? "Ticket critici aperti"} accent icon={<AlertTriangle className="h-4 w-4 text-destructive"/>} q={async()=>(await supabase.from("tickets").select("id",{count:"exact",head:true}).eq("structure_id",structureId!).eq("priority","critica").in("status",["aperto","assegnato","in_corso"])).count ?? 0} dep={["k-crit",structureId]} enabled={!!structureId}/>;
    case "kpi_sla_pct": return <KpiSLA structureId={structureId} title={title ?? "Rispetto SLA"}/>;
    case "kpi_assets": return <KPI title={title ?? "Asset"} icon={<Wrench className="h-4 w-4"/>} q={async()=>(await supabase.from("assets").select("id",{count:"exact",head:true}).eq("structure_id",structureId!)).count ?? 0} dep={["k-ast",structureId]} enabled={!!structureId}/>;
    case "kpi_open_invoices": return <KPI title={title ?? "Fatture da pagare"} icon={<Receipt className="h-4 w-4"/>} q={async()=>(await supabase.from("invoices").select("id",{count:"exact",head:true}).eq("status","da_pagare")).count ?? 0} dep={["k-inv"]}/>;
    case "kpi_stock_value": return <KpiStockValue title={title ?? "Valore magazzino"}/>;
    case "kpi_active_suppliers": return <KPI title={title ?? "Fornitori attivi"} icon={<Truck className="h-4 w-4"/>} q={async()=>(await supabase.from("suppliers").select("id",{count:"exact",head:true}).eq("status","attivo")).count ?? 0} dep={["k-sup"]}/>;
    case "list_recent_tickets": return <ListRecentTickets structureId={structureId} title={title ?? "Ticket recenti"}/>;
    case "list_sla_violations": return <ListSLAViolations structureId={structureId} title={title ?? "Violazioni SLA"}/>;
    case "list_open_work_orders": return <ListOpenWOs structureId={structureId} title={title ?? "Ordini di lavoro aperti"}/>;
    case "list_maintenance_due": return <ListMaintenanceDue structureId={structureId} title={title ?? "Manutenzioni in scadenza"}/>;
    case "list_low_stock": return <ListLowStock title={title ?? "Sotto-scorta"}/>;
    default: return null;
  }
}

function KPI({ title, icon, q, dep, accent, enabled = true }: { title: string; icon: any; q: () => Promise<number | string>; dep: any[]; accent?: boolean; enabled?: boolean }) {
  const { data } = useQuery({ queryKey: dep, queryFn: q, enabled });
  return (
    <Card className={accent ? "border-destructive/40 h-full" : "h-full"}>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">{icon}{title}</div>
        <div className="mt-2 font-display text-3xl font-bold">{data == null ? "—" : String(data)}</div>
      </CardContent>
    </Card>
  );
}

function KpiSLA({ structureId, title }: any) {
  const { data } = useQuery({
    queryKey:["kpi-sla",structureId], enabled: !!structureId,
    queryFn: async()=>{
      // Considera tutti i ticket con SLA definita: violazione se chiuso oltre la scadenza
      // oppure ancora aperto e già scaduto. Così le violazioni in corso pesano sul KPI.
      const { data } = await supabase
        .from("tickets")
        .select("resolve_due_at,resolved_at")
        .eq("structure_id", structureId!)
        .not("resolve_due_at", "is", null);
      const rows = data ?? [];
      if (!rows.length) return null;
      const now = Date.now();
      const violated = rows.filter((t) => {
        const due = new Date(t.resolve_due_at!).getTime();
        if (t.resolved_at) return new Date(t.resolved_at).getTime() > due;
        return now > due;
      }).length;
      return Math.round(((rows.length - violated) / rows.length) * 100);
    }
  });
  return (
    <Card className="h-full"><CardContent className="pt-6">
      <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-success"/>{title}</div>
      <div className="mt-2 font-display text-3xl font-bold">{data==null?"—":`${data}%`}</div>
    </CardContent></Card>
  );
}

function KpiStockValue({ title }: any) {
  const { data } = useQuery({ queryKey:["kpi-stock-val"], queryFn: async()=>{
    const { data } = await supabase.from("inventory_items").select("quantity,unit_cost");
    return (data ?? []).reduce((s:number,i:any)=>s + Number(i.quantity ?? 0)*Number(i.unit_cost ?? 0), 0);
  }});
  return (
    <Card className="h-full"><CardContent className="pt-6">
      <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground"><Package className="h-4 w-4"/>{title}</div>
      <div className="mt-2 font-display text-3xl font-bold">{fmtEUR(data)}</div>
    </CardContent></Card>
  );
}

function ListRecentTickets({ structureId, title }: any) {
  const { data = [] } = useQuery({ queryKey:["w-recent",structureId], enabled:!!structureId,
    queryFn: async()=> (await supabase.from("tickets").select("id,ticket_number,title,priority,status,resolve_due_at,resolved_at,closed_at,created_at").eq("structure_id",structureId!).order("created_at",{ascending:false}).limit(8)).data ?? [] });
  return (
    <Card className="h-full">
      <CardHeader><CardTitle className="font-display text-base">{title}</CardTitle></CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {data.length===0 && <div className="p-4 text-xs text-center text-muted-foreground">Nessun ticket.</div>}
          {data.map((t:any)=>{ const sla = timeUntil(t.resolve_due_at, t.resolved_at ?? t.closed_at ?? null); return (
            <Link key={t.id} to="/app/tickets/$id" params={{id:t.id}} className="flex items-center gap-3 px-4 py-2 hover:bg-accent/40 text-sm">
              <span className="font-mono text-xs text-muted-foreground">#{t.ticket_number}</span>
              <span className="flex-1 truncate">{t.title}</span>
              <Badge variant="outline" className="text-[10px]">{t.priority}</Badge>
              <span className={`text-xs ${sla.status==="violated"?"text-destructive":sla.status==="warn"?"text-warning":"text-success"}`}><Clock className="inline h-3 w-3 mr-1"/>{sla.label}</span>
            </Link>
          ); })}
        </div>
      </CardContent>
    </Card>
  );
}

function ListSLAViolations({ structureId, title }: any) {
  const { data=[] } = useQuery({ queryKey:["w-sla-viol",structureId], enabled:!!structureId,
    queryFn: async()=> {
      const now = new Date().toISOString();
      return (await supabase.from("tickets").select("id,ticket_number,title,resolve_due_at").eq("structure_id",structureId!).is("resolved_at",null).lt("resolve_due_at",now).limit(10)).data ?? [];
    }});
  return (
    <Card className="h-full"><CardHeader><CardTitle className="font-display text-base">{title}</CardTitle></CardHeader>
      <CardContent className="p-0"><div className="divide-y">
        {data.length===0 && <div className="p-4 text-xs text-center text-muted-foreground">Nessuna violazione.</div>}
        {data.map((t:any)=>(
          <Link key={t.id} to="/app/tickets/$id" params={{id:t.id}} className="flex items-center gap-2 px-4 py-2 hover:bg-accent/40 text-sm">
            <span className="font-mono text-xs text-destructive">#{t.ticket_number}</span>
            <span className="flex-1 truncate">{t.title}</span>
            <span className="text-xs text-destructive">{fmtDateTime(t.resolve_due_at)}</span>
          </Link>
        ))}
      </div></CardContent>
    </Card>
  );
}

function ListOpenWOs({ structureId, title }: any) {
  const { data=[] } = useQuery({ queryKey:["w-wo",structureId], enabled:!!structureId,
    queryFn: async()=> (await supabase.from("work_orders").select("id,number,title,status").eq("structure_id",structureId!).neq("status","completato").limit(10)).data ?? [] });
  return <SimpleListCard title={title} items={data.map((w:any)=>({id:w.id, text:`${w.number ?? ""} ${w.title ?? ""}`, sub:w.status}))}/>;
}
function ListMaintenanceDue({ structureId, title }: any) {
  const { data=[] } = useQuery({ queryKey:["w-maint",structureId], enabled:!!structureId,
    queryFn: async()=>{
      const in14 = new Date(Date.now()+14*86400000).toISOString();
      return (await supabase.from("maintenance_plans").select("id,name,next_due").eq("structure_id",structureId!).lt("next_due",in14).order("next_due").limit(10)).data ?? [];
    }});
  return <SimpleListCard title={title} items={data.map((m:any)=>({id:m.id, text:m.name, sub:m.next_due?fmtDateTime(m.next_due):"—"}))}/>;
}
function ListLowStock({ title }: any) {
  const { data=[] } = useQuery({ queryKey:["w-low"], queryFn: async()=>{
    const all = (await supabase.from("inventory_items").select("id,name,quantity,min_quantity")).data ?? [];
    return all.filter((i:any)=> i.min_quantity != null && Number(i.quantity) <= Number(i.min_quantity)).slice(0,10);
  }});
  return <SimpleListCard title={title} items={data.map((i:any)=>({id:i.id, text:i.name, sub:`${i.quantity} / soglia ${i.min_quantity}`}))}/>;
}

function SimpleListCard({ title, items }: { title: string; items: Array<{id:string;text:string;sub?:string}> }) {
  return (
    <Card className="h-full"><CardHeader><CardTitle className="font-display text-base">{title}</CardTitle></CardHeader>
      <CardContent className="p-0"><div className="divide-y">
        {items.length===0 && <div className="p-4 text-xs text-center text-muted-foreground">Nessun elemento.</div>}
        {items.map(it=>(<div key={it.id} className="flex items-center justify-between px-4 py-2 text-sm"><span className="truncate">{it.text}</span><span className="text-xs text-muted-foreground">{it.sub}</span></div>))}
      </div></CardContent>
    </Card>
  );
}