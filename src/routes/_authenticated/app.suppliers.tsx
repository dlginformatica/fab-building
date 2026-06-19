import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
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
import { Plus, FileCheck2, ShieldCheck, ShieldAlert, Upload, Check, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/suppliers")({ component: Page });

const SDI_RE = /^[A-Z0-9]{6,7}$/; // 7 chars business, 6 PA; "0000000" placeholder accepted
const PEC_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const supplierSchema = z.object({
  name: z.string().trim().min(1, "Ragione sociale obbligatoria").max(200),
  sdi_code: z.string().trim().toUpperCase().refine((v) => v === "" || SDI_RE.test(v), "Codice SDI: 6-7 caratteri alfanumerici"),
  pec: z.string().trim().refine((v) => v === "" || PEC_RE.test(v), "PEC non valida (es. pec@legalmail.it)"),
  email: z.string().trim().refine((v) => v === "" || PEC_RE.test(v), "Email non valida"),
});

const DOC_LABELS: Record<string, string> = {
  visura: "Visura camerale",
  durc: "DURC",
  insurance: "Polizza assicurativa",
  sdi_certification: "Certificazione SDI",
  iban_proof: "Attestazione IBAN",
  haccp: "HACCP",
  privacy: "Privacy / GDPR",
  other: "Altro",
};

const VERIF_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "outline", in_review: "secondary", verified: "default", rejected: "destructive",
};
const VERIF_LABEL: Record<string, string> = {
  pending: "Da verificare", in_review: "In verifica", verified: "Verificato", rejected: "Rifiutato",
};

