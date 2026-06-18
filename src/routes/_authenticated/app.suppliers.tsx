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

export const Route = createFileRoute("/_authenticated/app/suppliers")({ component: Page });

function Page() {
  const qc = useQueryClient();
  const { activeStructureId } = useActiveStructure();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", vat_number: "", category: "", email: "", phone: "", contact_person: "", durc_expiry: "", insurance_expiry: "", status: "attivo", notes: "" });
  const { data: items = [] } = useQuery({
    queryKey: ["suppliers", activeStructureId],
    queryFn: async () => {
      let q = supabase.from("suppliers").select("*").order("name");
      if (activeStructureId) q = q.or(`structure_id.eq.${activeStructureId},structure_id.is.null`);
      const { data, error } = await q; if (error) throw error; return data;
    },
  });
  const mut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("suppliers").insert({
        ...form, structure_id: activeStructureId ?? null,
        durc_expiry: form.durc_expiry || null, insurance_expiry: form.insurance_expiry || null,
        status: form.status as any,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Fornitore creato"); qc.invalidateQueries({ queryKey: ["suppliers"] }); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <SimpleList
      title="Fornitori" subtitle="Anagrafica fornitori di servizi e manutenzione."
      items={items} empty="Nessun fornitore."
      header={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" />Nuovo fornitore</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Nuovo fornitore</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Ragione sociale *</Label><Input value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})}/></div>
                <div className="space-y-1"><Label>P. IVA</Label><Input value={form.vat_number} onChange={(e)=>setForm({...form,vat_number:e.target.value})}/></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Categoria servizio</Label><Input placeholder="HVAC, Idraulico…" value={form.category} onChange={(e)=>setForm({...form,category:e.target.value})}/></div>
                <div className="space-y-1"><Label>Referente</Label><Input value={form.contact_person} onChange={(e)=>setForm({...form,contact_person:e.target.value})}/></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Email</Label><Input type="email" value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})}/></div>
                <div className="space-y-1"><Label>Telefono</Label><Input value={form.phone} onChange={(e)=>setForm({...form,phone:e.target.value})}/></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Scadenza DURC</Label><Input type="date" value={form.durc_expiry} onChange={(e)=>setForm({...form,durc_expiry:e.target.value})}/></div>
                <div className="space-y-1"><Label>Scadenza assicurazione</Label><Input type="date" value={form.insurance_expiry} onChange={(e)=>setForm({...form,insurance_expiry:e.target.value})}/></div>
              </div>
              <div className="space-y-1"><Label>Stato</Label>
                <Select value={form.status} onValueChange={(v)=>setForm({...form,status:v})}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent><SelectItem value="attivo">Attivo</SelectItem><SelectItem value="sospeso">Sospeso</SelectItem><SelectItem value="dismesso">Dismesso</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Note</Label><Textarea rows={2} value={form.notes} onChange={(e)=>setForm({...form,notes:e.target.value})}/></div>
              <Button disabled={!form.name || mut.isPending} className="w-full" onClick={()=>mut.mutate()}>Crea</Button>
            </div>
          </DialogContent>
        </Dialog>
      }
      renderItem={(s: any) => (
        <ListCard
          title={s.name}
          meta={<>{s.category ?? "—"} · {s.vat_number ?? ""}</>}
          badges={<Badge variant={s.status==="attivo"?"default":"outline"}>{s.status}</Badge>}
          footer={<div className="space-y-0.5">
            {s.contact_person && <div>👤 {s.contact_person}</div>}
            {s.email && <div>✉ {s.email}</div>}
            {s.phone && <div>📞 {s.phone}</div>}
            {s.durc_expiry && <div>DURC scade: <b>{s.durc_expiry}</b></div>}
          </div>}
        />
      )}
    />
  );
}