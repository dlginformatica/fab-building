import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Camera, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function Attachments({ ticketId }: { ticketId: string }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: items = [] } = useQuery({
    queryKey: ["ticket-attachments", ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_attachments")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const upload = useMutation({
    mutationFn: async (files: FileList) => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("Non autenticato");
      for (const f of Array.from(files)) {
        const path = `${ticketId}/${Date.now()}-${f.name}`;
        const { error: upErr } = await supabase.storage.from("tickets").upload(path, f, { upsert: false });
        if (upErr) throw upErr;
        const kind = f.type.startsWith("image/") ? "photo" : "document";
        const { error: insErr } = await supabase.from("ticket_attachments").insert({
          ticket_id: ticketId, uploaded_by: user.id, storage_path: path,
          file_name: f.name, mime_type: f.type, size_bytes: f.size, kind,
        });
        if (insErr) throw insErr;
      }
    },
    onSuccess: () => { toast.success("File caricati"); qc.invalidateQueries({ queryKey: ["ticket-attachments", ticketId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (a: { id: string; storage_path: string }) => {
      await supabase.storage.from("tickets").remove([a.storage_path]);
      const { error } = await supabase.from("ticket_attachments").delete().eq("id", a.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ticket-attachments", ticketId] }),
  });

  async function signedUrl(path: string) {
    const { data } = await supabase.storage.from("tickets").createSignedUrl(path, 3600);
    return data?.signedUrl;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="font-display text-base">Allegati & Foto</CardTitle>
        <div>
          <input ref={fileRef} type="file" multiple accept="image/*,application/pdf" className="hidden"
            onChange={(e) => e.target.files && e.target.files.length && upload.mutate(e.target.files)} />
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={upload.isPending}>
            {upload.isPending ? <Loader2 className="h-4 w-4 animate-spin"/> : <Camera className="h-4 w-4"/>}
            <span className="ml-1">Carica</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="text-center text-xs text-muted-foreground py-6">Nessun allegato.</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {items.map((a: any) => (
              <AttachThumb key={a.id} a={a} getUrl={signedUrl} onDelete={() => del.mutate(a)} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AttachThumb({ a, getUrl, onDelete }: { a: any; getUrl: (p:string)=>Promise<string|undefined>; onDelete: ()=>void }) {
  const { data: url } = useQuery({
    queryKey: ["att-url", a.id], queryFn: () => getUrl(a.storage_path),
  });
  const isImg = a.mime_type?.startsWith("image/");
  return (
    <div className="group relative rounded-md border overflow-hidden">
      {isImg && url ? (
        <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={a.file_name} className="aspect-square w-full object-cover"/></a>
      ) : (
        <a href={url} target="_blank" rel="noreferrer" className="grid aspect-square place-items-center text-xs text-muted-foreground p-2 text-center">{a.file_name}</a>
      )}
      <button onClick={onDelete} className="absolute top-1 right-1 rounded-full bg-background/80 p-1 opacity-0 group-hover:opacity-100">
        <Trash2 className="h-3 w-3"/>
      </button>
    </div>
  );
}