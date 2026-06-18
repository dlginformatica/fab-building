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

export const Route = createFileRoute("/_authenticated/app/maintenance")({ component: Page });

function Page() {
  const qc = useQueryClient();
  const { activeStructureId } = useActiveStructure();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name:"", description:"", frequency:"mensile", interval_days:"", next_due:"", asset_id:"", supplier_id:"", checklist:"" });
  const { data: assets = [] } = useQuery({ queryKey:["assets-m", activeStructureId], enabled:!!activeStructureId,
    queryFn: async()=> (await supabase.from("assets").select("id,name,code").eq("structure_id",activeStructureId!).order("name")).data ?? [] });
  const { data: suppliers = [] } = useQuery({ queryKey:["sup-m"], queryFn: async()=> (await supabase.from("suppliers").select("id,name").order("name")).data ?? [] });
  const { data: items = [] } = useQuery({
    queryKey: ["maintenance", activeStructureId], enabled: !!activeStructureId,
    queryFn: async () => (await supabase.from("maintenance_plans").select("*, assets(name,code), suppliers(name)").eq("structure_id", activeStructureId!).order("next_due",{ascending:true,nullsFirst:false})).data ?? [],
  });
  const mut = useMutation({
    mutationFn: async () => {
      const checklist = form.checklist.split("\n").map(s=>s.trim()).filter(Boolean).map((label,i)=>({id:i,label,done:false}));
      const { error } = await supabase.from("maintenance_plans").insert({
        structure_id: activeStructureId!, name: form.name, description: form.description || null,
        frequency: form.frequency as any, interval_days: form.interval_days ? parseInt(form.interval_days) : null,
        next_due: form.next_due || null, asset_id: form.asset_id || null, supplier_id: form.supplier_id || null,
        checklist,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Piano creato"); qc.invalidateQueries({queryKey:["maintenance"]}); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  if (!activeStructureId) return <div className="p-10 text-center text-sm text-muted-foreground">Seleziona una struttura.</div>;
  return (
    <SimpleList title="Manutenzione programmata" subtitle="Piani preventivi, checklist e scadenze." items={items} empty="Nessun piano."
      header={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4"/>Nuovo piano</Button></DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nuovo piano di manutenzione</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1"><Label>Nome *</Label><Input value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})}/></div>
              <div className="space-y-1"><Label>Descrizione</Label><Textarea rows={2} value={form.description} onChange={(e)=>setForm({...form,description:e.target.value})}/></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Frequenza</Label>
                  <Select value={form.frequency} onValueChange={(v)=>setForm({...form,frequency:v})}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>{["giornaliera","settimanale","mensile","trimestrale","semestrale","annuale","custom"].map(x=><SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Ogni N giorni (custom)</Label><Input type="number" value={form.interval_days} onChange={(e)=>setForm({...form,interval_days:e.target.value})}/></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Prossima scadenza</Label><Input type="date" value={form.next_due} onChange={(e)=>setForm({...form,next_due:e.target.value})}/></div>
                <div className="space-y-1"><Label>Asset</Label>
                  <Select value={form.asset_id} onValueChange={(v)=>setForm({...form,asset_id:v})}>
                    <SelectTrigger><SelectValue placeholder="—"/></SelectTrigger>
                    <SelectContent>{assets.map((a:any)=><SelectItem key={a.id} value={a.id}>{a.code} · {a.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1"><Label>Fornitore</Label>
                <Select value={form.supplier_id} onValueChange={(v)=>setForm({...form,supplier_id:v})}>
                  <SelectTrigger><SelectValue placeholder="—"/></SelectTrigger>
                  <SelectContent>{suppliers.map((s:any)=><SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Checklist (una riga per voce)</Label><Textarea rows={4} placeholder="Verifica pressione&#10;Sostituisci filtri&#10;…" value={form.checklist} onChange={(e)=>setForm({...form,checklist:e.target.value})}/></div>
              <Button disabled={!form.name || mut.isPending} className="w-full" onClick={()=>mut.mutate()}>Crea</Button>
            </div>
          </DialogContent>
        </Dialog>
      }
      renderItem={(p:any)=>(
        <ListCard title={p.name} meta={<>{p.assets?.name ?? "—"} · ogni {p.frequency}</>}
          badges={p.active ? <Badge>attivo</Badge> : <Badge variant="outline">off</Badge>}
          footer={<div>{p.next_due && <div>Prossima: <b>{p.next_due}</b></div>}{p.suppliers && <div>👷 {p.suppliers.name}</div>}<div>{(p.checklist as any[])?.length ?? 0} voci checklist</div></div>}
        />
      )}
    />
  );
}