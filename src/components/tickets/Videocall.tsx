import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Video, PhoneOff } from "lucide-react";
import { toast } from "sonner";

export function Videocall({ ticketId, structureId }: { ticketId: string; structureId: string }) {
  const qc = useQueryClient();
  const [active, setActive] = useState<string | null>(null);

  const { data: rooms = [] } = useQuery({
    queryKey: ["vc-rooms", ticketId],
    queryFn: async () => (await supabase.from("videocall_rooms").select("*").eq("ticket_id", ticketId).is("ended_at", null).order("started_at", { ascending: false })).data ?? [],
  });

  const start = useMutation({
    mutationFn: async () => {
      const user = (await supabase.auth.getUser()).data.user;
      const room_name = `hotelops-${ticketId.slice(0,8)}-${Date.now().toString(36)}`;
      const { data, error } = await supabase.from("videocall_rooms").insert({
        ticket_id: ticketId, structure_id: structureId, room_name, topic: `Ticket ${ticketId.slice(0,8)}`,
        created_by: user?.id ?? null,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (r:any) => { setActive(r.room_name); qc.invalidateQueries({queryKey:["vc-rooms",ticketId]}); },
    onError: (e:Error) => toast.error(e.message),
  });

  const end = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("videocall_rooms").update({ ended_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { setActive(null); qc.invalidateQueries({queryKey:["vc-rooms",ticketId]}); },
  });

  const liveRoom = active ?? (rooms[0] as any)?.room_name;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="font-display text-base flex items-center gap-2"><Video className="h-4 w-4"/>Videocall</CardTitle>
        {!liveRoom ? (
          <Button size="sm" onClick={() => start.mutate()} disabled={start.isPending}>Avvia stanza</Button>
        ) : (
          <Button size="sm" variant="destructive" onClick={() => { const r:any = rooms[0]; if (r) end.mutate(r.id); else setActive(null); }}>
            <PhoneOff className="h-4 w-4 mr-1"/>Termina
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {liveRoom ? (
          <div className="aspect-video w-full overflow-hidden rounded-md border">
            <iframe
              title="Videocall"
              allow="camera; microphone; fullscreen; display-capture; autoplay"
              src={`https://meet.jit.si/${liveRoom}#config.prejoinPageEnabled=false`}
              className="h-full w-full"
            />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Nessuna stanza attiva. Avvia per condividere il link con fornitori o tecnici.</p>
        )}
        {liveRoom && (
          <p className="mt-2 text-[11px] text-muted-foreground break-all">Link condivisibile: <a className="text-primary underline" href={`https://meet.jit.si/${liveRoom}`} target="_blank" rel="noreferrer">{`https://meet.jit.si/${liveRoom}`}</a></p>
        )}
      </CardContent>
    </Card>
  );
}