import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { extractInvoice } from "@/lib/invoice-ocr.functions";
import { supabase } from "@/integrations/supabase/client";
import { useActiveStructure } from "@/lib/structure-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SimpleList, ListCard } from "@/components/SimpleList";
import { Plus, Sparkles, Loader2, AlertTriangle, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { downloadFatturaPaXml } from "@/lib/sdi/fatturapa";

export const Route = createFileRoute("/_authenticated/app/invoices")({ component: Page });

function Page() {
  const qc = useQueryClient();
  const { activeStructureId } = useActiveStructure();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ number:"", supplier_id:"", utility_type:"", issue_date: new Date().toISOString().slice(0,10), due_date:"", amount_net:"", vat:"", amount_total:"", status:"da_pagare" });
  const [file, setFile] = useState<File|null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrPreview, setOcrPreview] = useState<any>(null);
  const runOcr = useServerFn(extractInvoice);
  const { data: suppliers = [] } = useQuery({ queryKey:["sup-inv"], queryFn: async()=> (await supabase.from("suppliers").select("id,name").order("name")).data ?? [] });
  const { data: items = [] } = useQuery({
    queryKey: ["invoices", activeStructureId], enabled: !!activeStructureId,
    queryFn: async () => (await supabase.from("invoices").select("*, suppliers(name)").eq("structure_id", activeStructureId!).order("due_date",{ascending:true,nullsFirst:false})).data ?? [],
  });

  const { data: structure } = useQuery({
    queryKey:["inv_struct", activeStructureId],
    enabled: !!activeStructureId,
    queryFn: async () => (await (supabase as any).from("structures").select("*").eq("id", activeStructureId!).maybeSingle()).data,
  });

  async function handleOcr() {
    if (!file) { toast.error("Carica prima un PDF o immagine"); return; }
    setOcrLoading(true);
    try {
      const buf = await file.arrayBuffer();
      const b64 = btoa(Array.from(new Uint8Array(buf)).map((b) => String.fromCharCode(b)).join(""));
      const out: any = await runOcr({ data: { filename: file.name, mimeType: file.type || "application/pdf", dataBase64: b64 } });
      const ex = out.extracted ?? {};
      setOcrPreview(ex);
      // best-effort supplier match by name
      let supplierMatch = "";
      if (ex.supplier_name) {
        const m = (suppliers as any[]).find((s) => s.name?.toLowerCase().includes(String(ex.supplier_name).toLowerCase().split(" ")[0]));
        if (m) supplierMatch = m.id;
      }
      setForm((f) => ({
        ...f,
        number: ex.invoice_number ?? f.number,
        issue_date: ex.issue_date ?? f.issue_date,
        due_date: ex.due_date ?? f.due_date,
        amount_net: ex.amount_net != null ? String(ex.amount_net) : f.amount_net,
        vat: ex.vat != null ? String(ex.vat) : f.vat,
        amount_total: ex.amount_total != null ? String(ex.amount_total) : f.amount_total,
        utility_type: ex.utility_type ?? f.utility_type,
        supplier_id: supplierMatch || f.supplier_id,
      }));
      toast.success("Dati estratti — verifica e conferma");
    } catch (e: any) {
      toast.error(e.message ?? "OCR fallito");
    } finally {
      setOcrLoading(false);
    }
  }

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
        status: form.status as any, pdf_url, ocr_data: ocrPreview ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Fattura registrata"); qc.invalidateQueries({queryKey:["invoices"]}); setOpen(false); setOcrPreview(null); setFile(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const upcoming = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    const in30 = new Date(today); in30.setDate(in30.getDate() + 30);
    return (items as any[]).filter((i) => i.due_date && i.status !== "pagata" && i.status !== "annullata")
      .map((i) => ({ ...i, _due: new Date(i.due_date), _overdue: new Date(i.due_date) < today }))
      .filter((i) => i._due <= in30 || i._overdue)
      .sort((a,b) => +a._due - +b._due);
  }, [items]);
  const totalDue = upcoming.reduce((s, i) => s + Number(i.amount_total || 0), 0);
  const overdueCount = upcoming.filter((i) => i._overdue).length;

  if (!activeStructureId) return <div className="p-10 text-center text-sm text-muted-foreground">Seleziona una struttura.</div>;

  const newInvoiceDialog = (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setOcrPreview(null); } }}>
      <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4"/>Nuova fattura</Button></DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Nuova fattura</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md border border-dashed border-border p-3 space-y-2">
            <Label className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary"/>OCR automatico (Lovable AI)</Label>
            <Input type="file" accept="application/pdf,image/*" onChange={(e)=>{ setFile(e.target.files?.[0]??null); setOcrPreview(null); }}/>
            <Button type="button" size="sm" variant="secondary" disabled={!file || ocrLoading} onClick={handleOcr}>
              {ocrLoading ? <><Loader2 className="mr-1 h-3 w-3 animate-spin"/>Estraggo…</> : <>Estrai dati dal file</>}
            </Button>
            {ocrPreview && (
              <div className="text-xs text-muted-foreground">
                Fornitore: <b>{ocrPreview.supplier_name ?? "—"}</b> · P.IVA: {ocrPreview.supplier_vat ?? "—"} · IBAN: {ocrPreview.supplier_iban ?? "—"}
                {ocrPreview.line_items?.length ? <div>Voci: {ocrPreview.line_items.length}</div> : null}
              </div>
            )}
          </div>
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
          <Button disabled={!form.number||!form.amount_total||mut.isPending} className="w-full" onClick={()=>mut.mutate()}>Crea</Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="space-y-4">
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">Tutte ({(items as any[]).length})</TabsTrigger>
          <TabsTrigger value="schedule"><CalendarClock className="mr-1 h-3 w-3"/>Scadenzario ({upcoming.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="all">
          <SimpleList title="Fatture & Bollette" subtitle="Fatture passive, utenze, OCR automatico." items={items as any[]} empty="Nessuna fattura."
            header={newInvoiceDialog}
            renderItem={(i:any)=>{
              const overdue = i.due_date && i.status!=="pagata" && new Date(i.due_date) < new Date();
              return <ListCard title={`Fatt. ${i.number}`} meta={<>{i.suppliers?.name ?? "—"} · {i.issue_date}</>}
                badges={<><Badge variant={overdue?"destructive":"default"}>{overdue?"scaduta":i.status}</Badge>{i.utility_type && <Badge variant="outline">{i.utility_type}</Badge>}{i.ocr_data && <Badge variant="secondary">OCR</Badge>}</>}
                footer={<div className="space-y-1"><div>Totale: <b>€{i.amount_total}</b>{i.due_date && <span> · Scade: {i.due_date}</span>}{i.pdf_url && <> · <a href={i.pdf_url} target="_blank" className="text-primary underline">PDF</a></>}</div>
                  <Button size="sm" variant="outline" onClick={() => {
                    if (!structure?.vat_number) { toast.error("Inserisci prima la P.IVA della struttura in Impostazioni"); return; }
                    downloadFatturaPaXml({ structure, supplier: i.suppliers ? { name: i.suppliers.name } : null, invoice: { number: i.number, issue_date: i.issue_date, amount_net: i.amount_net, vat: i.vat, amount_total: i.amount_total, description: i.utility_type || "Servizi" } });
                    toast.success("XML SDI scaricato");
                  }}>Export SDI XML</Button>
                </div>}/>;
            }}
          />
        </TabsContent>
        <TabsContent value="schedule" className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Totale da pagare (30gg + scadute)</CardTitle></CardHeader>
              <CardContent className="font-display text-2xl font-bold">€{totalDue.toFixed(2)}</CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Fatture scadute</CardTitle></CardHeader>
              <CardContent className="flex items-center gap-2 font-display text-2xl font-bold">{overdueCount > 0 && <AlertTriangle className="h-5 w-5 text-destructive"/>}{overdueCount}</CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">In scadenza ≤ 30 giorni</CardTitle></CardHeader>
              <CardContent className="font-display text-2xl font-bold">{upcoming.length - overdueCount}</CardContent></Card>
          </div>
          <Card><CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <tr><th className="px-4 py-2">Scadenza</th><th className="px-4 py-2">Numero</th><th className="px-4 py-2">Fornitore</th><th className="px-4 py-2 text-right">Totale</th><th className="px-4 py-2">Stato</th></tr>
              </thead>
              <tbody>
                {upcoming.map((i:any) => (
                  <tr key={i.id} className="border-b border-border/60">
                    <td className="px-4 py-2 font-mono text-xs">{i.due_date}</td>
                    <td className="px-4 py-2">{i.number}</td>
                    <td className="px-4 py-2">{i.suppliers?.name ?? "—"}</td>
                    <td className="px-4 py-2 text-right font-medium">€{Number(i.amount_total).toFixed(2)}</td>
                    <td className="px-4 py-2"><Badge variant={i._overdue ? "destructive" : "outline"}>{i._overdue ? "scaduta" : i.status}</Badge></td>
                  </tr>
                ))}
                {upcoming.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Nessuna scadenza nei prossimi 30 giorni.</td></tr>}
              </tbody>
            </table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
