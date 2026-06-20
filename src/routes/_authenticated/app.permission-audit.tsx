import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollText } from "lucide-react";
import { fmtDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/app/permission-audit")({ component: Page });

function Page() {
  const [q, setQ] = useState("");
  const { data: rows } = useQuery({
    queryKey: ["permission_audit"],
    queryFn: async () => ((await (supabase as any).from("permission_audit").select("*").order("created_at",{ascending:false}).limit(1000)).data ?? []),
  });
  const { data: profiles } = useQuery({
    queryKey: ["profiles_all"],
    queryFn: async () => (await supabase.from("profiles").select("id,email,full_name")).data ?? [],
  });
  const emailOf = (id?: string | null) => (profiles ?? []).find((p) => p.id === id)?.email ?? "—";

  const filtered = useMemo(() => (rows ?? []).filter((r: any) =>
    !q || `${r.entity} ${r.action} ${emailOf(r.actor_id)} ${emailOf(r.target_user_id)} ${r.reason ?? ""}`.toLowerCase().includes(q.toLowerCase())
  ), [rows, q, profiles]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold flex items-center gap-2"><ScrollText className="h-6 w-6" />Audit permessi & deleghe</h1>
        <p className="text-sm text-muted-foreground">Tutte le modifiche a deleghe, permessi granulari, ruoli e versioni delle dipendenze.</p>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-display text-base">Eventi recenti</CardTitle>
          <Input className="max-w-sm" placeholder="Cerca email/azione/motivo…" value={q} onChange={(e) => setQ(e.target.value)} />
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-xs">
            <thead className="border-b border-border text-left uppercase text-muted-foreground"><tr>
              <th className="px-3 py-2">Quando</th><th className="px-3 py-2">Attore</th><th className="px-3 py-2">Target</th>
              <th className="px-3 py-2">Entità</th><th className="px-3 py-2">Azione</th><th className="px-3 py-2">Motivo</th><th className="px-3 py-2">Diff</th>
            </tr></thead>
            <tbody>
              {filtered.map((r: any) => (
                <tr key={r.id} className="border-b border-border/40">
                  <td className="px-3 py-2">{fmtDateTime(r.created_at)}</td>
                  <td className="px-3 py-2">{emailOf(r.actor_id)}</td>
                  <td className="px-3 py-2">{emailOf(r.target_user_id)}</td>
                  <td className="px-3 py-2 font-mono">{r.entity}</td>
                  <td className="px-3 py-2"><Badge variant="secondary">{r.action}</Badge></td>
                  <td className="px-3 py-2 text-muted-foreground">{r.reason ?? "—"}</td>
                  <td className="px-3 py-2"><details><summary className="cursor-pointer text-muted-foreground">vedi</summary><pre className="mt-1 max-h-48 overflow-auto rounded bg-muted/30 p-2 text-[10px]">{JSON.stringify({ before: r.before, after: r.after }, null, 2)}</pre></details></td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">Nessun evento</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}