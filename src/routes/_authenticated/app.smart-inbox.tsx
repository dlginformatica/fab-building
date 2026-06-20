import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveStructure } from "@/lib/structure-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Inbox, MessageSquare, Ticket, AlertTriangle, Bell } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/smart-inbox")({ component: Page });

function Page() {
  const { activeStructureId } = useActiveStructure();

  const { data: guests = [] } = useQuery({
    queryKey: ["si_guests", activeStructureId],
    enabled: !!activeStructureId,
    queryFn: async () => (await (supabase as any).from("guest_issues").select("id,category,description,status,created_at,rooms(name)").eq("structure_id", activeStructureId).eq("status", "new").order("created_at", { ascending: false }).limit(20)).data ?? [],
  });
  const { data: urgentTickets = [] } = useQuery({
    queryKey: ["si_tickets", activeStructureId],
    enabled: !!activeStructureId,
    queryFn: async () => (await (supabase as any).from("tickets").select("id,title,priority,status,resolve_due_at,created_at").eq("structure_id", activeStructureId).in("priority", ["critica","alta"]).not("status", "in", "(chiuso,annullato)").order("created_at", { ascending: false }).limit(20)).data ?? [],
  });
  const { data: convs = [] } = useQuery({
    queryKey: ["si_msg", activeStructureId],
    enabled: !!activeStructureId,
    queryFn: async () => (await (supabase as any).from("conversations").select("id,title,last_message_at").eq("structure_id", activeStructureId).order("last_message_at", { ascending: false, nullsFirst: false }).limit(10)).data ?? [],
  });
  const { data: alerts = [] } = useQuery({
    queryKey: ["si_alerts", activeStructureId],
    enabled: !!activeStructureId,
    queryFn: async () => (await (supabase as any).rpc("alerts_for_structure", { _structure: activeStructureId })).data ?? [],
    refetchInterval: 60_000,
  });

  const total = guests.length + urgentTickets.length + convs.length + alerts.length;

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="font-display text-2xl font-semibold flex items-center gap-2"><Inbox className="h-6 w-6"/>Smart Inbox</h1>
        <p className="text-sm text-muted-foreground">Tutto ciò che richiede la tua attenzione, in un solo posto. {total} elementi.</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Section icon={<Bell className="h-4 w-4"/>} title="Alert & Scadenze" tone="amber" count={alerts.length} href="/app/alerts">
          {alerts.slice(0, 8).map((a: any, i: number) => (
            <div key={`${a.ref_id}-${i}`} className="rounded-md border border-border/40 p-2 text-sm">
              <div className="flex justify-between">
                <Badge variant="outline" className={a.severity === "high" ? "bg-red-500/15 text-red-500" : "bg-amber-500/15 text-amber-500"}>{a.severity}</Badge>
                <span className="text-xs text-muted-foreground">{a.due_at ? new Date(a.due_at).toLocaleDateString("it-IT") : "—"}</span>
              </div>
              <p className="mt-1 font-medium line-clamp-1">{a.title}</p>
              <p className="text-xs text-muted-foreground line-clamp-1">{a.detail}</p>
            </div>
          ))}
          {alerts.length === 0 && <p className="text-xs text-muted-foreground">Nessun alert attivo</p>}
        </Section>

        <Section icon={<MessageSquare className="h-4 w-4"/>} title="Segnalazioni ospiti" tone="sky" count={guests.length} href="/app/guest-issues">
          {guests.map((g: any) => (
            <div key={g.id} className="rounded-md border border-border/40 p-2 text-sm">
              <div className="flex justify-between"><Badge variant="outline">Camera {g.rooms?.name}</Badge><span className="text-xs text-muted-foreground">{new Date(g.created_at).toLocaleDateString("it-IT")}</span></div>
              <p className="mt-1 line-clamp-2">{g.description}</p>
            </div>
          ))}
          {guests.length === 0 && <p className="text-xs text-muted-foreground">Nessuna nuova segnalazione</p>}
        </Section>

        <Section icon={<AlertTriangle className="h-4 w-4"/>} title="Ticket urgenti" tone="amber" count={urgentTickets.length} href="/app/tickets">
          {urgentTickets.map((t: any) => (
            <div key={t.id} className="rounded-md border border-border/40 p-2 text-sm">
              <div className="flex justify-between"><Badge variant="outline" className={t.priority === "critica" ? "bg-red-500/15 text-red-500" : "bg-amber-500/15 text-amber-500"}>{t.priority}</Badge>
                <span className="text-xs text-muted-foreground">{t.status}</span></div>
              <p className="mt-1 line-clamp-2 font-medium">{t.title}</p>
            </div>
          ))}
          {urgentTickets.length === 0 && <p className="text-xs text-muted-foreground">Nessun ticket urgente</p>}
        </Section>

        <Section icon={<Ticket className="h-4 w-4"/>} title="Conversazioni recenti" tone="emerald" count={convs.length} href="/app/messages">
          {convs.map((c: any) => (
            <div key={c.id} className="rounded-md border border-border/40 p-2 text-sm">
              <p className="font-medium line-clamp-1">{c.title ?? "Senza titolo"}</p>
              <p className="text-xs text-muted-foreground">{c.last_message_at ? new Date(c.last_message_at).toLocaleString("it-IT") : "—"}</p>
            </div>
          ))}
          {convs.length === 0 && <p className="text-xs text-muted-foreground">Nessuna conversazione</p>}
        </Section>
      </div>
    </div>
  );
}

function Section({ icon, title, tone, count, href, children }: any) {
  const cls = tone === "sky" ? "bg-sky-500/10 text-sky-500" : tone === "amber" ? "bg-amber-500/10 text-amber-500" : "bg-emerald-500/10 text-emerald-500";
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><span className={`grid h-7 w-7 place-items-center rounded-md ${cls}`}>{icon}</span>{title}</CardTitle>
          <Badge variant="outline">{count}</Badge>
        </div>
        <Link to={href} className="text-xs text-primary hover:underline">Vai →</Link>
      </CardHeader>
      <CardContent className="space-y-2 max-h-[480px] overflow-y-auto">{children}</CardContent>
    </Card>
  );
}