import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveStructure } from "@/lib/structure-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { SimpleList, ListCard } from "@/components/SimpleList";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/inventory")({ component: Page });

function Page() {
  const qc = useQueryClient();
  const { activeStructureId } = useActiveStructure();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ sku:"", name:"", category:"", unit:"pz", quantity:"0", min_quantity:"0", unit_cost:"", location:"" });
  const { data: items = [] } = useQuery({
    queryKey: ["inventory", activeStructureId], enabled: !!activeStructureId,
    queryFn: async () => (await supabase.from("inventory_items").select("*").eq("structure_id", activeStructureId!).order("name")).data ?? [],
  });
  const mut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("inventory_items").insert({
        structure_id: activeStructureId!, sku: form.sku, name: form.name, category: form.category || null,
        unit: form.unit, quantity: parseFloat(form.quantity), min_quantity: parseFloat(form.min_quantity),
        unit_cost: form.unit_cost ? parseFloat(form.unit_cost) : null, location: form.location || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Articolo creato"); qc.invalidateQueries({queryKey:["inventory"]}); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  if (!activeStructureId) return <div className="p-10 text-center text-sm text-muted-foreground">Seleziona una struttura.</div>;
  return (
    <SimpleList title="Magazzino ricambi" subtitle="Giacenze, scorte minime, ubicazioni." items={items} empty="Nessun articolo."
      header={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4"/>Nuovo articolo</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Nuovo articolo</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>SKU *</Label><Input value={form.sku} onChange={(e)=>setForm({...form,sku:e.target.value})}/></div>
                <div className="space-y-1"><Label>Nome *</Label><Input value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})}/></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Categoria</Label><Input value={form.category} onChange={(e)=>setForm({...form,category:e.target.value})}/></div>
                <div className="space-y-1"><Label>Unità</Label><Input value={form.unit} onChange={(e)=>setForm({...form,unit:e.target.value})}/></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1"><Label>Qta</Label><Input type="number" value={form.quantity} onChange={(e)=>setForm({...form,quantity:e.target.value})}/></div>
                <div className="space-y-1"><Label>Min</Label><Input type="number" value={form.min_quantity} onChange={(e)=>setForm({...form,min_quantity:e.target.value})}/></div>
                <div className="space-y-1"><Label>Costo unit</Label><Input type="number" value={form.unit_cost} onChange={(e)=>setForm({...form,unit_cost:e.target.value})}/></div>
              </div>
              <div className="space-y-1"><Label>Ubicazione</Label><Input placeholder="Magazzino A · scaffale 2" value={form.location} onChange={(e)=>setForm({...form,location:e.target.value})}/></div>
              <Button disabled={!form.sku||!form.name||mut.isPending} className="w-full" onClick={()=>mut.mutate()}>Crea</Button>
            </div>
          </DialogContent>
        </Dialog>
      }
      renderItem={(it:any)=> {
        const low = Number(it.quantity) <= Number(it.min_quantity);
        return <ListCard title={it.name} meta={<>{it.sku} · {it.category ?? ""}</>}
          badges={low ? <Badge variant="destructive">sotto-scorta</Badge> : <Badge variant="outline">ok</Badge>}
          footer={<div>Giacenza: <b>{it.quantity} {it.unit}</b> · min {it.min_quantity}<br/>{it.location && <>📍 {it.location}</>}</div>}/>;
      }}
    />
  );
}