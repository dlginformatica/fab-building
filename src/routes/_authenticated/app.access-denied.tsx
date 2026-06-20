import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, Check } from "lucide-react";
import { fmtDateTime } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/access-denied")({ component: Page });

const REASONS: Record<string, string> = {
  missing_dependency: "Dipendenza mancante",
  no_role: "Ruolo non sufficiente",
  no_delegation: "Nessuna delega attiva",
  expired_delegation: "Delega scaduta",
  other: "Altro",
};

function Page() {
  const qc = useQueryClient();
  const { data: rows } = useQuery({
    queryKey: ["access_denied"],
    queryFn: async () => ((await (supabase as any).from("access_denied_log").select("*").order("created_at",{ascending:false}).limit(200)).data ?? []),
  });
  const ack = useMutation({
    mutationFn: async (id: string) => { const { error } = await (supabase as any).from("access_denied_log").update({ acknowledged_at: new Date().toISOString() }).eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Segnata come letta"); qc.invalidateQueries({ queryKey: ["access_denied"] }); },
  });

  const open = (rows ?? []).filter((r: any) => !r.acknowledged_at);
  const done = (rows ?? []).filter((r: any) => r.acknowledged_at);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold flex items-center gap-2"><ShieldAlert className="h-6 w-6" />Accessi negati</h1>
        <p className="text-sm text-muted-foreground">Smart Inbox dei tentativi di accesso bloccati dal server, con la motivazione e le dipendenze mancanti.</p>
      </div>

      {[{ title: `Da gestire (${open.length})`, list: open }, { title: `Risolti (${done.length})`, list: done }].map((sec, i) => (
        <Card key={i}>
          <CardHeader><CardTitle className="font-display text-base">{sec.title}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-xs">
              <thead className="border-b border-border text-left uppercase text-muted-foreground"><tr>
                <th className="px-3 py-2">Quando</th><th className="px-3 py-2">Modulo</th><th className="px-3 py-2">Motivo</th><th className="px-3 py-2">Dipendenze mancanti</th><th className="px-3 py-2">Percorso</th><th></th>
              </tr></thead>
              <tbody>
                {sec.list.map((r: any) => (
                  <tr key={r.id} className="border-b border-border/40">
                    <td className="px-3 py-2">{fmtDateTime(r.created_at)}</td>
                    <td className="px-3 py-2 font-mono">{r.module}</td>
                    <td className="px-3 py-2"><Badge variant={r.reason === "missing_dependency" ? "destructive" : "secondary"}>{REASONS[r.reason] ?? r.reason}</Badge></td>
                    <td className="px-3 py-2 font-mono text-amber-500">{(r.missing_deps ?? []).join(", ") || "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.path ?? "—"}</td>
                    <td className="px-3 py-2 text-right">{!r.acknowledged_at && <Button size="sm" variant="ghost" onClick={() => ack.mutate(r.id)}><Check className="h-3 w-3" /></Button>}</td>
                  </tr>
                ))}
                {sec.list.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">Nessun elemento</td></tr>}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}