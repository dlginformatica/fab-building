import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Bell } from "lucide-react";
import { fmtDateTime } from "@/lib/format";
import { useActiveStructure } from "@/lib/structure-context";
import { useQueryClient } from "@tanstack/react-query";

const LABEL: Record<string,{txt:string;tone:string}> = {
  warning_ack: { txt:"SLA presa in carico in scadenza", tone:"text-warning" },
  warning_resolve: { txt:"SLA risoluzione in scadenza", tone:"text-warning" },
  violated_ack: { txt:"SLA presa in carico VIOLATO", tone:"text-destructive" },
  violated_resolve: { txt:"SLA risoluzione VIOLATO", tone:"text-destructive" },
};

export function NotificationsBell() {
  const { activeStructureId } = useActiveStructure();
  const qc = useQueryClient();
  const { data: notifs = [] } = useQuery({
    queryKey: ["sla_notifications", activeStructureId],
    queryFn: async () => {
      let q = (supabase as any).from("sla_notifications").select("*, tickets(ticket_number,title,priority)").is("acknowledged_at", null).order("created_at",{ascending:false}).limit(20);
      if (activeStructureId) q = q.eq("structure_id", activeStructureId);
      return (await q).data ?? [];
    },
    refetchInterval: 60_000,
  });

  useEffect(() => {
    const ch = supabase.channel("sla_notifications_realtime")
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"sla_notifications" }, () => {
        qc.invalidateQueries({ queryKey: ["sla_notifications"] });
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const count = notifs.length;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <Bell className={`h-4 w-4 ${count?"text-warning":""}`}/>
          {count>0 && <span className="absolute -top-1 -right-1 grid h-4 min-w-[16px] place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">{count}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0">
        <div className="border-b border-border px-3 py-2 flex items-center justify-between">
          <div className="font-display text-sm font-semibold">Notifiche SLA</div>
          <Link to="/app/sla-notifications" className="text-xs text-primary hover:underline">Storico completo →</Link>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {notifs.length === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-muted-foreground">Nessuna notifica attiva.</div>
          ) : notifs.map((n:any) => {
            const l = LABEL[n.kind] ?? { txt: n.kind, tone: "" };
            return (
              <Link key={n.id} to="/app/tickets/$id" params={{ id: n.ticket_id }} className="block border-b border-border/60 px-3 py-2 text-xs hover:bg-accent/30">
                <div className={`font-semibold ${l.tone}`}>{l.txt}</div>
                <div className="text-muted-foreground">#{n.tickets?.ticket_number} · {n.tickets?.title}</div>
                {n.delay_minutes != null && <div className="text-destructive">Ritardo: {n.delay_minutes} min</div>}
                {n.due_at && <div className="text-muted-foreground">Scadenza: {fmtDateTime(n.due_at)}</div>}
                <div className="text-muted-foreground">{fmtDateTime(n.created_at)}</div>
              </Link>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}