function Page() {
  const qc = useQueryClient();
  const { activeStructureId } = useActiveStructure();
  const [open, setOpen] = useState(false);
  const [docsFor, setDocsFor] = useState<any | null>(null);
  const [form, setForm] = useState({
    name: "", vat_number: "", tax_code: "", sdi_code: "", pec: "",
    category: "", email: "", phone: "", website: "", contact_person: "",
    billing_address: "", city: "", province: "", postal_code: "", country: "IT",
    iban: "", rea_number: "",
    durc_expiry: "", insurance_expiry: "", status: "attivo", notes: "",
  });
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
      const parsed = supplierSchema.safeParse(form);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Dati non validi");
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

  const verifyMut = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("suppliers").update({
        verification_status: status,
        verified_at: status === "verified" || status === "rejected" ? new Date().toISOString() : null,
        verified_by: status === "verified" || status === "rejected" ? user?.id ?? null : null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Stato verifica aggiornato"); qc.invalidateQueries({ queryKey: ["suppliers"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
    <SimpleList
      title="Fornitori" subtitle="Anagrafica fornitori di servizi e manutenzione."
      items={items} empty="Nessun fornitore."
      header={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" />Nuovo fornitore</Button></DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nuovo fornitore</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Anagrafica</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Ragione sociale *</Label><Input value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})}/></div>
                  <div className="space-y-1"><Label>Categoria servizio</Label><Input placeholder="HVAC, Idraulico…" value={form.category} onChange={(e)=>setForm({...form,category:e.target.value})}/></div>
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dati fiscali</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>Partita IVA</Label><Input value={form.vat_number} onChange={(e)=>setForm({...form,vat_number:e.target.value})}/></div>
                  <div className="space-y-1"><Label>Codice Fiscale</Label><Input value={form.tax_code} onChange={(e)=>setForm({...form,tax_code:e.target.value})}/></div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label>Codice SDI</Label>
                    <Input maxLength={7} placeholder="7 caratteri alfanum." value={form.sdi_code} onChange={(e)=>setForm({...form,sdi_code:e.target.value.toUpperCase()})}/>
                    {form.sdi_code && !SDI_RE.test(form.sdi_code) && <p className="text-xs text-destructive">6-7 caratteri A-Z/0-9</p>}
                  </div>
                  <div className="space-y-1 col-span-2">
                    <Label>PEC</Label>
                    <Input type="email" placeholder="pec@legalmail.it" value={form.pec} onChange={(e)=>setForm({...form,pec:e.target.value})}/>
                    {form.pec && !PEC_RE.test(form.pec) && <p className="text-xs text-destructive">Formato email non valido</p>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>IBAN</Label><Input value={form.iban} onChange={(e)=>setForm({...form,iban:e.target.value.toUpperCase().replace(/\s/g,"")})}/></div>
                  <div className="space-y-1"><Label>REA</Label><Input placeholder="MI-123456" value={form.rea_number} onChange={(e)=>setForm({...form,rea_number:e.target.value})}/></div>
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contatti</h3>
                <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Referente</Label><Input value={form.contact_person} onChange={(e)=>setForm({...form,contact_person:e.target.value})}/></div>
                  <div className="space-y-1"><Label>Sito web</Label><Input type="url" placeholder="https://" value={form.website} onChange={(e)=>setForm({...form,website:e.target.value})}/></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Email</Label><Input type="email" value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})}/></div>
                <div className="space-y-1"><Label>Telefono</Label><Input value={form.phone} onChange={(e)=>setForm({...form,phone:e.target.value})}/></div>
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sede legale</h3>
                <div className="space-y-1"><Label>Indirizzo</Label><Input placeholder="Via Roma 10" value={form.billing_address} onChange={(e)=>setForm({...form,billing_address:e.target.value})}/></div>
                <div className="grid grid-cols-4 gap-3">
                  <div className="space-y-1 col-span-2"><Label>Città</Label><Input value={form.city} onChange={(e)=>setForm({...form,city:e.target.value})}/></div>
                  <div className="space-y-1"><Label>Prov.</Label><Input maxLength={2} value={form.province} onChange={(e)=>setForm({...form,province:e.target.value.toUpperCase()})}/></div>
                  <div className="space-y-1"><Label>CAP</Label><Input maxLength={5} value={form.postal_code} onChange={(e)=>setForm({...form,postal_code:e.target.value})}/></div>
                </div>
                <div className="space-y-1"><Label>Paese</Label><Input maxLength={2} value={form.country} onChange={(e)=>setForm({...form,country:e.target.value.toUpperCase()})}/></div>
              </section>

              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Compliance</h3>
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
              </section>

              <div className="space-y-1"><Label>Note</Label><Textarea rows={2} value={form.notes} onChange={(e)=>setForm({...form,notes:e.target.value})}/></div>
              <Button disabled={!form.name || mut.isPending} className="w-full" onClick={()=>mut.mutate()}>Crea</Button>
            </div>
          </DialogContent>
        </Dialog>
      }
      renderItem={(s: any) => (
        <ListCard
          title={s.name}
          meta={<>{s.category ?? "—"} {s.vat_number ? `· P.IVA ${s.vat_number}` : ""} {s.city ? `· ${s.city}${s.province?` (${s.province})`:""}` : ""}</>}
          badges={<>
            <Badge variant={s.status==="attivo"?"default":"outline"}>{s.status}</Badge>
            <Badge variant={VERIF_VARIANT[s.verification_status ?? "pending"]}>{VERIF_LABEL[s.verification_status ?? "pending"]}</Badge>
          </>}
          footer={<div className="space-y-0.5">
            {s.contact_person && <div>👤 {s.contact_person}</div>}
            {s.email && <div>✉ {s.email}</div>}
            {s.pec && <div>🛡 PEC: {s.pec}</div>}
            {s.sdi_code && <div>📨 SDI: <code>{s.sdi_code}</code></div>}
            {s.phone && <div>📞 {s.phone}</div>}
            {s.iban && <div>🏦 {s.iban}</div>}
            {s.durc_expiry && <div>DURC scade: <b>{s.durc_expiry}</b></div>}
            <div className="pt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={()=>setDocsFor(s)}><FileCheck2 className="mr-1 h-3.5 w-3.5"/>Documenti</Button>
              {s.verification_status !== "verified" && (
                <Button size="sm" variant="default" disabled={verifyMut.isPending} onClick={()=>verifyMut.mutate({id:s.id,status:"verified"})}>
                  <ShieldCheck className="mr-1 h-3.5 w-3.5"/>Verifica
                </Button>
              )}
              {s.verification_status !== "rejected" && (
                <Button size="sm" variant="outline" disabled={verifyMut.isPending} onClick={()=>verifyMut.mutate({id:s.id,status:"rejected"})}>
                  <ShieldAlert className="mr-1 h-3.5 w-3.5"/>Rifiuta
                </Button>
              )}
            </div>
          </div>}
        />
      )}
    />
    {docsFor && <DocumentsDialog supplier={docsFor} onClose={()=>setDocsFor(null)} />}
    </>
  );
}

