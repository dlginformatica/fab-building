import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FileText, Upload, Trash2, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { fmtDate, fmtDateTime } from "@/lib/format";

const CATEGORIES = ["libretto","certificazione","manuale","garanzia","collaudo","schema","dichiarazione_conformita","verbale_ispezione","altro"] as const;

export function AssetDocuments({ assetId, structureId }: { assetId: string; structureId: string | null }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [meta, setMeta] = useState<{ category: string; title: string; description: string; issued_at: string; expires_at: string }>({
    category: "libretto", title: "", description: "", issued_at: "", expires_at: "",
  });

  const { data: docs = [] } = useQuery({
    queryKey: ["asset_documents", assetId],
    queryFn: async () => (await (supabase as any).from("asset_documents").select("*, profiles:uploaded_by(full_name,email)").eq("asset_id", assetId).order("created_at",{ascending:false})).data ?? [],
  });

  const upload = useMutation({
    mutationFn: async (f: File) => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("Non autenticato");
      if (!structureId) throw new Error("Asset senza struttura");
      if (!meta.title.trim()) throw new Error("Titolo richiesto");
      const path = `${structureId}/${assetId}/${Date.now()}-${f.name}`;
      const { error: upErr } = await supabase.storage.from("asset-docs").upload(path, f, { upsert: false });
      if (upErr) throw upErr;
      const { error } = await (supabase as any).from("asset_documents").insert({
        asset_id: assetId, structure_id: structureId, uploaded_by: user.id,
        category: meta.category, title: meta.title, description: meta.description || null,
        file_path: path, mime: f.type, file_size_kb: Math.round(f.size/1024),
        issued_at: meta.issued_at || null, expires_at: meta.expires_at || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Documento caricato");
      qc.invalidateQueries({ queryKey: ["asset_documents", assetId] });
      setMeta({ category: "libretto", title: "", description: "", issued_at: "", expires_at: "" });
      if (fileRef.current) fileRef.current.value = "";
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (d: any) => {
      await supabase.storage.from("asset-docs").remove([d.file_path]);
      const { error } = await (supabase as any).from("asset_documents").delete().eq("id", d.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["asset_documents", assetId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  async function openDoc(path: string) {
    const { data } = await supabase.storage.from("asset-docs").createSignedUrl(path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-base flex items-center gap-2"><FileText className="h-4 w-4"/>Documentazione impianto</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 md:grid-cols-6 rounded-md border border-dashed border-border p-3">
          <div className="space-y-1 md:col-span-2"><Label className="text-xs">Titolo *</Label><Input value={meta.title} onChange={(e)=>setMeta({...meta,title:e.target.value})} placeholder="Es. Libretto caldaia 2026"/></div>
          <div className="space-y-1"><Label className="text-xs">Categoria</Label>
            <Select value={meta.category} onValueChange={(v)=>setMeta({...meta,category:v})}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>{CATEGORIES.map(c=><SelectItem key={c} value={c}>{c.replace(/_/g," ")}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label className="text-xs">Emesso il</Label><Input type="date" value={meta.issued_at} onChange={(e)=>setMeta({...meta,issued_at:e.target.value})}/></div>
          <div className="space-y-1"><Label className="text-xs">Scade il</Label><Input type="date" value={meta.expires_at} onChange={(e)=>setMeta({...meta,expires_at:e.target.value})}/></div>
          <div className="space-y-1 flex items-end">
            <input ref={fileRef} type="file" className="hidden" onChange={(e)=>e.target.files?.[0] && upload.mutate(e.target.files[0])}/>
            <Button className="w-full" disabled={upload.isPending || !meta.title.trim()} onClick={()=>fileRef.current?.click()}>
              {upload.isPending ? <Loader2 className="h-4 w-4 animate-spin"/> : <Upload className="h-4 w-4 mr-1"/>}Carica
            </Button>
          </div>
          <div className="md:col-span-6 space-y-1"><Label className="text-xs">Descrizione (opz.)</Label><Input value={meta.description} onChange={(e)=>setMeta({...meta,description:e.target.value})}/></div>
        </div>

        {docs.length === 0 ? (
          <div className="text-center text-xs text-muted-foreground py-6">Nessun documento.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <tr><th className="py-2">Titolo</th><th>Categoria</th><th>Emesso</th><th>Scade</th><th>Caricato</th><th></th></tr>
              </thead>
              <tbody>
                {docs.map((d:any) => {
                  const expired = d.expires_at && new Date(d.expires_at) < new Date();
                  const expSoon = d.expires_at && !expired && new Date(d.expires_at) < new Date(Date.now()+30*86400000);
                  return (
                    <tr key={d.id} className="border-b border-border/60">
                      <td className="py-2"><button onClick={()=>openDoc(d.file_path)} className="text-primary hover:underline text-left">{d.title}</button>
                        {d.description && <div className="text-xs text-muted-foreground">{d.description}</div>}</td>
                      <td><Badge variant="outline">{d.category}</Badge></td>
                      <td className="text-xs">{fmtDate(d.issued_at)}</td>
                      <td className="text-xs">
                        {d.expires_at ? (
                          <span className={expired ? "text-destructive font-semibold" : expSoon ? "text-warning" : ""}>{fmtDate(d.expires_at)}</span>
                        ) : "—"}
                      </td>
                      <td className="text-xs text-muted-foreground">{d.profiles?.full_name ?? d.profiles?.email ?? "—"}<br/>{fmtDateTime(d.created_at)}</td>
                      <td className="text-right">
                        <Button size="icon" variant="ghost" onClick={()=>openDoc(d.file_path)}><Download className="h-4 w-4"/></Button>
                        <Button size="icon" variant="ghost" onClick={()=>del.mutate(d)}><Trash2 className="h-4 w-4"/></Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}