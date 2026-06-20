import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Send, CheckCircle2, BedDouble } from "lucide-react";

export const Route = createFileRoute("/g/$qr")({
  ssr: false,
  component: GuestPage,
  head: () => ({ meta: [{ title: "Segnala un problema · HotelOps" }] }),
});

function GuestPage() {
  const { qr } = Route.useParams();
  const [sent, setSent] = useState(false);
  const [category, setCategory] = useState("manutenzione");
  const [description, setDescription] = useState("");
  const [guestName, setGuestName] = useState("");
  const [contact, setContact] = useState("");

  const { data: room, isLoading } = useQuery({
    queryKey: ["room_qr", qr],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("room_by_qr", { _token: qr });
      if (error) throw error;
      return Array.isArray(data) ? data[0] : data;
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!room?.structure_id) throw new Error("Camera non trovata");
      if (!description.trim()) throw new Error("Scrivi una breve descrizione");
      const { error } = await (supabase as any).from("guest_issues").insert({
        structure_id: room.structure_id,
        room_id: room.room_id,
        category, description: description.trim(),
        guest_name: guestName.trim() || null,
        guest_contact: contact.trim() || null,
        source: "qr",
      });
      if (error) throw error;
    },
    onSuccess: () => { setSent(true); toast.success("Segnalazione inviata"); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Caricamento…</div>;
  if (!room) return (
    <div className="min-h-screen grid place-items-center p-6 bg-gradient-to-b from-background to-muted/30">
      <Card className="max-w-sm w-full"><CardContent className="p-6 text-center space-y-2">
        <BedDouble className="h-10 w-10 mx-auto text-muted-foreground"/>
        <p className="font-semibold">QR non valido</p>
        <p className="text-sm text-muted-foreground">Chiedi assistenza alla reception.</p>
      </CardContent></Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 p-4">
      <div className="mx-auto max-w-md">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BedDouble className="h-5 w-5"/>{room.structure_name}</CardTitle>
            <p className="text-sm text-muted-foreground">Camera <b>{room.room_name}</b> — Segnala un problema o una richiesta.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {sent ? (
              <div className="text-center space-y-3 py-6">
                <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-500"/>
                <p className="font-semibold">Grazie!</p>
                <p className="text-sm text-muted-foreground">La tua segnalazione è arrivata alla reception. Ci occupiamo subito di te.</p>
                <Button variant="outline" onClick={() => { setSent(false); setDescription(""); }}>Invia un'altra segnalazione</Button>
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <Label>Cosa è successo?</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manutenzione">🔧 Guasto / manutenzione</SelectItem>
                      <SelectItem value="pulizia">🧹 Pulizia / housekeeping</SelectItem>
                      <SelectItem value="comfort">🌡️ Temperatura / comfort</SelectItem>
                      <SelectItem value="amenities">🛁 Amenities mancanti</SelectItem>
                      <SelectItem value="rumore">🔇 Rumore</SelectItem>
                      <SelectItem value="altro">💬 Altro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Descrizione *</Label>
                  <Textarea rows={3} placeholder="Es. il rubinetto del bagno perde…" value={description} onChange={(e)=>setDescription(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1"><Label>Nome (opzionale)</Label><Input value={guestName} onChange={(e)=>setGuestName(e.target.value)}/></div>
                  <div className="space-y-1"><Label>Telefono (opzionale)</Label><Input value={contact} onChange={(e)=>setContact(e.target.value)}/></div>
                </div>
                <Button className="w-full" size="lg" disabled={submit.isPending || !description.trim()} onClick={() => submit.mutate()}>
                  <Send className="h-4 w-4 mr-2"/>{submit.isPending ? "Invio…" : "Invia segnalazione"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
        <p className="mt-3 text-center text-xs text-muted-foreground">HotelOps · privacy garantita</p>
      </div>
    </div>
  );
}