import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveStructure } from "@/lib/structure-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { SimpleList, ListCard } from "@/components/SimpleList";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/invoices")({ component: Page });

function Page() {
  const qc = useQueryClient();
  const { activeStructureId } = useActiveStructure();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ number:"", supplier_id:"", utility_type:"", issue_date: new Date().toISOString().slice(0,10), due_date:"", amount_net:"", vat:"", amount_total:"", status:"da_pagare" });
  const [file, setFile] = useState<File|null>(null);
  const { data: suppliers = [] } = useQuery({ queryKey:["sup-inv"], queryFn: async()=> (await supabase.from("suppliers").select("id,name").order("name")).data ?? [] });
  const { data: items = [] } = useQuery({
    queryKey: ["invoices", activeStructureId], enabled: !!activeStructureId,
    queryFn: async () => (await supabase.from("invoices").select("*, suppliers(name)").eq("structure_id", activeStructureId!).order("due_date",{ascending:true,nullsFirst:false})).data ?? [],
  });
  const mut = useMutation({
    mutationFn: async () => {
      let pdf_url: string | null = null;
      if (file) {
        const path = `${activeStructureId}/${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage.from("assets").upload(path, file);
        if (upErr) throw upErr;
        pdf_url = supabase.storage.from("assets").getPublicUrl(path).data.publicUrl;
      }
      const { error } = await supabase.from("invoices").insert({
        structure_id: activeStructureId!, number: form.number,
        supplier_id: form.supplier_id || null, utility_type: (form.utility_type || null) as any,
        issue_date: form.issue_date, due_date: form.due_date || null,
        amount_net: form.amount_net ? parseFloat(form.amount_net) : null,
        vat: form.vat ? parseFloat(form.vat) : null,
        amount_total: parseFloat(form.amount_total || "0"),
        status: form.status as any, pdf_url,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Fattura registrata"); qc.invalidateQueries({queryKey:["invoices"]}); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  if (!activeStructureId) return <div className="p-10 text-center text-sm text-muted-foreground">Seleziona una struttura.</div>;
  return (
    <SimpleList title="Fatture & Bollette" subtitle="Fatture passive, utenze, scadenzario pagamenti." items={items} empty="Nessuna fattura."
      header={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4"/>Nuova fattura</Button></DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nuova fattura</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Numero *</Label><Input value={form.number} onChange={(e)=>setForm({...form,number:e.target.value})}/></div>
                <div className="space-y-1"><Label>Stato</Label>
                  <Select value={form.status} onValueChange={(v)=>setForm({...form,status:v})}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>{["da_pagare","pagata","scaduta","contestata","annullata"].map(x=><SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1"><Label>Fornitore</Label>
                <Select value={form.supplier_id} onValueChange={(v)=>setForm({...form,supplier_id:v})}>
                  <SelectTrigger><SelectValue placeholder="—"/></SelectTrigger>
                  <SelectContent>{suppliers.map((s:any)=><SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Tipo utenza (se bolletta)</Label>
                <Select value={form.utility_type} onValueChange={(v)=>setForm({...form,utility_type:v})}>
                  <SelectTrigger><SelectValue placeholder="—"/></SelectTrigger>
                  <SelectContent>{["elettricita","gas","acqua","gasolio","teleriscaldamento","altro"].map(x=><SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Data emissione *</Label><Input type="date" value={form.issue_date} onChange={(e)=>setForm({...form,issue_date:e.target.value})}/></div>
                <div className="space-y-1"><Label>Scadenza</Label><Input type="date" value={form.due_date} onChange={(e)=>setForm({...form,due_date:e.target.value})}/></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1"><Label>Imponibile</Label><Input type="number" value={form.amount_net} onChange={(e)=>setForm({...form,amount_net:e.target.value})}/></div>
                <div className="space-y-1"><Label>IVA</Label><Input type="number" value={form.vat} onChange={(e)=>setForm({...form,vat:e.target.value})}/></div>
                <div className="space-y-1"><Label>Totale *</Label><Input type="number" value={form.amount_total} onChange={(e)=>setForm({...form,amount_total:e.target.value})}/></div>
              </div>
              <div className="space-y-1"><Label>PDF fattura</Label><Input type="file" accept="application/pdf" onChange={(e)=>setFile(e.target.files?.[0]??null)}/></div>
              <Button disabled={!form.number||!form.amount_total||mut.isPending} className="w-full" onClick={()=>mut.mutate()}>Crea</Button>
            </div>
          </DialogContent>
        </Dialog>
      }
      renderItem={(i:any)=>{
        const overdue = i.due_date && i.status!=="pagata" && new Date(i.due_date) < new Date();
        return <ListCard title={`Fatt. ${i.number}`} meta={<>{i.suppliers?.name ?? "—"} · {i.issue_date}</>}
          badges={<><Badge variant={overdue?"destructive":"default"}>{overdue?"scaduta":i.status}</Badge>{i.utility_type && <Badge variant="outline">{i.utility_type}</Badge>}</>}
          footer={<div>Totale: <b>€{i.amount_total}</b>{i.due_date && <div>Scade: {i.due_date}</div>}{i.pdf_url && <a href={i.pdf_url} target="_blank" className="text-primary underline">PDF</a>}</div>}/>;
      }}
    />
  );
}