import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveStructure } from "@/lib/structure-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldCheck, Star, AlertTriangle, Lock, Unlock } from "lucide-react";
import { toast } from "sonner";
import { fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/app/suppliers-compliance")({ component: Page });

const STATUS_LABELS: Record<string,{label:string;cls:string}> = {
  ok:            { label: "Conforme",            cls: "bg-success/15 text-success border-success/30" },
  in_scadenza:   { label: "In scadenza < 30gg",  cls: "bg-warning/15 text-warning border-warning/30" },
  durc_scaduto:  { label: "DURC scaduto",        cls: "bg-destructive/15 text-destructive border-destructive/30" },
  assicurazione_scaduta: { label: "Assicurazione scaduta", cls: "bg-destructive/15 text-destructive border-destructive/30" },
  haccp_scaduto: { label: "HACCP scaduto",       cls: "bg-destructive/15 text-destructive border-destructive/30" },
  visura_scaduta:{ label: "Visura scaduta",      cls: "bg-destructive/15 text-destructive border-destructive/30" },
  bloccato:      { label: "Bloccato",            cls: "bg-destructive/30 text-destructive border-destructive/50" },
};

function Page() {
  const qc = useQueryClient();
  const { activeStructureId } = useActiveStructure();
  const [filter, setFilter] = useState("tutti");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<any|null>(null);

  const { data: rows = [] } = useQuery({
    queryKey: ["supplier_compliance", activeStructureId],
    queryFn: async () => {
      let q = (supabase as any).from("supplier_compliance").select("*").order("next_expiry");
      if (activeStructureId) q = q.or(`structure_id.eq.${activeStructureId},structure_id.is.null`);
      const { data, error } = await q; if (error) throw error; return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return (rows as any[]).filter(r => {
      if (filter !== "tutti" && r.compliance_status !== filter) return false;
      if (!s) return true;
      return [r.name, r.vat_number, r.category, r.email, r.contact_person].some((x:string)=>(x||"").toLowerCase().includes(s));
    });
  }, [rows, filter, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { tutti: rows.length };
    for (const r of rows as any[]) c[r.compliance_status] = (c[r.compliance_status]||0)+1;
    return c;
  }, [rows]);

  const update = useMutation({
    mutationFn: async (patch: any) => {
      const { error } = await supabase.from("suppliers").update(patch).eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Aggiornato"); qc.invalidateQueries({queryKey:["supplier_compliance"]}); setEditing(null); },
    onError: (e: Error) => toast.error(e.message),
  });
  const toggleBlock = useMutation({
    mutationFn: async (r: any) => {
      const { error } = await supabase.from("suppliers").update({ blocked: !r.blocked }).eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({queryKey:["supplier_compliance"]}),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold flex items-center gap-2"><ShieldCheck className="h-5 w-5"/>Fornitori certificati</h1>
        <p className="text-sm text-muted-foreground">DURC, assicurazione, HACCP, visura camerale, rating qualità. Avvisi automatici prima della scadenza.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        {[
          { k: "tutti", lbl: "Tutti", tone: "" },
          { k: "ok", lbl: "Conformi", tone: "text-success" },
          { k: "in_scadenza", lbl: "In scadenza", tone: "text-warning" },
          { k: "durc_scaduto", lbl: "DURC scaduto", tone: "text-destructive" },
          { k: "bloccato", lbl: "Bloccati", tone: "text-destructive" },
        ].map(c => (
          <button key={c.k} onClick={()=>setFilter(c.k)} className={`rounded-lg border p-3 text-left transition ${filter===c.k?"border-primary bg-primary/5":"border-border hover:bg-accent/30"}`}>
            <div className="text-xs text-muted-foreground">{c.lbl}</div>
            <div className={`font-display text-2xl font-bold ${c.tone}`}>{counts[c.k]??0}</div>
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <Input placeholder="Cerca fornitore, P.IVA, referente…" value={search} onChange={(e)=>setSearch(e.target.value)} className="max-w-sm"/>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Fornitore</th><th className="px-4 py-2">Categoria</th>
                <th className="px-4 py-2">DURC</th><th className="px-4 py-2">Assicur.</th>
                <th className="px-4 py-2">HACCP</th><th className="px-4 py-2">Visura</th>
                <th className="px-4 py-2">Rating</th><th className="px-4 py-2">Stato</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r:any)=>(
                <tr key={r.id} className="border-b border-border/60">
                  <td className="px-4 py-2"><div className="font-medium">{r.name}</div><div className="text-xs text-muted-foreground">{r.vat_number || "—"}</div></td>
                  <td className="px-4 py-2 text-xs">{r.category ?? "—"}</td>
                  <td className="px-4 py-2 text-xs">{fmtDate(r.durc_expiry)}</td>
                  <td className="px-4 py-2 text-xs">{fmtDate(r.insurance_expiry)}</td>
                  <td className="px-4 py-2 text-xs">{fmtDate(r.haccp_expiry)}</td>
                  <td className="px-4 py-2 text-xs">{fmtDate(r.visura_expiry)}</td>
                  <td className="px-4 py-2"><Stars n={r.rating ?? 0}/></td>
                  <td className="px-4 py-2"><StatusBadge s={r.compliance_status}/></td>
                  <td className="px-4 py-2 text-right space-x-1">
                    <Button size="sm" variant="outline" onClick={()=>setEditing(r)}>Modifica</Button>
                    <Button size="sm" variant={r.blocked?"default":"ghost"} onClick={()=>toggleBlock.mutate(r)}>
                      {r.blocked ? <><Unlock className="h-3 w-3 mr-1"/>Sblocca</> : <><Lock className="h-3 w-3 mr-1"/>Blocca</>}
                    </Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">Nessun fornitore.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o)=>!o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing?.name}</DialogTitle></DialogHeader>
          {editing && <EditForm row={editing} onSave={(p)=>update.mutate(p)} pending={update.isPending}/>}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EditForm({ row, onSave, pending }: { row:any; onSave:(p:any)=>void; pending:boolean }) {
  const [f, setF] = useState({
    durc_expiry: row.durc_expiry ?? "",
    insurance_expiry: row.insurance_expiry ?? "",
    haccp_expiry: row.haccp_expiry ?? "",
    visura_expiry: row.visura_expiry ?? "",
    rating: String(row.rating ?? ""),
    notes: row.notes ?? "",
  });
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1"><Label>DURC</Label><Input type="date" value={f.durc_expiry} onChange={(e)=>setF({...f,durc_expiry:e.target.value})}/></div>
        <div className="space-y-1"><Label>Assicurazione</Label><Input type="date" value={f.insurance_expiry} onChange={(e)=>setF({...f,insurance_expiry:e.target.value})}/></div>
        <div className="space-y-1"><Label>HACCP</Label><Input type="date" value={f.haccp_expiry} onChange={(e)=>setF({...f,haccp_expiry:e.target.value})}/></div>
        <div className="space-y-1"><Label>Visura camerale</Label><Input type="date" value={f.visura_expiry} onChange={(e)=>setF({...f,visura_expiry:e.target.value})}/></div>
      </div>
      <div className="space-y-1">
        <Label>Rating qualità</Label>
        <Select value={f.rating} onValueChange={(v)=>setF({...f,rating:v})}>
          <SelectTrigger><SelectValue placeholder="—"/></SelectTrigger>
          <SelectContent>{[1,2,3,4,5].map(n=><SelectItem key={n} value={String(n)}>{"★".repeat(n)} ({n})</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <Button disabled={pending} className="w-full" onClick={()=>onSave({
        durc_expiry: f.durc_expiry || null, insurance_expiry: f.insurance_expiry || null,
        haccp_expiry: f.haccp_expiry || null, visura_expiry: f.visura_expiry || null,
        rating: f.rating ? Number(f.rating) : null,
      })}>Salva</Button>
    </div>
  );
}

function Stars({ n }: { n: number }) {
  if (!n) return <span className="text-xs text-muted-foreground">—</span>;
  return <div className="flex">{Array.from({length:5}).map((_,i)=>(<Star key={i} className={`h-3 w-3 ${i<n?"fill-warning text-warning":"text-muted-foreground/30"}`}/>))}</div>;
}
function StatusBadge({ s }: { s: string }) {
  const c = STATUS_LABELS[s] ?? STATUS_LABELS.ok;
  return <Badge className={c.cls} variant="outline">{c.label}</Badge>;
}