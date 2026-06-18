import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveStructure } from "@/lib/structure-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LayoutGrid, Plus, Trash2, ArrowUp, ArrowDown, Save } from "lucide-react";
import { WIDGET_CATALOG, WidgetRenderer, sizeClass, type WidgetKey } from "@/components/dashboard/widgets";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/")({
  component: Dashboard,
});

function Dashboard() {
  const { activeStructureId } = useActiveStructure();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);

  const { data: me } = useQuery({ queryKey:["me-dash"], queryFn: async()=> (await supabase.auth.getUser()).data.user });
  const { data: widgets = [], isLoading } = useQuery({
    queryKey:["dashboard-widgets", me?.id], enabled: !!me?.id,
    queryFn: async()=> (await supabase.from("dashboard_widgets").select("*").eq("user_id", me!.id).order("position")).data ?? [],
  });

  const seed = useMutation({
    mutationFn: async () => {
      if (!me) return;
      const defaults: WidgetKey[] = ["kpi_open_tickets","kpi_critical_tickets","kpi_sla_pct","kpi_assets","list_recent_tickets","list_sla_violations"];
      const rows = defaults.map((k, i) => ({
        user_id: me.id, widget_key: k, position: i,
        size: WIDGET_CATALOG.find(w=>w.key===k)?.defaultSize ?? "md",
      }));
      const { error } = await supabase.from("dashboard_widgets").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({queryKey:["dashboard-widgets"]}),
  });

  const add = useMutation({
    mutationFn: async (k: WidgetKey) => {
      if (!me) return;
      const { error } = await supabase.from("dashboard_widgets").insert({
        user_id: me.id, widget_key: k, position: widgets.length,
        size: WIDGET_CATALOG.find(w=>w.key===k)?.defaultSize ?? "md",
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Widget aggiunto"); qc.invalidateQueries({queryKey:["dashboard-widgets"]}); },
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("dashboard_widgets").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({queryKey:["dashboard-widgets"]}),
  });

  const updateOne = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const { error } = await supabase.from("dashboard_widgets").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({queryKey:["dashboard-widgets"]}),
  });

  async function move(id: string, dir: -1 | 1) {
    const list = [...widgets];
    const idx = list.findIndex(w=>w.id===id);
    const swap = idx + dir;
    if (idx<0 || swap<0 || swap>=list.length) return;
    const a = list[idx], b = list[swap];
    await Promise.all([
      supabase.from("dashboard_widgets").update({ position: b.position }).eq("id", a.id),
      supabase.from("dashboard_widgets").update({ position: a.position }).eq("id", b.id),
    ]);
    qc.invalidateQueries({queryKey:["dashboard-widgets"]});
  }

  const available = useMemo(()=>WIDGET_CATALOG.filter(c=>!widgets.some(w=>w.widget_key===c.key)),[widgets]);

  if (!activeStructureId) return <EmptyStructure />;

  if (!isLoading && widgets.length === 0) {
    return (
      <div className="grid h-[50vh] place-items-center">
        <Card className="max-w-md text-center">
          <CardHeader><CardTitle className="font-display">Dashboard vuota</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Aggiungi widget personalizzati o usa la configurazione predefinita.</p>
            <Button onClick={()=>seed.mutate()}>Carica widget predefiniti</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2"><LayoutGrid className="h-5 w-5"/>Dashboard</h1>
          <p className="text-sm text-muted-foreground">Widget personalizzati per il tuo ruolo (direttore / proprietà / facility).</p>
        </div>
        <div className="flex gap-2">
          <Button variant={editing?"default":"outline"} size="sm" onClick={()=>setEditing(v=>!v)}>
            {editing ? <><Save className="h-4 w-4 mr-1"/>Fine modifica</> : "Modifica layout"}
          </Button>
          <Dialog>
            <DialogTrigger asChild><Button size="sm" variant="outline" disabled={available.length===0}><Plus className="h-4 w-4 mr-1"/>Aggiungi widget</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Aggiungi widget</DialogTitle></DialogHeader>
              <div className="max-h-[60vh] overflow-y-auto divide-y">
                {available.map(c=>(
                  <button key={c.key} onClick={()=>add.mutate(c.key)} className="flex w-full items-center justify-between py-2 text-left hover:bg-accent/40 px-2 rounded">
                    <div>
                      <div className="text-sm font-medium">{c.label}</div>
                      <div className="text-[10px] uppercase text-muted-foreground">{c.group}</div>
                    </div>
                    <Plus className="h-4 w-4"/>
                  </button>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {widgets.map((w:any)=>(
          <div key={w.id} className={`${sizeClass(w.size)} relative`}>
            {editing && (
              <div className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-md border bg-background/95 p-1 shadow">
                <Select value={w.size} onValueChange={(v)=>updateOne.mutate({id:w.id, patch:{size:v}})}>
                  <SelectTrigger className="h-6 px-2 text-[10px] w-[60px]"><SelectValue/></SelectTrigger>
                  <SelectContent><SelectItem value="sm">SM</SelectItem><SelectItem value="md">MD</SelectItem><SelectItem value="lg">LG</SelectItem><SelectItem value="xl">XL</SelectItem></SelectContent>
                </Select>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={()=>move(w.id,-1)}><ArrowUp className="h-3 w-3"/></Button>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={()=>move(w.id, 1)}><ArrowDown className="h-3 w-3"/></Button>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={()=>del.mutate(w.id)}><Trash2 className="h-3 w-3"/></Button>
              </div>
            )}
            <WidgetRenderer wkey={w.widget_key as WidgetKey} structureId={activeStructureId} title={w.title ?? undefined}/>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PriorityBadge({ p }: { p: string }) {
  const map: Record<string, string> = {
    bassa: "bg-muted text-muted-foreground",
    media: "bg-info/20 text-info",
    alta: "bg-warning/20 text-warning",
    critica: "bg-destructive/20 text-destructive",
  };
  return <Badge className={`${map[p] ?? ""} border-transparent`} variant="outline">{p}</Badge>;
}
export function StatusBadge({ s }: { s: string }) {
  const map: Record<string, string> = {
    aperto: "bg-info/20 text-info",
    assegnato: "bg-accent text-accent-foreground",
    in_corso: "bg-warning/20 text-warning",
    sospeso: "bg-muted text-muted-foreground",
    risolto: "bg-success/20 text-success",
    chiuso: "bg-muted text-muted-foreground",
    annullato: "bg-muted text-muted-foreground",
  };
  return <Badge className={`${map[s] ?? ""} border-transparent`} variant="outline">{s.replace("_"," ")}</Badge>;
}

function EmptyStructure() {
  return (
    <div className="grid h-[60vh] place-items-center">
      <Card className="max-w-md">
        <CardHeader><CardTitle className="font-display">Benvenuto in HotelOps</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Per iniziare, crea la tua prima struttura e assegnati il ruolo super_admin. Vai a <Link to="/app/structures" className="text-primary underline">Strutture</Link> e poi a <Link to="/app/users" className="text-primary underline">Utenti & Ruoli</Link>.</p>
        </CardContent>
      </Card>
    </div>
  );
}