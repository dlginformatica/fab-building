import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveStructure } from "@/lib/structure-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, RefreshCw, Paperclip, Upload, Download, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/contracts")({ component: Page });

const STATUS_VARIANT: Record<string, "default"|"secondary"|"destructive"|"outline"> = {
  attivo: "default", bozza: "secondary", scaduto: "destructive", disdetto: "outline",
};

function Page() {
  const qc = useQueryClient();
  const { activeStructureId } = useActiveStructure();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code:"", title:"", supplier_id:"", type:"canone", status:"bozza", start_date:"", end_date:"", amount:"", auto_renew:false, notice_period_days:"30", renewal_terms:"", sla_ack_minutes:"", sla_resolve_minutes:"", notes:"" });
  const [renewCt, setRenewCt] = useState<any | null>(null);
  const [attachCt, setAttachCt] = useState<any | null>(null);
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
        notice_period_days: form.notice_period_days ? parseInt(form.notice_period_days) : 30,
        renewal_terms: form.renewal_terms || null,
        sla_ack_minutes: form.sla_ack_minutes ? parseInt(form.sla_ack_minutes) : null,
        sla_resolve_minutes: form.sla_resolve_minutes ? parseInt(form.sla_resolve_minutes) : null,
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Contratto creato"); qc.invalidateQueries({queryKey:["contracts"]}); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const today = new Date(); today.setHours(0,0,0,0);
  const expSoon = useMemo(() => {
    return (items as any[])
      .filter((c) => c.end_date && c.status === "attivo")
      .map((c) => ({ ...c, _days: Math.ceil((new Date(c.end_date).getTime() - today.getTime())/86400000) }))
      .filter((c) => c._days <= 90)
      .sort((a,b)=> a._days - b._days);
  }, [items]);
  const k30 = expSoon.filter(c=>c._days<=30 && c._days>=0).length;
  const k60 = expSoon.filter(c=>c._days<=60 && c._days>30).length;
  const k90 = expSoon.filter(c=>c._days<=90 && c._days>60).length;
  const overdue = expSoon.filter(c=>c._days<0).length;

  if (!activeStructureId) return <div className="p-10 text-center text-sm text-muted-foreground">Seleziona una struttura.</div>;
  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold">Contratti</h1>
          <p className="text-sm text-muted-foreground">Canoni, rinnovi, allegati e scadenziario.</p>
        </div>
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
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Preavviso (giorni)</Label><Input type="number" value={form.notice_period_days} onChange={(e)=>setForm({...form,notice_period_days:e.target.value})}/></div>
                <label className="flex items-end gap-2 text-sm pb-2"><input type="checkbox" checked={form.auto_renew} onChange={(e)=>setForm({...form,auto_renew:e.target.checked})}/>Rinnovo automatico</label>
              </div>
              <div className="space-y-1"><Label>Termini di rinnovo</Label><Textarea rows={2} value={form.renewal_terms} onChange={(e)=>setForm({...form,renewal_terms:e.target.value})} placeholder="Es. tacito rinnovo 12 mesi salvo disdetta…"/></div>
              <div className="space-y-1"><Label>Note</Label><Textarea rows={2} value={form.notes} onChange={(e)=>setForm({...form,notes:e.target.value})}/></div>
              <Button disabled={!form.code||!form.title||!form.supplier_id||mut.isPending} className="w-full" onClick={()=>mut.mutate()}>Crea</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="tutti">
        <TabsList>
          <TabsTrigger value="tutti">Tutti ({items.length})</TabsTrigger>
          <TabsTrigger value="scadenzario">Scadenzario ({expSoon.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="tutti" className="mt-4">
          {items.length === 0
            ? <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">Nessun contratto.</CardContent></Card>
            : <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {(items as any[]).map((c)=> <ContractCard key={c.id} c={c} onRenew={()=>setRenewCt(c)} onAttach={()=>setAttachCt(c)} />)}
              </div>}
        </TabsContent>
        <TabsContent value="scadenzario" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Scaduti" value={overdue} tone="destructive" />
            <KpiCard label="≤ 30 gg" value={k30} tone="warning" />
            <KpiCard label="31–60 gg" value={k60} />
            <KpiCard label="61–90 gg" value={k90} />
          </div>
          {expSoon.length === 0
            ? <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">Nessuna scadenza nei prossimi 90 giorni.</CardContent></Card>
            : <Card><CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                    <tr><th className="p-2 text-left">Codice</th><th className="p-2 text-left">Titolo</th><th className="p-2 text-left">Fornitore</th><th className="p-2 text-left">Scadenza</th><th className="p-2 text-right">Giorni</th><th className="p-2 text-right">Azioni</th></tr>
                  </thead>
                  <tbody>
                    {expSoon.map((c:any)=>(
                      <tr key={c.id} className="border-t">
                        <td className="p-2 font-mono text-xs">{c.code}</td>
                        <td className="p-2">{c.title}</td>
                        <td className="p-2">{c.suppliers?.name ?? "—"}</td>
                        <td className="p-2">{c.end_date}</td>
                        <td className="p-2 text-right"><Badge variant={c._days<0?"destructive":c._days<=30?"default":"secondary"}>{c._days<0?`${-c._days} gg fa`:`${c._days} gg`}</Badge></td>
                        <td className="p-2 text-right"><Button size="sm" variant="outline" onClick={()=>setRenewCt(c)}><RefreshCw className="mr-1 h-3 w-3"/>Rinnova</Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent></Card>}
        </TabsContent>
      </Tabs>

      <RenewDialog contract={renewCt} onClose={()=>setRenewCt(null)} />
      <AttachmentsDialog contract={attachCt} onClose={()=>setAttachCt(null)} />
    </div>
  );
}

function KpiCard({ label, value, tone }: { label: string; value: number; tone?: "destructive"|"warning" }) {
  const cls = tone === "destructive" ? "text-destructive" : tone === "warning" ? "text-amber-500" : "text-foreground";
  return (
    <Card><CardContent className="p-4">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className={`mt-1 font-display text-3xl font-bold ${cls}`}>{value}</div>
    </CardContent></Card>
  );
}

function ContractCard({ c, onRenew, onAttach }: { c: any; onRenew: ()=>void; onAttach: ()=>void }) {
  const daysLeft = c.end_date ? Math.ceil((new Date(c.end_date).getTime() - Date.now())/86400000) : null;
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="font-display text-base">{c.title}</CardTitle>
          <Badge variant={STATUS_VARIANT[c.status] ?? "secondary"}>{c.status}</Badge>
        </div>
        <div className="text-xs text-muted-foreground font-mono">{c.code} · {c.suppliers?.name ?? "—"}</div>
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground space-y-1">
        {c.start_date && <div>Periodo: {c.start_date} → {c.end_date ?? "—"} {daysLeft !== null && daysLeft <= 90 && <Badge className="ml-1" variant={daysLeft<0?"destructive":daysLeft<=30?"default":"secondary"}>{daysLeft<0?`scaduto da ${-daysLeft}gg`:`${daysLeft}gg`}</Badge>}</div>}
        {c.amount && <div>Importo: <b className="text-foreground">€{c.amount}</b></div>}
        <div className="flex items-center gap-3 pt-1">
          {c.auto_renew && <span>🔁 Auto-rinnovo</span>}
          <span>📎 {c.attachments_count ?? 0} allegati</span>
          <span>Preavviso: {c.notice_period_days ?? 30}gg</span>
        </div>
        <div className="flex gap-2 pt-2">
          <Button size="sm" variant="outline" onClick={onRenew}><RefreshCw className="mr-1 h-3 w-3"/>Rinnova</Button>
          <Button size="sm" variant="outline" onClick={onAttach}><Paperclip className="mr-1 h-3 w-3"/>Allegati</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RenewDialog({ contract, onClose }: { contract: any | null; onClose: ()=>void }) {
  const qc = useQueryClient();
  const [newEnd, setNewEnd] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const mut = useMutation({
    mutationFn: async () => {
      if (!contract) return;
      const { error } = await supabase.from("contract_renewals").insert({
        contract_id: contract.id, structure_id: contract.structure_id,
        previous_end_date: contract.end_date, new_end_date: newEnd,
        amount: amount ? parseFloat(amount) : null, notes: notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Rinnovo registrato"); qc.invalidateQueries({queryKey:["contracts"]}); qc.invalidateQueries({queryKey:["contract-renewals"]}); onClose(); setNewEnd(""); setAmount(""); setNotes(""); },
    onError: (e: Error) => toast.error(e.message),
  });
  const { data: renewals = [] } = useQuery({
    enabled: !!contract,
    queryKey: ["contract-renewals", contract?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("contract_renewals").select("*").eq("contract_id", contract.id).order("renewed_at",{ascending:false});
      if (error) throw error; return data;
    },
  });
  return (
    <Dialog open={!!contract} onOpenChange={(o)=>!o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Rinnova contratto · {contract?.code}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground">Fine attuale: <b>{contract?.end_date ?? "—"}</b></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Nuova scadenza *</Label><Input type="date" value={newEnd} onChange={(e)=>setNewEnd(e.target.value)}/></div>
            <div className="space-y-1"><Label>Nuovo importo €</Label><Input type="number" value={amount} onChange={(e)=>setAmount(e.target.value)}/></div>
          </div>
          <div className="space-y-1"><Label>Note</Label><Textarea rows={2} value={notes} onChange={(e)=>setNotes(e.target.value)}/></div>
          <Button className="w-full" disabled={!newEnd || mut.isPending} onClick={()=>mut.mutate()}>Conferma rinnovo</Button>
          {renewals.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase text-muted-foreground">Storico rinnovi</div>
              <ul className="space-y-1 text-xs">
                {(renewals as any[]).map((r)=>(
                  <li key={r.id} className="border-l-2 border-primary/40 pl-2">
                    {new Date(r.renewed_at).toLocaleDateString("it-IT")} — {r.previous_end_date ?? "—"} → <b>{r.new_end_date}</b>{r.amount && <> · €{r.amount}</>}
                    {r.notes && <div className="text-muted-foreground">{r.notes}</div>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AttachmentsDialog({ contract, onClose }: { contract: any | null; onClose: ()=>void }) {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const { data: attachments = [] } = useQuery({
    enabled: !!contract,
    queryKey: ["contract-attachments", contract?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("contract_attachments").select("*").eq("contract_id", contract.id).order("created_at",{ascending:false});
      if (error) throw error; return data;
    },
  });
  async function upload(file: File) {
    if (!contract) return;
    setUploading(true);
    try {
      const path = `${contract.structure_id}/${contract.id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("contracts").upload(path, file);
      if (upErr) throw upErr;
      const { data: userData } = await supabase.auth.getUser();
      const { error: insErr } = await supabase.from("contract_attachments").insert({
        contract_id: contract.id, structure_id: contract.structure_id,
        storage_path: path, file_name: file.name, mime_type: file.type, size_bytes: file.size,
        uploaded_by: userData.user?.id,
      });
      if (insErr) throw insErr;
      toast.success("Allegato caricato");
      qc.invalidateQueries({queryKey:["contract-attachments"]});
      qc.invalidateQueries({queryKey:["contracts"]});
    } catch (e:any) { toast.error(e.message); }
    finally { setUploading(false); }
  }
  async function download(att: any) {
    const { data, error } = await supabase.storage.from("contracts").createSignedUrl(att.storage_path, 300);
    if (error) { toast.error(error.message); return; }
    window.open(data.signedUrl, "_blank");
  }
  async function remove(att: any) {
    if (!confirm(`Eliminare ${att.file_name}?`)) return;
    await supabase.storage.from("contracts").remove([att.storage_path]);
    await supabase.from("contract_attachments").delete().eq("id", att.id);
    qc.invalidateQueries({queryKey:["contract-attachments"]});
    qc.invalidateQueries({queryKey:["contracts"]});
  }
  return (
    <Dialog open={!!contract} onOpenChange={(o)=>!o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Allegati · {contract?.code}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <label className="flex items-center justify-center gap-2 rounded-md border-2 border-dashed border-border p-6 text-sm text-muted-foreground hover:bg-muted/30 cursor-pointer">
            <Upload className="h-4 w-4"/>{uploading ? "Caricamento…" : "Carica documento"}
            <input type="file" className="hidden" onChange={(e)=>e.target.files?.[0] && upload(e.target.files[0])}/>
          </label>
          {attachments.length === 0
            ? <div className="py-6 text-center text-xs text-muted-foreground">Nessun allegato.</div>
            : <ul className="space-y-1">
                {(attachments as any[]).map((a)=>(
                  <li key={a.id} className="flex items-center justify-between gap-2 rounded-md border border-border p-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{a.file_name}</div>
                      <div className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleDateString("it-IT")} · {a.size_bytes ? `${Math.round(a.size_bytes/1024)} KB` : "—"}</div>
                    </div>
                    <Button size="sm" variant="ghost" onClick={()=>download(a)}><Download className="h-3 w-3"/></Button>
                    <Button size="sm" variant="ghost" onClick={()=>remove(a)}><Trash2 className="h-3 w-3 text-destructive"/></Button>
                  </li>
                ))}
              </ul>}
        </div>
      </DialogContent>
    </Dialog>
  );
}