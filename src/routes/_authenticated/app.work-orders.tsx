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

export const Route = createFileRoute("/_authenticated/app/work-orders")({ component: Page });

function Page() {
  const qc = useQueryClient();
  const { activeStructureId } = useActiveStructure();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title:"", description:"", supplier_id:"", asset_id:"", contract_id:"", scheduled_at:"", status:"aperto", cost:"" });
  const { data: suppliers = [] } = useQuery({ queryKey:["sup-min2"], queryFn: async()=> (await supabase.from("suppliers").select("id,name").order("name")).data ?? [] });
  const { data: assets = [] } = useQuery({ queryKey:["assets-min", activeStructureId], enabled:!!activeStructureId,
    queryFn: async()=> (await supabase.from("assets").select("id,name,code").eq("structure_id",activeStructureId!).order("name")).data ?? [] });
  const { data: contracts = [] } = useQuery({ queryKey:["ctr-min", activeStructureId], enabled:!!activeStructureId,
    queryFn: async()=> (await supabase.from("contracts").select("id,title").eq("structure_id",activeStructureId!).order("title")).data ?? [] });
  const { data: items = [] } = useQuery({
    queryKey: ["work_orders", activeStructureId], enabled: !!activeStructureId,
    queryFn: async () => (await supabase.from("work_orders").select("*, suppliers(name), assets(name,code)").eq("structure_id", activeStructureId!).order("created_at",{ascending:false})).data ?? [],
  });
  const mut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("work_orders").insert({
        structure_id: activeStructureId!, title: form.title, description: form.description || null,
        supplier_id: form.supplier_id || null, asset_id: form.asset_id || null, contract_id: form.contract_id || null,
        scheduled_at: form.scheduled_at || null, status: form.status as any,
        cost: form.cost ? parseFloat(form.cost) : null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Ordine creato"); qc.invalidateQueries({queryKey:["work_orders"]}); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  if (!activeStructureId) return <div className="p-10 text-center text-sm text-muted-foreground">Seleziona una struttura.</div>;
  return (
    <SimpleList title="Ordini di Lavoro" subtitle="Interventi pianificati e rapportini." items={items} empty="Nessun ordine."
      header={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4"/>Nuovo ordine</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Nuovo ordine di lavoro</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1"><Label>Titolo *</Label><Input value={form.title} onChange={(e)=>setForm({...form,title:e.target.value})}/></div>
              <div className="space-y-1"><Label>Descrizione</Label><Textarea rows={2} value={form.description} onChange={(e)=>setForm({...form,description:e.target.value})}/></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Asset</Label>
                  <Select value={form.asset_id} onValueChange={(v)=>setForm({...form,asset_id:v})}>
                    <SelectTrigger><SelectValue placeholder="—"/></SelectTrigger>
                    <SelectContent>{assets.map((a:any)=><SelectItem key={a.id} value={a.id}>{a.code} · {a.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Fornitore</Label>
                  <Select value={form.supplier_id} onValueChange={(v)=>setForm({...form,supplier_id:v})}>
                    <SelectTrigger><SelectValue placeholder="—"/></SelectTrigger>
                    <SelectContent>{suppliers.map((s:any)=><SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Contratto</Label>
                  <Select value={form.contract_id} onValueChange={(v)=>setForm({...form,contract_id:v})}>
                    <SelectTrigger><SelectValue placeholder="—"/></SelectTrigger>
                    <SelectContent>{contracts.map((c:any)=><SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Stato</Label>
                  <Select value={form.status} onValueChange={(v)=>setForm({...form,status:v})}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>{["aperto","programmato","in_corso","completato","annullato"].map(x=><SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Programmato per</Label><Input type="datetime-local" value={form.scheduled_at} onChange={(e)=>setForm({...form,scheduled_at:e.target.value})}/></div>
                <div className="space-y-1"><Label>Costo €</Label><Input type="number" value={form.cost} onChange={(e)=>setForm({...form,cost:e.target.value})}/></div>
              </div>
              <Button disabled={!form.title || mut.isPending} className="w-full" onClick={()=>mut.mutate()}>Crea</Button>
            </div>
          </DialogContent>
        </Dialog>
      }
      renderItem={(w:any)=> (
        <ListCard title={w.title} meta={<>{w.suppliers?.name ?? "—"} · {w.assets?.name ?? ""}</>}
          badges={<Badge>{w.status}</Badge>}
          footer={<div>{w.scheduled_at && <div>📅 {new Date(w.scheduled_at).toLocaleString("it-IT")}</div>}{w.cost && <div>Costo: €{w.cost}</div>}</div>}
        />
      )}
    />
  );
}