import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveStructure } from "@/lib/structure-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Clock, Ticket as TicketIcon, Wrench } from "lucide-react";
import { fmtDateTime, timeUntil } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/app/")({
  component: Dashboard,
});

function Dashboard() {
  const { activeStructureId } = useActiveStructure();
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", activeStructureId],
    enabled: !!activeStructureId,
    queryFn: async () => {
      const sid = activeStructureId!;
      const [tk, ast, open, crit] = await Promise.all([
        supabase.from("tickets").select("id,status,resolve_due_at,resolved_at,priority").eq("structure_id", sid),
        supabase.from("assets").select("id", { count: "exact", head: true }).eq("structure_id", sid),
        supabase.from("tickets").select("id", { count: "exact", head: true }).eq("structure_id", sid).in("status", ["aperto","assegnato","in_corso"]),
        supabase.from("tickets").select("id", { count: "exact", head: true }).eq("structure_id", sid).eq("priority","critica").in("status", ["aperto","assegnato","in_corso"]),
      ]);
      const tickets = tk.data ?? [];
      const closed = tickets.filter((t) => t.resolved_at);
      const inSLA = closed.filter((t) => t.resolve_due_at && new Date(t.resolved_at!) <= new Date(t.resolve_due_at!)).length;
      return {
        assetsCount: ast.count ?? 0,
        openCount: open.count ?? 0,
        criticalCount: crit.count ?? 0,
        slaPct: closed.length ? Math.round((inSLA / closed.length) * 100) : null,
      };
    },
  });

  const { data: recent } = useQuery({
    queryKey: ["dashboard-recent", activeStructureId],
    enabled: !!activeStructureId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("id,ticket_number,title,priority,status,resolve_due_at,created_at")
        .eq("structure_id", activeStructureId!)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (!activeStructureId) {
    return <EmptyStructure />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Stato facility della struttura attiva.</p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard icon={<Wrench className="h-4 w-4" />} label="Asset censiti" value={stats?.assetsCount ?? "—"} />
        <StatCard icon={<TicketIcon className="h-4 w-4" />} label="Ticket aperti" value={stats?.openCount ?? "—"} />
        <StatCard icon={<AlertTriangle className="h-4 w-4 text-destructive" />} label="Ticket critici" value={stats?.criticalCount ?? "—"} accent />
        <StatCard icon={<CheckCircle2 className="h-4 w-4 text-success" />} label="Rispetto SLA" value={stats?.slaPct == null ? "—" : `${stats.slaPct}%`} />
      </div>
      <Card>
        <CardHeader><CardTitle className="font-display text-base">Ticket recenti</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2">#</th>
                <th className="px-4 py-2">Titolo</th>
                <th className="px-4 py-2">Priorità</th>
                <th className="px-4 py-2">Stato</th>
                <th className="px-4 py-2">SLA risolvi</th>
                <th className="px-4 py-2">Creato</th>
              </tr>
            </thead>
            <tbody>
              {(recent ?? []).map((t) => {
                const sla = timeUntil(t.resolve_due_at);
                return (
                  <tr key={t.id} className="border-b border-border/60 hover:bg-accent/40">
                    <td className="px-4 py-2 font-mono text-xs">#{t.ticket_number}</td>
                    <td className="px-4 py-2"><Link to="/app/tickets/$id" params={{ id: t.id }} className="hover:underline">{t.title}</Link></td>
                    <td className="px-4 py-2"><PriorityBadge p={t.priority} /></td>
                    <td className="px-4 py-2"><StatusBadge s={t.status} /></td>
                    <td className="px-4 py-2"><span className={sla.status === "violated" ? "text-destructive" : sla.status === "warn" ? "text-warning" : "text-success"}><Clock className="mr-1 inline h-3 w-3" />{sla.label}</span></td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{fmtDateTime(t.created_at)}</td>
                  </tr>
                );
              })}
              {(!recent || recent.length === 0) && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-sm text-muted-foreground">Nessun ticket.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <Card className={accent ? "border-destructive/40" : ""}>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">{icon}{label}</div>
        <div className="mt-2 font-display text-3xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

export function PriorityBadge({ p }: { p: string }) {
  const map: Record<string, string> = {
    bassa: "bg-muted text-muted-foreground",
    media: "bg-info/20 text-info",
    alta: "bg-warning/20 text-warning",
    critica: "bg-destructive/20 text-destructive",
  };
  return <Badge className={`${map[p] ?? ""} border-transparent`} variant="outline">{p}</Badge>;
}
export function StatusBadge({ s }: { s: string }) {
  const map: Record<string, string> = {
    aperto: "bg-info/20 text-info",
    assegnato: "bg-accent text-accent-foreground",
    in_corso: "bg-warning/20 text-warning",
    sospeso: "bg-muted text-muted-foreground",
    risolto: "bg-success/20 text-success",
    chiuso: "bg-muted text-muted-foreground",
    annullato: "bg-muted text-muted-foreground",
  };
  return <Badge className={`${map[s] ?? ""} border-transparent`} variant="outline">{s.replace("_"," ")}</Badge>;
}

function EmptyStructure() {
  return (
    <div className="grid h-[60vh] place-items-center">
      <Card className="max-w-md">
        <CardHeader><CardTitle className="font-display">Benvenuto in HotelOps</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Per iniziare, crea la tua prima struttura e assegnati il ruolo super_admin. Vai a <Link to="/app/structures" className="text-primary underline">Strutture</Link> e poi a <Link to="/app/users" className="text-primary underline">Utenti & Ruoli</Link>.</p>
        </CardContent>
      </Card>
    </div>
  );
}