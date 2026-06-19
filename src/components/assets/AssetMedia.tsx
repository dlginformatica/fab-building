import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Camera, Video, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { fmtDateTime } from "@/lib/format";

export function AssetMedia({ assetId, structureId }: { assetId: string; structureId: string | null }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [caption, setCaption] = useState("");

  const { data: items = [] } = useQuery({
    queryKey: ["asset_media", assetId],
    queryFn: async () => (await (supabase as any).from("asset_media").select("*").eq("asset_id", assetId).order("created_at",{ascending:false})).data ?? [],
  });

  const upload = useMutation({
    mutationFn: async (files: FileList) => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("Non autenticato");
      if (!structureId) throw new Error("Asset senza struttura");
      for (const f of Array.from(files)) {
        const isVideo = f.type.startsWith("video/");
        const isImage = f.type.startsWith("image/");
        if (!isVideo && !isImage) { toast.error(`Formato non supportato: ${f.name}`); continue; }
        const path = `${structureId}/${assetId}/${Date.now()}-${f.name}`;
        const { error: upErr } = await supabase.storage.from("asset-media").upload(path, f, { upsert: false });
        if (upErr) throw upErr;
        const { error } = await (supabase as any).from("asset_media").insert({
          asset_id: assetId, structure_id: structureId, uploaded_by: user.id,
          kind: isVideo ? "video" : "image", caption: caption || null, file_path: path,
          mime: f.type, file_size_kb: Math.round(f.size/1024), taken_at: new Date().toISOString(),
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Media caricati");
      setCaption("");
      if (fileRef.current) fileRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["asset_media", assetId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (m: any) => {
      await supabase.storage.from("asset-media").remove([m.file_path]);
      const { error } = await (supabase as any).from("asset_media").delete().eq("id", m.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["asset_media", assetId] }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-base flex items-center gap-2"><Camera className="h-4 w-4"/>Foto & video impianto</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <Input placeholder="Didascalia (opz.)" value={caption} onChange={(e)=>setCaption(e.target.value)} className="flex-1"/>
          <input ref={fileRef} type="file" multiple accept="image/*,video/*" className="hidden"
            onChange={(e)=>e.target.files && e.target.files.length && upload.mutate(e.target.files)}/>
          <Button onClick={()=>fileRef.current?.click()} disabled={upload.isPending}>
            {upload.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1"/> : <Camera className="h-4 w-4 mr-1"/>}Carica foto/video
          </Button>
        </div>
        {items.length === 0 ? (
          <div className="text-center text-xs text-muted-foreground py-6">Nessun media.</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {items.map((m:any) => <MediaThumb key={m.id} m={m} onDelete={()=>del.mutate(m)} />)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MediaThumb({ m, onDelete }: { m: any; onDelete: ()=>void }) {
  const { data: url } = useQuery({
    queryKey: ["media-url", m.id],
    queryFn: async () => (await supabase.storage.from("asset-media").createSignedUrl(m.file_path, 3600)).data?.signedUrl,
  });
  return (
    <div className="group relative rounded-md border border-border overflow-hidden bg-card/40">
      {m.kind === "video" ? (
        url && <video src={url} controls className="aspect-video w-full object-cover"/>
      ) : (
        url && <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={m.caption||""} className="aspect-square w-full object-cover"/></a>
      )}
      <div className="p-2 text-xs">
        <div className="flex items-center gap-1 text-muted-foreground">
          {m.kind === "video" ? <Video className="h-3 w-3"/> : <Camera className="h-3 w-3"/>}
          {fmtDateTime(m.taken_at ?? m.created_at)}
        </div>
        {m.caption && <div className="truncate">{m.caption}</div>}
      </div>
      <button onClick={onDelete} className="absolute top-1 right-1 rounded-full bg-background/80 p-1 opacity-0 group-hover:opacity-100">
        <Trash2 className="h-3 w-3"/>
      </button>
    </div>
  );
}