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

export const Route = createFileRoute("/_authenticated/app/contracts")({ component: Page });

function Page() {
  const qc = useQueryClient();
  const { activeStructureId } = useActiveStructure();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code:"", title:"", supplier_id:"", type:"canone", status:"bozza", start_date:"", end_date:"", amount:"", auto_renew:false, sla_ack_minutes:"", sla_resolve_minutes:"", notes:"" });
  const { data: suppliers = [] } = useQuery({ queryKey:["sup-min", activeStructureId], queryFn: async ()=> {
    const { data, error } = await supabase.from("suppliers").select("id,name").order("name");
    if (error) throw error; return data;
  }});
  const { data: items = [] } = useQuery({
    queryKey: ["contracts", activeStructureId], enabled: !!activeStructureId,
    queryFn: async () => {
      const { data, error } = await supabase.from("contracts").select("*, suppliers(name)").eq("structure_id", activeStructureId!).order("created_at",{ascending:false});
      if (error) throw error; return data;
    },
  });
  const mut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("contracts").insert({
        structure_id: activeStructureId!, code: form.code, title: form.title, supplier_id: form.supplier_id,
        type: form.type as any, status: form.status as any,
        start_date: form.start_date || null, end_date: form.end_date || null,
        amount: form.amount ? parseFloat(form.amount) : null, auto_renew: form.auto_renew,
        sla_ack_minutes: form.sla_ack_minutes ? parseInt(form.sla_ack_minutes) : null,
        sla_resolve_minutes: form.sla_resolve_minutes ? parseInt(form.sla_resolve_minutes) : null,
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Contratto creato"); qc.invalidateQueries({queryKey:["contracts"]}); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  if (!activeStructureId) return <div className="p-10 text-center text-sm text-muted-foreground">Seleziona una struttura.</div>;
  return (
    <SimpleList title="Contratti" subtitle="Contratti di servizio, canoni e SLA contrattuali." items={items} empty="Nessun contratto."
      header={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4"/>Nuovo contratto</Button></DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nuovo contratto</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Codice *</Label><Input value={form.code} onChange={(e)=>setForm({...form,code:e.target.value})}/></div>
                <div className="space-y-1"><Label>Titolo *</Label><Input value={form.title} onChange={(e)=>setForm({...form,title:e.target.value})}/></div>
              </div>
              <div className="space-y-1"><Label>Fornitore *</Label>
                <Select value={form.supplier_id} onValueChange={(v)=>setForm({...form,supplier_id:v})}>
                  <SelectTrigger><SelectValue placeholder="Seleziona…"/></SelectTrigger>
                  <SelectContent>{suppliers.map((s:any)=><SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Tipo</Label>
                  <Select value={form.type} onValueChange={(v)=>setForm({...form,type:v})}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>{["canone","consumo","intervento","misto"].map(x=><SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Stato</Label>
                  <Select value={form.status} onValueChange={(v)=>setForm({...form,status:v})}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>{["bozza","attivo","scaduto","disdetto"].map(x=><SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Inizio</Label><Input type="date" value={form.start_date} onChange={(e)=>setForm({...form,start_date:e.target.value})}/></div>
                <div className="space-y-1"><Label>Fine</Label><Input type="date" value={form.end_date} onChange={(e)=>setForm({...form,end_date:e.target.value})}/></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1"><Label>Importo €</Label><Input type="number" value={form.amount} onChange={(e)=>setForm({...form,amount:e.target.value})}/></div>
                <div className="space-y-1"><Label>SLA ack (min)</Label><Input type="number" value={form.sla_ack_minutes} onChange={(e)=>setForm({...form,sla_ack_minutes:e.target.value})}/></div>
                <div className="space-y-1"><Label>SLA risolvi (min)</Label><Input type="number" value={form.sla_resolve_minutes} onChange={(e)=>setForm({...form,sla_resolve_minutes:e.target.value})}/></div>
              </div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.auto_renew} onChange={(e)=>setForm({...form,auto_renew:e.target.checked})}/>Rinnovo automatico</label>
              <div className="space-y-1"><Label>Note</Label><Textarea rows={2} value={form.notes} onChange={(e)=>setForm({...form,notes:e.target.value})}/></div>
              <Button disabled={!form.code||!form.title||!form.supplier_id||mut.isPending} className="w-full" onClick={()=>mut.mutate()}>Crea</Button>
            </div>
          </DialogContent>
        </Dialog>
      }
      renderItem={(c:any)=> (
        <ListCard title={c.title} meta={<>{c.code} · {c.suppliers?.name ?? ""}</>}
          badges={<><Badge variant="outline">{c.type}</Badge><Badge>{c.status}</Badge></>}
          footer={<div className="space-y-0.5">
            {c.start_date && <div>Periodo: {c.start_date} → {c.end_date ?? "—"}</div>}
            {c.amount && <div>Importo: <b>€{c.amount}</b></div>}
            {c.auto_renew && <div>🔁 Rinnovo automatico</div>}
          </div>}
        />
      )}
    />
  );
}