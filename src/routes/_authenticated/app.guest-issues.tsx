import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveStructure } from "@/lib/structure-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { MessageSquare, ArrowRight, X, QrCode } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/app/guest-issues")({ component: Page });

function Page() {
  const qc = useQueryClient();
  const { activeStructureId } = useActiveStructure();
  const [qrOpen, setQrOpen] = useState<{ token: string; name: string } | null>(null);

  const { data: issues = [] } = useQuery({
    queryKey: ["guest_issues", activeStructureId],
    queryFn: async () => {
      if (!activeStructureId) return [];
      const { data, error } = await (supabase as any).from("guest_issues")
        .select("id,category,description,guest_name,guest_contact,status,created_at,rooms(name,qr_token)")
        .eq("structure_id", activeStructureId).order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!activeStructureId,
  });

  const { data: roomsNoQr = [] } = useQuery({
    queryKey: ["rooms_qr", activeStructureId],
    queryFn: async () => {
      if (!activeStructureId) return [];
      const { data, error } = await (supabase as any).from("rooms")
        .select("id,name,qr_token").eq("structure_id", activeStructureId).order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!activeStructureId,
  });

  const genQr = useMutation({
    mutationFn: async () => {
      const updates = roomsNoQr.filter((r: any) => !r.qr_token).map((r: any) => ({
        id: r.id, qr_token: crypto.randomUUID().replace(/-/g, ""),
      }));
      for (const u of updates) {
        await (supabase as any).from("rooms").update({ qr_token: u.qr_token }).eq("id", u.id);
      }
      return updates.length;
    },
    onSuccess: (n) => { toast.success(`Generati ${n} QR camera`); qc.invalidateQueries({ queryKey: ["rooms_qr"] }); qc.invalidateQueries({ queryKey: ["guest_issues"] }); },
  });

  const convertToTicket = useMutation({
    mutationFn: async (issue: any) => {
      const { data: ticket, error } = await (supabase as any).from("tickets").insert({
        structure_id: activeStructureId,
        title: `[Ospite] ${issue.description.slice(0, 80)}`,
        description: `Segnalazione da camera ${issue.rooms?.name ?? "?"}.\n${issue.guest_name ? `Ospite: ${issue.guest_name}` : ""}\n${issue.guest_contact ? `Contatto: ${issue.guest_contact}` : ""}\n\n${issue.description}`,
        priority: "media", status: "aperto", area: "camere",
      }).select("id").single();
      if (error) throw error;
      await (supabase as any).from("guest_issues").update({ status: "converted", ticket_id: ticket.id }).eq("id", issue.id);
    },
    onSuccess: () => { toast.success("Convertito in ticket"); qc.invalidateQueries({ queryKey: ["guest_issues"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const dismiss = useMutation({
    mutationFn: async (id: string) => { await (supabase as any).from("guest_issues").update({ status: "dismissed" }).eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["guest_issues"] }),
  });

  const missingQr = roomsNoQr.filter((r: any) => !r.qr_token).length;

  return (
    <div className="space-y-6 p-6">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-semibold flex items-center gap-2"><MessageSquare className="h-6 w-6"/>Segnalazioni ospiti</h1>
          <p className="text-sm text-muted-foreground">Richieste arrivate dai QR in camera. Convertili in ticket con un click.</p>
        </div>
        {missingQr > 0 && (
          <Button onClick={() => genQr.mutate()}><QrCode className="h-4 w-4 mr-2"/>Genera {missingQr} QR camere mancanti</Button>
        )}
      </header>

      <Card>
        <CardHeader><CardTitle>Inbox segnalazioni</CardTitle></CardHeader>
        <CardContent>
          {issues.length === 0 ? <p className="text-sm text-muted-foreground">Nessuna segnalazione. Stampa i QR delle camere dalla tabella sotto e attaccali nelle stanze.</p> :
            <div className="space-y-2">
              {issues.map((i: any) => (
                <div key={i.id} className="rounded-md border border-border/50 p-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">Camera {i.rooms?.name ?? "?"}</Badge>
                      <Badge variant="outline">{i.category}</Badge>
                      <Badge variant="outline" className={i.status === "new" ? "bg-sky-500/15 text-sky-500" : i.status === "converted" ? "bg-emerald-500/15 text-emerald-500" : ""}>{i.status}</Badge>
                      <span className="text-xs text-muted-foreground">{new Date(i.created_at).toLocaleString("it-IT")}</span>
                    </div>
                    {i.status === "new" && (
                      <div className="flex gap-1">
                        <Button size="sm" onClick={() => convertToTicket.mutate(i)}><ArrowRight className="h-3 w-3 mr-1"/>Crea ticket</Button>
                        <Button size="sm" variant="ghost" onClick={() => dismiss.mutate(i.id)}><X className="h-3 w-3"/></Button>
                      </div>
                    )}
                  </div>
                  <p className="mt-1 text-sm">{i.description}</p>
                  {(i.guest_name || i.guest_contact) && <p className="text-xs text-muted-foreground mt-1">{i.guest_name} {i.guest_contact && `· ${i.guest_contact}`}</p>}
                </div>
              ))}
            </div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>QR camere</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {roomsNoQr.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between rounded-md border border-border/50 p-2 text-sm">
                <span>Camera {r.name}</span>
                {r.qr_token ? (
                  <Button size="sm" variant="outline" onClick={() => setQrOpen({ token: r.qr_token, name: r.name })}><QrCode className="h-3 w-3 mr-1"/>Mostra</Button>
                ) : <Badge variant="outline">no QR</Badge>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!qrOpen} onOpenChange={(o) => !o && setQrOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>QR Camera {qrOpen?.name}</DialogTitle></DialogHeader>
          {qrOpen && (
            <div className="space-y-3 text-center">
              <img alt={`QR camera ${qrOpen.name}`} className="mx-auto rounded-md border bg-white p-2"
                src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(`${window.location.origin}/g/${qrOpen.token}`)}`} />
              <p className="text-xs text-muted-foreground break-all">{window.location.origin}/g/{qrOpen.token}</p>
              <Button onClick={() => window.print()}>Stampa</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}