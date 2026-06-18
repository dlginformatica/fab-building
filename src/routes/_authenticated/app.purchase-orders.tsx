import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveStructure } from "@/lib/structure-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { SimpleList, ListCard } from "@/components/SimpleList";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/purchase-orders")({ component: Page });

function Page() {
  const qc = useQueryClient();
  const { activeStructureId } = useActiveStructure();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ number:"", supplier_id:"", status:"bozza", expected_delivery:"", total:"", notes:"", items:"" });
  const { data: suppliers = [] } = useQuery({ queryKey:["sup-po"], queryFn: async()=> (await supabase.from("suppliers").select("id,name").order("name")).data ?? [] });
  const { data: items = [] } = useQuery({
    queryKey: ["po", activeStructureId], enabled: !!activeStructureId,
    queryFn: async () => (await supabase.from("purchase_orders").select("*, suppliers(name)").eq("structure_id", activeStructureId!).order("created_at",{ascending:false})).data ?? [],
  });
  const mut = useMutation({
    mutationFn: async () => {
      const lineItems = form.items.split("\n").filter(Boolean).map(line => {
        const [name, qty, price] = line.split("|").map(s=>s.trim());
        return { name, qty: Number(qty||1), price: Number(price||0) };
      });
      const { error } = await supabase.from("purchase_orders").insert({
        structure_id: activeStructureId!, number: form.number || null, supplier_id: form.supplier_id || null,
        status: form.status, expected_delivery: form.expected_delivery || null,
        total: form.total ? parseFloat(form.total) : null, notes: form.notes || null, items: lineItems,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Ordine creato"); qc.invalidateQueries({queryKey:["po"]}); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  if (!activeStructureId) return <div className="p-10 text-center text-sm text-muted-foreground">Seleziona una struttura.</div>;
  return (
    <SimpleList title="Ordini d'acquisto" subtitle="RDA, PO e tracking consegne." items={items} empty="Nessun ordine."
      header={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4"/>Nuovo PO</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Nuovo ordine d'acquisto</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Numero</Label><Input value={form.number} onChange={(e)=>setForm({...form,number:e.target.value})}/></div>
                <div className="space-y-1"><Label>Stato</Label>
                  <Select value={form.status} onValueChange={(v)=>setForm({...form,status:v})}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>{["bozza","inviato","confermato","ricevuto","annullato"].map(x=><SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1"><Label>Fornitore</Label>
                <Select value={form.supplier_id} onValueChange={(v)=>setForm({...form,supplier_id:v})}>
                  <SelectTrigger><SelectValue placeholder="—"/></SelectTrigger>
                  <SelectContent>{suppliers.map((s:any)=><SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Consegna prevista</Label><Input type="date" value={form.expected_delivery} onChange={(e)=>setForm({...form,expected_delivery:e.target.value})}/></div>
                <div className="space-y-1"><Label>Totale €</Label><Input type="number" value={form.total} onChange={(e)=>setForm({...form,total:e.target.value})}/></div>
              </div>
              <div className="space-y-1"><Label>Righe (Nome|Qta|Prezzo per riga)</Label><Textarea rows={4} value={form.items} onChange={(e)=>setForm({...form,items:e.target.value})}/></div>
              <div className="space-y-1"><Label>Note</Label><Textarea rows={2} value={form.notes} onChange={(e)=>setForm({...form,notes:e.target.value})}/></div>
              <Button disabled={mut.isPending} className="w-full" onClick={()=>mut.mutate()}>Crea</Button>
            </div>
          </DialogContent>
        </Dialog>
      }
      renderItem={(p:any)=>(
        <ListCard title={`PO ${p.number ?? p.id.slice(0,6)}`} meta={<>{p.suppliers?.name ?? "—"} · {p.order_date}</>}
          badges={<Badge>{p.status}</Badge>}
          footer={<div>{p.expected_delivery && <div>Consegna: {p.expected_delivery}</div>}{p.total && <div>Totale: €{p.total}</div>}<div>{(p.items as any[])?.length ?? 0} righe</div></div>}/>
      )}
    />
  );
}