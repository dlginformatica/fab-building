import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Clock } from "lucide-react";
import { fmtDateTime, timeUntil } from "@/lib/format";
import { PriorityBadge, StatusBadge } from "./app.index";
import { STATUSES } from "./app.tickets.index";
import { toast } from "sonner";
import { useSpeaker } from "@/components/tts/SpeakerProvider";
import { Attachments } from "@/components/tickets/Attachments";
import { Videocall } from "@/components/tickets/Videocall";
import { InterventionReport } from "@/components/tickets/InterventionReport";

export const Route = createFileRoute("/_authenticated/app/tickets/$id")({ component: Page });

function Page() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { speak } = useSpeaker();
  const [comment, setComment] = useState("");

  const { data: t } = useQuery({
    queryKey: ["ticket", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("tickets")
        .select("*, assets(name,code), asset_categories(name), rooms(name), reporter:reported_by(full_name,email), assignee:assigned_to(full_name,email)")
        .eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });
  const { data: comments } = useQuery({
    queryKey: ["ticket-comments", id],
    queryFn: async () => (await supabase.from("ticket_comments").select("*, profiles:author_id(full_name,email)").eq("ticket_id", id).order("created_at")).data ?? [],
  });

  const updateStatus = useMutation({
    mutationFn: async (status: string) => {
      const patch: {
        status: typeof status;
        ack_at?: string;
        resolved_at?: string;
        closed_at?: string;
      } = { status };
      if (status === "in_corso" && !t?.ack_at) patch.ack_at = new Date().toISOString();
      if (status === "risolto" && !t?.resolved_at) patch.resolved_at = new Date().toISOString();
      if (status === "chiuso" && !t?.closed_at) patch.closed_at = new Date().toISOString();
      const { error } = await supabase.from("tickets").update(patch as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ticket", id] }); qc.invalidateQueries({ queryKey: ["tickets"] }); toast.success("Stato aggiornato"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const addComment = useMutation({
    mutationFn: async () => {
      const user = (await supabase.auth.getUser()).data.user;
      const { error } = await supabase.from("ticket_comments").insert({ ticket_id: id, author_id: user?.id, body: comment });
      if (error) throw error;
    },
    onSuccess: () => { setComment(""); qc.invalidateQueries({ queryKey: ["ticket-comments", id] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!t) return <div className="text-sm text-muted-foreground">Caricamento…</div>;
  const ack = timeUntil(t.ack_due_at);
  const res = timeUntil(t.resolve_due_at);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild><Link to="/app/tickets"><ArrowLeft className="mr-1 h-4 w-4" />Ticket</Link></Button>
        <Button variant="outline" size="sm" onClick={() => speak(`Ticket numero ${t.ticket_number}. Priorità ${t.priority}. ${t.title}. ${t.description ?? ""}`)}>🔊 Leggi</Button>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-muted-foreground">#{t.ticket_number}</span>
                <PriorityBadge p={t.priority} />
                <StatusBadge s={t.status} />
              </div>
              <CardTitle className="font-display text-2xl">{t.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="whitespace-pre-wrap">{t.description || "Nessuna descrizione."}</p>
              <div className="grid grid-cols-2 gap-2 pt-3 text-xs text-muted-foreground">
                <div>Asset: <b className="text-foreground">{t.assets?.name ?? "—"}</b></div>
                <div>Categoria: <b className="text-foreground">{t.asset_categories?.name ?? "—"}</b></div>
                <div>Stanza: <b className="text-foreground">{t.rooms?.name ?? "—"}</b></div>
                <div>Creato: <b className="text-foreground">{fmtDateTime(t.created_at)}</b></div>
                <div>Reporter: <b className="text-foreground">{(t as { reporter?: { full_name?: string; email?: string } }).reporter?.full_name ?? "—"}</b></div>
                <div>Assegnato: <b className="text-foreground">{(t as { assignee?: { full_name?: string; email?: string } }).assignee?.full_name ?? "—"}</b></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="font-display text-base">Timeline</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {(comments ?? []).map((c) => (
                <div key={c.id} className="rounded-md border border-border bg-card/60 p-3 text-sm">
                  <div className="mb-1 text-xs text-muted-foreground">{(c as { profiles?: { full_name?: string; email?: string } }).profiles?.full_name ?? "—"} · {fmtDateTime(c.created_at)}</div>
                  <div className="whitespace-pre-wrap">{c.body}</div>
                </div>
              ))}
              <div className="space-y-2">
                <Textarea rows={3} placeholder="Aggiungi un commento…" value={comment} onChange={(e) => setComment(e.target.value)} />
                <Button disabled={!comment.trim() || addComment.isPending} onClick={() => addComment.mutate()}>Pubblica</Button>
              </div>
            </CardContent>
          </Card>
          <Attachments ticketId={id} />
          <InterventionReport ticketId={id} />
          {t.structure_id && <Videocall ticketId={id} structureId={t.structure_id} />}
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="font-display text-base">SLA</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <SlaRow label="Presa in carico" v={ack} due={t.ack_due_at} />
              <SlaRow label="Risoluzione" v={res} due={t.resolve_due_at} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="font-display text-base">Azioni</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Select value={t.status} onValueChange={(v) => updateStatus.mutate(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace("_"," ")}</SelectItem>)}</SelectContent>
              </Select>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SlaRow({ label, v, due }: { label: string; v: ReturnType<typeof timeUntil>; due: string | null }) {
  const cls = v.status === "violated" ? "text-destructive" : v.status === "warn" ? "text-warning" : "text-success";
  return (
    <div className="flex items-center justify-between">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`flex items-center gap-2 text-sm ${cls}`}><Clock className="h-3 w-3" /><span>{v.label}</span><span className="text-[10px] text-muted-foreground">{due ? fmtDateTime(due) : ""}</span></div>
    </div>
  );
}