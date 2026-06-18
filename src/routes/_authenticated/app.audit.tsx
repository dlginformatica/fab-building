import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/app/audit")({ component: Page });

function Page() {
  const { data: logs = [], error } = useQuery({
    queryKey: ["audit"],
    queryFn: async () => (await supabase.from("audit_log").select("*").order("created_at",{ascending:false}).limit(200)).data ?? [],
  });
  return (
    <div className="space-y-6">
      <div><h1 className="font-display text-2xl font-bold">Audit log</h1><p className="text-sm text-muted-foreground">Tracciamento operazioni (solo admin).</p></div>
      {error && <Card><CardContent className="p-6 text-sm text-destructive">{(error as Error).message}</CardContent></Card>}
      <Card><CardContent className="p-0">
        {logs.length===0 ? <div className="p-10 text-center text-sm text-muted-foreground">Nessuna voce nel log.</div> :
          <table className="w-full text-xs">
            <thead className="bg-muted/50"><tr><th className="p-2 text-left">Quando</th><th className="p-2 text-left">Entità</th><th className="p-2 text-left">Azione</th><th className="p-2 text-left">User</th></tr></thead>
            <tbody>{logs.map((l:any)=>(
              <tr key={l.id} className="border-t"><td className="p-2">{new Date(l.created_at).toLocaleString("it-IT")}</td>
                <td className="p-2">{l.entity_type}</td><td className="p-2">{l.action}</td><td className="p-2 font-mono">{l.user_id?.slice(0,8)}</td></tr>
            ))}</tbody>
          </table>}
      </CardContent></Card>
    </div>
  );
}