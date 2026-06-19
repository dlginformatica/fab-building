import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveStructure } from "@/lib/structure-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Layers, Wand2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/area-mapping")({ component: Page });

const AREAS = ["camere","spa","ristorante","cucina","aree_comuni","esterno","uffici","altro"] as const;

function Page() {
  const qc = useQueryClient();
  const { activeStructureId } = useActiveStructure();
  const [bulkArea, setBulkArea] = useState<string>("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const { data: assets = [] } = useQuery({
    queryKey: ["assets-area-mapping", activeStructureId], enabled: !!activeStructureId,
    queryFn: async () => (await supabase.from("assets")
      .select("id, code, name, area, asset_categories(name), rooms(name)")
      .eq("structure_id", activeStructureId!).order("area", { nullsFirst: true }).order("name")).data ?? [],
  });

  const counts = useMemo(() => {
    const c: Record<string, number> = { _unassigned: 0 };
    for (const a of assets as any[]) { const k = a.area ?? "_unassigned"; c[k] = (c[k]||0)+1; }
    return c;
  }, [assets]);

  const updateOne = useMutation({
    mutationFn: async (p: { id: string; area: string }) => {
      const { error } = await supabase.from("assets").update({ area: p.area as any }).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assets-area-mapping"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkApply = useMutation({
    mutationFn: async () => {
      if (!bulkArea) return;
      const ids = Object.entries(selected).filter(([_,v])=>v).map(([k])=>k);
      if (ids.length === 0) return;
      const { error } = await supabase.from("assets").update({ area: bulkArea as any }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Area applicata agli asset selezionati. Ticket, ordini di lavoro e fatture eredieranno l'area automaticamente.");
      setSelected({}); qc.invalidateQueries({ queryKey: ["assets-area-mapping"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold flex items-center gap-2"><Layers className="h-5 w-5"/>Aree & reparti</h1>
        <p className="text-sm text-muted-foreground">Mappa ogni asset alla sua area operativa. Ticket, work order e fatture eredieranno automaticamente l'area dell'impianto collegato.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-9">
        <Stat label="Non assegnati" n={counts._unassigned} tone="text-warning"/>
        {AREAS.map(a => <Stat key={a} label={a} n={counts[a]||0}/> )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base flex items-center gap-2"><Wand2 className="h-4 w-4"/>Assegnazione massiva</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Area da applicare</div>
            <Select value={bulkArea} onValueChange={setBulkArea}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Seleziona area…"/></SelectTrigger>
              <SelectContent>{AREAS.map(a=><SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button disabled={!bulkArea || Object.values(selected).filter(Boolean).length===0 || bulkApply.isPending}
                  onClick={()=>bulkApply.mutate()}>
            Applica a {Object.values(selected).filter(Boolean).length} asset
          </Button>
        </CardContent>
      </Card>

      <Card><CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
            <tr><th className="w-10 px-2 py-2"></th><th className="px-3 py-2">Codice</th><th className="px-3 py-2">Nome</th><th className="px-3 py-2">Categoria</th><th className="px-3 py-2">Stanza</th><th className="px-3 py-2">Area</th></tr>
          </thead>
          <tbody>
            {(assets as any[]).map(a => (
              <tr key={a.id} className={`border-b border-border/60 ${a.area?"":"bg-warning/5"}`}>
                <td className="px-2 py-2"><input type="checkbox" checked={!!selected[a.id]} onChange={(e)=>setSelected({...selected, [a.id]: e.target.checked})}/></td>
                <td className="px-3 py-2 font-mono text-xs">{a.code}</td>
                <td className="px-3 py-2">{a.name}</td>
                <td className="px-3 py-2 text-xs">{a.asset_categories?.name ?? "—"}</td>
                <td className="px-3 py-2 text-xs">{a.rooms?.name ?? "—"}</td>
                <td className="px-3 py-2">
                  <Select value={a.area ?? ""} onValueChange={(v)=>updateOne.mutate({id:a.id, area:v})}>
                    <SelectTrigger className="h-8 w-44"><SelectValue placeholder="—"/></SelectTrigger>
                    <SelectContent>{AREAS.map(x=><SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
                  </Select>
                </td>
              </tr>
            ))}
            {assets.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">Nessun asset.</td></tr>}
          </tbody>
        </table>
      </CardContent></Card>
    </div>
  );
}

function Stat({ label, n, tone }: { label: string; n: number; tone?: string }) {
  return <div className="rounded-lg border border-border bg-card p-3"><div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div><div className={`font-display text-2xl font-bold ${tone ?? ""}`}>{n}</div></div>;
}