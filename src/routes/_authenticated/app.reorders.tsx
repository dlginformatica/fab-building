import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveStructure } from "@/lib/structure-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Package, ShoppingCart, AlertTriangle, CheckCircle2, Truck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/reorders")({ component: Page });

const eur = (n:number) => `€ ${(n||0).toLocaleString("it-IT",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const STATUS_LABEL: Record<string, string> = {
  da_approvare: "Da approvare", approvato: "Approvato", ordinato: "Ordinato", ricevuto: "Ricevuto", annullato: "Annullato",
};
const NEXT_STATUS: Record<string, string|null> = { da_approvare: "approvato", approvato: "ordinato", ordinato: "ricevuto", ricevuto: null, annullato: null };

function Page() {
  const qc = useQueryClient();
  const { activeStructureId } = useActiveStructure();
  const [selectedItem, setSelectedItem] = useState<any|null>(null);

  const { data: low = [] } = useQuery({
    queryKey: ["low_stock", activeStructureId], enabled: !!activeStructureId,
    queryFn: async () => (await (supabase as any).from("low_stock_items").select("*").eq("structure_id", activeStructureId!).order("shortage",{ascending:false})).data ?? [],
  });
  const { data: reorders = [] } = useQuery({
    queryKey: ["reorders", activeStructureId], enabled: !!activeStructureId,
    queryFn: async () => (await supabase.from("reorder_requests").select("*, inventory_items(name,sku,unit), suppliers(name)").eq("structure_id", activeStructureId!).order("created_at",{ascending:false})).data ?? [],
  });
  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers-active", activeStructureId],
    queryFn: async () => (await supabase.from("suppliers").select("id,name,blocked").eq("blocked", false).order("name")).data ?? [],
  });

  const create = useMutation({
    mutationFn: async (p: { item_id: string; quantity: number; supplier_id?: string; notes?: string }) => {
      const user = (await supabase.auth.getUser()).data.user;
      const { error } = await supabase.from("reorder_requests").insert({
        structure_id: activeStructureId!, item_id: p.item_id, quantity: p.quantity,
        supplier_id: p.supplier_id || null, notes: p.notes || null, created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Richiesta di riordino creata"); qc.invalidateQueries({ queryKey:["reorders"] }); setSelectedItem(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const advance = useMutation({
    mutationFn: async (r: any) => {
      const next = NEXT_STATUS[r.status];
      if (!next) return;
      const { error } = await supabase.from("reorder_requests").update({ status: next as any }).eq("id", r.id);
      if (error) throw error;
      if (next === "ricevuto") {
        // incrementa giacenza
        const item = (low as any[]).find(i=>i.id===r.item_id);
        const newQty = (item?.quantity ?? 0) + Number(r.quantity);
        await supabase.from("inventory_items").update({ quantity: newQty }).eq("id", r.item_id);
        await supabase.from("inventory_movements").insert({
          item_id: r.item_id, movement_type: "carico",
          quantity: r.quantity, notes: `Riordino ricevuto #${r.id.slice(0,8)}`,
        });
      }
    },
    onSuccess: () => { toast.success("Stato aggiornato"); qc.invalidateQueries({ queryKey:["reorders"] }); qc.invalidateQueries({ queryKey:["low_stock"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancel = useMutation({
    mutationFn: async (r: any) => { const { error } = await supabase.from("reorder_requests").update({ status: "annullato" }).eq("id", r.id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey:["reorders"] }),
  });

  if (!activeStructureId) return <div className="p-10 text-center text-sm text-muted-foreground">Seleziona una struttura.</div>;

  const totalShortage = (low as any[]).reduce((a,b)=>a+Number(b.estimated_cost||0),0);
  const pending = (reorders as any[]).filter(r=>r.status!=="ricevuto" && r.status!=="annullato").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold flex items-center gap-2"><Package className="h-5 w-5"/>Riordini magazzino</h1>
        <p className="text-sm text-muted-foreground">Articoli sotto scorta minima e flusso approvazione → ordine → ricezione.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card><CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground flex items-center gap-2"><AlertTriangle className="h-4 w-4"/>Articoli sotto scorta</CardTitle></CardHeader><CardContent><div className="font-display text-2xl font-bold text-warning">{(low as any[]).length}</div></CardContent></Card>
        <Card><CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground flex items-center gap-2"><ShoppingCart className="h-4 w-4"/>Riordini aperti</CardTitle></CardHeader><CardContent><div className="font-display text-2xl font-bold">{pending}</div></CardContent></Card>
        <Card><CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Costo stimato reintegro</CardTitle></CardHeader><CardContent><div className="font-display text-2xl font-bold text-primary">{eur(totalShortage)}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-warning"/>Articoli sotto scorta</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <tr><th className="px-4 py-2">SKU</th><th className="px-4 py-2">Articolo</th><th className="px-4 py-2 text-right">Giacenza</th><th className="px-4 py-2 text-right">Min</th><th className="px-4 py-2 text-right">Da reintegrare</th><th className="px-4 py-2 text-right">€ stimati</th><th></th></tr>
            </thead>
            <tbody>
              {(low as any[]).map((it:any)=>(
                <tr key={it.id} className="border-b border-border/60">
                  <td className="px-4 py-2 font-mono text-xs">{it.sku}</td>
                  <td className="px-4 py-2">{it.name}</td>
                  <td className="px-4 py-2 text-right">{it.quantity} {it.unit}</td>
                  <td className="px-4 py-2 text-right">{it.min_quantity}</td>
                  <td className="px-4 py-2 text-right font-semibold text-warning">{it.shortage} {it.unit}</td>
                  <td className="px-4 py-2 text-right">{eur(Number(it.estimated_cost))}</td>
                  <td className="px-4 py-2 text-right"><Button size="sm" onClick={()=>setSelectedItem(it)}><ShoppingCart className="h-3 w-3 mr-1"/>Riordina</Button></td>
                </tr>
              ))}
              {(low as any[]).length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Tutte le giacenze sono sopra la scorta minima.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Richieste di riordino</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <tr><th className="px-4 py-2">Articolo</th><th className="px-4 py-2 text-right">Qta</th><th className="px-4 py-2">Fornitore</th><th className="px-4 py-2">Stato</th><th className="px-4 py-2">Note</th><th></th></tr>
            </thead>
            <tbody>
              {(reorders as any[]).map((r:any)=>(
                <tr key={r.id} className="border-b border-border/60">
                  <td className="px-4 py-2">{r.inventory_items?.name ?? "—"} <span className="text-xs text-muted-foreground">{r.inventory_items?.sku}</span></td>
                  <td className="px-4 py-2 text-right">{r.quantity} {r.inventory_items?.unit}</td>
                  <td className="px-4 py-2 text-xs">{r.suppliers?.name ?? "—"}</td>
                  <td className="px-4 py-2"><Badge variant="outline">{STATUS_LABEL[r.status]}</Badge></td>
                  <td className="px-4 py-2 text-xs">{r.notes ?? ""}</td>
                  <td className="px-4 py-2 text-right space-x-1">
                    {NEXT_STATUS[r.status] && <Button size="sm" onClick={()=>advance.mutate(r)}>
                      {r.status==="ordinato" ? <><Truck className="h-3 w-3 mr-1"/>Ricevi</> :
                       r.status==="approvato" ? <><ShoppingCart className="h-3 w-3 mr-1"/>Ordina</> :
                       <><CheckCircle2 className="h-3 w-3 mr-1"/>Approva</>}
                    </Button>}
                    {r.status !== "ricevuto" && r.status !== "annullato" && <Button size="sm" variant="ghost" onClick={()=>cancel.mutate(r)}>Annulla</Button>}
                  </td>
                </tr>
              ))}
              {(reorders as any[]).length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Nessuna richiesta.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={!!selectedItem} onOpenChange={(o)=>!o && setSelectedItem(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Riordina {selectedItem?.name}</DialogTitle></DialogHeader>
          {selectedItem && <ReorderForm item={selectedItem} suppliers={suppliers} onCreate={(p)=>create.mutate(p)} pending={create.isPending}/>}
        </DialogContent>
      </Dialog>
    </div>
  );
}

type ReorderInput = { item_id: string; quantity: number; supplier_id?: string; notes?: string };
function ReorderForm({ item, suppliers, onCreate, pending }: { item: any; suppliers: any[]; onCreate: (p: ReorderInput) => void; pending: boolean }) {
  const [qty, setQty] = useState(String(item.shortage || 1));
  const [sup, setSup] = useState(item.supplier_id ?? "");
  const [notes, setNotes] = useState("");
  return (
    <div className="space-y-3">
      <div className="rounded-md bg-muted/40 p-3 text-xs space-y-1">
        <div>SKU <b>{item.sku}</b></div>
        <div>Giacenza: {item.quantity} {item.unit} · Min: {item.min_quantity}</div>
        <div>Suggerito: <b>{item.shortage} {item.unit}</b></div>
      </div>
      <div className="space-y-1"><Label>Quantità</Label><Input type="number" value={qty} onChange={(e)=>setQty(e.target.value)}/></div>
      <div className="space-y-1"><Label>Fornitore (solo abilitati)</Label>
        <Select value={sup} onValueChange={setSup}>
          <SelectTrigger><SelectValue placeholder="Seleziona…"/></SelectTrigger>
          <SelectContent>{(suppliers as any[]).map(s=><SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1"><Label>Note</Label><Input value={notes} onChange={(e)=>setNotes(e.target.value)}/></div>
      <Button disabled={pending || !qty || Number(qty)<=0} className="w-full" onClick={()=>onCreate({ item_id: item.id, quantity: Number(qty), supplier_id: sup || undefined, notes })}>Crea richiesta</Button>
    </div>
  );
}