import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, Check, ExternalLink } from "lucide-react";
import { fmtDateTime } from "@/lib/format";
import { moduleHref } from "@/lib/module-paths";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/admin-alerts")({ component: Page });

function Page() {
  const qc = useQueryClient();
  const { data: rows } = useQuery({
    queryKey: ["admin_alerts"],
    queryFn: async () => ((await (supabase as any).from("admin_alerts").select("*").order("created_at",{ascending:false}).limit(200)).data ?? []),
  });
  const { data: profiles } = useQuery({
    queryKey: ["profiles_all"],
    queryFn: async () => (await supabase.from("profiles").select("id,email,full_name")).data ?? [],
  });
  const emailOf = (id?: string | null) => (profiles ?? []).find((p) => p.id === id)?.email ?? "—";

  const markRead = useMutation({
    mutationFn: async (id: string | "all") => {
      const q = (supabase as any).from("admin_alerts").update({ read_at: new Date().toISOString() });
      const { error } = id === "all" ? await q.is("read_at", null) : await q.eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Aggiornato"); qc.invalidateQueries({ queryKey: ["admin_alerts"] }); },
  });

  const open = (rows ?? []).filter((r: any) => !r.read_at);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2"><ShieldAlert className="h-6 w-6" />Avvisi amministratore</h1>
          <p className="text-sm text-muted-foreground">Ricevi un avviso ogni volta che un utente della tua organizzazione viene respinto per dipendenze mancanti, così puoi correggere ruoli e deleghe.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => markRead.mutate("all")} disabled={!open.length}>Segna tutto come letto</Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="font-display text-base">Da gestire ({open.length}) · Totali ({(rows ?? []).length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-xs">
            <thead className="border-b border-border text-left uppercase text-muted-foreground"><tr>
              <th className="px-3 py-2">Quando</th><th className="px-3 py-2">Utente</th><th className="px-3 py-2">Modulo richiesto</th>
              <th className="px-3 py-2">Motivo</th><th className="px-3 py-2">Dipendenze mancanti</th><th className="px-3 py-2">Stato</th><th></th>
            </tr></thead>
            <tbody>
              {(rows ?? []).map((r: any) => (
                <tr key={r.id} className={`border-b border-border/40 ${r.read_at ? "opacity-60" : ""}`}>
                  <td className="px-3 py-2">{fmtDateTime(r.created_at)}</td>
                  <td className="px-3 py-2">{emailOf(r.source_user_id)}</td>
                  <td className="px-3 py-2 font-mono">
                    <Link to={moduleHref(r.module)} className="text-primary hover:underline inline-flex items-center gap-1">
                      {r.module}<ExternalLink className="h-3 w-3" />
                    </Link>
                  </td>
                  <td className="px-3 py-2"><Badge variant="destructive">{r.reason}</Badge></td>
                  <td className="px-3 py-2">
                    {(r.missing_deps ?? []).length === 0 ? <span className="text-muted-foreground">—</span> : (
                      <div className="flex flex-wrap gap-1">
                        {(r.missing_deps as string[]).map((d) => (
                          <Badge key={d} variant="outline" className="font-mono text-[10px] border-amber-500/40 text-amber-500">{d}</Badge>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">{r.read_at ? <Badge variant="secondary">letto</Badge> : <Badge>nuovo</Badge>}</td>
                  <td className="px-3 py-2 text-right">
                    <Link to="/app/delegations" className="text-xs text-primary hover:underline mr-2">Correggi delega →</Link>
                    {!r.read_at && <Button size="sm" variant="ghost" onClick={() => markRead.mutate(r.id)}><Check className="h-3 w-3" /></Button>}
                  </td>
                </tr>
              ))}
              {(rows ?? []).length === 0 && <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">Nessun avviso</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}