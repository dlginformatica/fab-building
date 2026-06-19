import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Paperclip, Trash2, Upload, Clock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/reorders/$id")({ component: Page });

const KINDS = ["ordine","ddt","fattura","altro"] as const;

function Page() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [file, setFile] = useState<File|null>(null);
  const [kind, setKind] = useState<string>("ordine");

  const { data: r } = useQuery({
    queryKey: ["reorder", id],
    queryFn: async () => (await supabase.from("reorder_requests").select("*, inventory_items(name,sku,unit), suppliers(name)").eq("id", id).single()).data,
  });
  const { data: events = [] } = useQuery({
    queryKey: ["reorder_events", id],
    queryFn: async () => (await (supabase as any).from("reorder_events").select("*").eq("reorder_id", id).order("created_at",{ascending:true})).data ?? [],
  });
  const { data: atts = [] } = useQuery({
    queryKey: ["reorder_atts", id],
    queryFn: async () => (await (supabase as any).from("reorder_attachments").select("*").eq("reorder_id", id).order("created_at",{ascending:false})).data ?? [],
  });

  const upload = useMutation({
    mutationFn: async () => {
      if (!file || !r) return;
      const user = (await supabase.auth.getUser()).data.user;
      const path = `${r.structure_id}/${id}/${Date.now()}-${file.name}`;
      const up = await supabase.storage.from("reorders").upload(path, file, { upsert: false });
      if (up.error) throw up.error;
      const { error } = await (supabase as any).from("reorder_attachments").insert({
        reorder_id: id, structure_id: r.structure_id, kind, file_path: path, file_name: file.name, mime_type: file.type, uploaded_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Allegato caricato"); setFile(null); qc.invalidateQueries({ queryKey: ["reorder_atts", id] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (a: any) => {
      await supabase.storage.from("reorders").remove([a.file_path]);
      const { error } = await (supabase as any).from("reorder_attachments").delete().eq("id", a.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reorder_atts", id] }),
  });

  const downloadAtt = async (a: any) => {
    const { data, error } = await supabase.storage.from("reorders").createSignedUrl(a.file_path, 300);
    if (error || !data) { toast.error("Errore download"); return; }
    window.open(data.signedUrl, "_blank");
  };

  if (!r) return <div className="text-sm text-muted-foreground">Caricamento…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild><Link to="/app/reorders"><ArrowLeft className="mr-1 h-4 w-4"/>Riordini</Link></Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl">{(r as any).inventory_items?.name ?? "Articolo"}</CardTitle>
          <div className="text-xs text-muted-foreground">SKU {(r as any).inventory_items?.sku ?? "—"} · Fornitore {(r as any).suppliers?.name ?? "—"}</div>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          <div>Quantità: <span className="font-mono">{(r as any).quantity} {(r as any).inventory_items?.unit ?? ""}</span></div>
          <div>Stato attuale: <Badge variant="outline">{(r as any).status}</Badge></div>
          {(r as any).notes && <div>Note: {(r as any).notes}</div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="font-display text-base flex items-center gap-2"><Clock className="h-4 w-4"/>Timeline cambi di stato</CardTitle></CardHeader>
        <CardContent>
          <ol className="relative border-l border-border pl-4 space-y-3">
            {(events as any[]).map(ev => (
              <li key={ev.id} className="relative">
                <div className="absolute -left-[19px] top-1.5 h-2 w-2 rounded-full bg-primary"/>
                <div className="text-sm">
                  <span className="font-medium">{ev.from_status ? `${ev.from_status} → ${ev.to_status}` : ev.to_status}</span>
                  {ev.note && <span className="ml-2 text-muted-foreground">· {ev.note}</span>}
                </div>
                <div className="text-xs text-muted-foreground">{new Date(ev.created_at).toLocaleString("it-IT")}</div>
              </li>
            ))}
            {events.length === 0 && <li className="text-sm text-muted-foreground">Nessun evento.</li>}
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="font-display text-base flex items-center gap-2"><Paperclip className="h-4 w-4"/>Allegati</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1"><Label>Tipo</Label>
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger className="w-40"><SelectValue/></SelectTrigger>
                <SelectContent>{KINDS.map(k=><SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>File</Label><Input type="file" onChange={(e)=>setFile(e.target.files?.[0] ?? null)}/></div>
            <Button disabled={!file || upload.isPending} onClick={()=>upload.mutate()}><Upload className="mr-1 h-4 w-4"/>Carica</Button>
          </div>
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <tr><th className="px-3 py-2">Tipo</th><th className="px-3 py-2">File</th><th className="px-3 py-2">Caricato</th><th></th></tr>
            </thead>
            <tbody>
              {(atts as any[]).map(a => (
                <tr key={a.id} className="border-b border-border/60">
                  <td className="px-3 py-2"><Badge variant="outline">{a.kind}</Badge></td>
                  <td className="px-3 py-2"><button className="underline" onClick={()=>downloadAtt(a)}>{a.file_name}</button></td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString("it-IT")}</td>
                  <td className="px-3 py-2 text-right"><Button size="icon" variant="ghost" onClick={()=>remove.mutate(a)}><Trash2 className="h-4 w-4"/></Button></td>
                </tr>
              ))}
              {atts.length === 0 && <tr><td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">Nessun allegato.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}