function DocumentsDialog({ supplier, onClose }: { supplier: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [docType, setDocType] = useState<string>("visura");
  const [expiresOn, setExpiresOn] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: docs = [] } = useQuery({
    queryKey: ["supplier_documents", supplier.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("supplier_documents")
        .select("*").eq("supplier_id", supplier.id).order("created_at", { ascending: false });
      if (error) throw error; return data ?? [];
    },
  });

  const upload = async () => {
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let file_path: string | null = null;
      if (file) {
        const path = `${supplier.id}/${docType}/${Date.now()}_${file.name}`;
        const { error: upErr } = await supabase.storage.from("supplier-docs").upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        file_path = path;
      }
      const { error } = await (supabase as any).from("supplier_documents").insert({
        supplier_id: supplier.id, doc_type: docType, status: "pending",
        file_path, file_name: file?.name ?? null, mime_type: file?.type ?? null, size_bytes: file?.size ?? null,
        expires_on: expiresOn || null, uploaded_by: user?.id ?? null,
      });
      if (error) throw error;
      toast.success("Documento caricato");
      setFile(null); setExpiresOn("");
      qc.invalidateQueries({ queryKey: ["supplier_documents", supplier.id] });
    } catch (e: any) {
      toast.error(e.message);
    } finally { setUploading(false); }
  };

  const decide = async (id: string, status: "confirmed" | "rejected") => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from("supplier_documents").update({
      status, confirmed_by: user?.id ?? null, confirmed_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(status === "confirmed" ? "Documento confermato" : "Documento rifiutato");
    qc.invalidateQueries({ queryKey: ["supplier_documents", supplier.id] });
  };

  const openFile = async (path: string) => {
    const { data, error } = await supabase.storage.from("supplier-docs").createSignedUrl(path, 60);
    if (error) { toast.error(error.message); return; }
    window.open(data.signedUrl, "_blank");
  };

  return (
    <Dialog open onOpenChange={(o)=>{ if(!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Documenti fiscali · {supplier.name}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <section className="space-y-2 rounded-lg border p-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Carica documento</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Select value={docType} onValueChange={setDocType}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    {Object.entries(DOC_LABELS).map(([k,v])=> <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Scadenza (opz.)</Label><Input type="date" value={expiresOn} onChange={(e)=>setExpiresOn(e.target.value)}/></div>
            </div>
            <div className="space-y-1"><Label>File</Label><Input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(e)=>setFile(e.target.files?.[0] ?? null)}/></div>
            <Button disabled={uploading} onClick={upload}><Upload className="mr-1 h-4 w-4"/>Carica in stato "da confermare"</Button>
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Archivio</h3>
            {docs.length === 0 && <p className="text-sm text-muted-foreground">Nessun documento caricato.</p>}
            <div className="space-y-2">
              {docs.map((d: any) => (
                <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm">
                  <div className="space-y-0.5">
                    <div className="font-medium">{DOC_LABELS[d.doc_type] ?? d.doc_type}</div>
                    <div className="text-xs text-muted-foreground">
                      {d.file_name ?? "—"} {d.expires_on ? `· scade ${d.expires_on}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={d.status==="confirmed"?"default":d.status==="rejected"?"destructive":"outline"}>{d.status}</Badge>
                    {d.file_path && <Button size="sm" variant="ghost" onClick={()=>openFile(d.file_path)}>Apri</Button>}
                    {d.status !== "confirmed" && <Button size="sm" variant="default" onClick={()=>decide(d.id,"confirmed")}><Check className="h-3.5 w-3.5"/></Button>}
                    {d.status !== "rejected" && <Button size="sm" variant="outline" onClick={()=>decide(d.id,"rejected")}><X className="h-3.5 w-3.5"/></Button>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}