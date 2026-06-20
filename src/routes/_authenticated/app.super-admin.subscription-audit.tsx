import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Crown, ScrollText, Search, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/super-admin/subscription-audit")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: isSuper } = await (supabase as any).rpc("has_role", { _user_id: data.user.id, _role: "super_admin" });
    if (!isSuper) throw redirect({ to: "/app" });
  },
  component: Page,
});

type Row = {
  id: string; created_at: string;
  actor_email: string | null; actor_name: string | null;
  org_name: string | null; org_id: string | null;
  action: string; reason: string | null;
  old_tier: string | null; new_tier: string | null;
  old_status: string | null; new_status: string | null;
  before: any; after: any;
};

function Page() {
  const [q, setQ] = useState("");
  const { data: rows } = useQuery<Row[]>({
    queryKey: ["sub-audit"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("v_subscription_audit").select("*").limit(500);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows ?? [];
    return (rows ?? []).filter((r) =>
      [r.actor_email, r.actor_name, r.org_name, r.action, r.reason, r.old_tier, r.new_tier, r.old_status, r.new_status]
        .some((v) => (v ?? "").toString().toLowerCase().includes(s)));
  }, [rows, q]);

  const actionLabel = (a: string) => a === "force_override" ? "Forzatura tier/stato"
    : a === "set_trial_days" ? "Trial custom"
    : a;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          <Crown className="h-6 w-6 text-amber-400" /> Audit abbonamenti
        </h1>
        <p className="text-sm text-muted-foreground">Cronologia di tutte le forzature e le proroghe abbonamento eseguite dal super admin (RPC <code>super_admin_force_subscription</code> e <code>super_admin_set_trial_days</code>).</p>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="font-display text-base flex items-center gap-2"><ScrollText className="h-4 w-4" /> {filtered.length} eventi</CardTitle>
          <div className="relative w-72"><Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-8" placeholder="Cerca per org, autore, motivo…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Quando</th>
                <th className="px-4 py-2">Chi</th>
                <th className="px-4 py-2">Organizzazione</th>
                <th className="px-4 py-2">Azione</th>
                <th className="px-4 py-2">Tier</th>
                <th className="px-4 py-2">Stato</th>
                <th className="px-4 py-2">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-border/60 align-top">
                  <td className="px-4 py-2 text-xs whitespace-nowrap">{new Date(r.created_at).toLocaleString("it-IT")}</td>
                  <td className="px-4 py-2"><div className="text-sm">{r.actor_name ?? "—"}</div><div className="text-xs text-muted-foreground">{r.actor_email ?? "—"}</div></td>
                  <td className="px-4 py-2">{r.org_name ?? <span className="text-muted-foreground">{r.org_id?.slice(0,8) ?? "—"}</span>}</td>
                  <td className="px-4 py-2"><Badge variant="outline">{actionLabel(r.action)}</Badge></td>
                  <td className="px-4 py-2 text-xs">{r.old_tier ?? "—"} <ArrowRight className="inline h-3 w-3" /> <strong>{r.new_tier ?? "—"}</strong></td>
                  <td className="px-4 py-2 text-xs">{r.old_status ?? "—"} <ArrowRight className="inline h-3 w-3" /> <strong>{r.new_status ?? "—"}</strong></td>
                  <td className="px-4 py-2 text-xs max-w-[320px]">{r.reason ?? <span className="text-muted-foreground">—</span>}</td>
                </tr>
              ))}
              {!filtered.length && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">Nessun evento di audit.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}