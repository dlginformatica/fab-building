import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FileSpreadsheet, History } from "lucide-react";
import { fmtDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/app/delegation-audit")({ component: Page });

const ACTIONS = ["all", "created", "updated", "revoked", "reactivated", "deleted"];
const ACTION_LABEL: Record<string, string> = {
  created: "Creata", updated: "Modificata", revoked: "Revocata", reactivated: "Riattivata", deleted: "Eliminata",
};

function Page() {
  const [f, setF] = useState({ email: "", action: "all", from: "", to: "" });

  const { data: rows } = useQuery({
    queryKey: ["delegation_audit"],
    queryFn: async () => ((await (supabase as any).from("delegation_audit").select("*").order("created_at",{ascending:false}).limit(2000)).data ?? []),
  });
  const { data: profiles } = useQuery({
    queryKey: ["profiles_all"],
    queryFn: async () => (await supabase.from("profiles").select("id,email,full_name")).data ?? [],
  });
  const { data: structures } = useQuery({
    queryKey: ["structures-list"],
    queryFn: async () => (await supabase.from("structures").select("id,name")).data ?? [],
  });

  const profileEmail = (id?: string | null) => (profiles ?? []).find((p) => p.id === id)?.email ?? "";
  const structName = (id?: string | null) => (structures ?? []).find((s) => s.id === id)?.name ?? "Tutte";

  const filtered = useMemo(() => {
    const list = rows ?? [];
    const email = f.email.trim().toLowerCase();
    return list.filter((r: any) => {
      if (email) {
        const matched = [r.actor_id, r.delegator_id, r.delegate_id].some((id) =>
          profileEmail(id).toLowerCase().includes(email));
        if (!matched) return false;
      }
      if (f.action !== "all" && r.action !== f.action) return false;
      if (f.from && r.created_at < f.from) return false;
      if (f.to && r.created_at > f.to + "T23:59:59") return false;
      return true;
    });
  }, [rows, profiles, f]);

  const exportCsv = () => {
    const head = ["data","azione","autore","delegante","delegato","struttura","moduli","motivazione","delegation_id"];
    const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [head.join(",")];
    for (const r of filtered) {
      lines.push([
        r.created_at, r.action, profileEmail(r.actor_id), profileEmail(r.delegator_id), profileEmail(r.delegate_id),
        structName(r.structure_id), (r.modules ?? []).join("|"), r.reason ?? "", r.delegation_id ?? "",
      ].map(esc).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = "audit_deleghe.csv"; a.click(); URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold flex items-center gap-2"><History className="h-5 w-5" />Audit deleghe</h1>
        <p className="text-sm text-muted-foreground">Chi ha modificato cosa, quando e perché. Filtri ed export CSV completo (motivazioni incluse).</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="font-display text-base">Filtri</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-5">
          <div className="space-y-1 md:col-span-2"><Label className="text-xs">Email (autore/delegante/delegato)</Label>
            <Input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="cerca per email" /></div>
          <div className="space-y-1"><Label className="text-xs">Azione</Label>
            <Select value={f.action} onValueChange={(v) => setF({ ...f, action: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ACTIONS.map((a) => <SelectItem key={a} value={a}>{a === "all" ? "Tutte" : ACTION_LABEL[a] ?? a}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="space-y-1"><Label className="text-xs">Da</Label><Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></div>
          <div className="space-y-1"><Label className="text-xs">A</Label><Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></div>
          <div className="md:col-span-5 flex justify-end">
            <Button variant="outline" onClick={exportCsv}><FileSpreadsheet className="mr-1 h-4 w-4" />Esporta CSV ({filtered.length})</Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="font-display text-base">Eventi · {filtered.length}</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-xs">
            <thead className="border-b border-border bg-muted/30">
              <tr><th className="px-3 py-2 text-left">Data</th><th className="px-3 py-2 text-left">Azione</th><th className="px-3 py-2 text-left">Autore</th><th className="px-3 py-2 text-left">Delegante</th><th className="px-3 py-2 text-left">Delegato</th><th className="px-3 py-2 text-left">Struttura</th><th className="px-3 py-2 text-left">Moduli</th><th className="px-3 py-2 text-left">Motivazione</th></tr>
            </thead>
            <tbody>
              {filtered.map((r: any) => (
                <tr key={r.id} className="border-b border-border/40">
                  <td className="px-3 py-1.5 font-mono">{fmtDateTime(r.created_at)}</td>
                  <td className="px-3 py-1.5"><Badge variant="secondary">{ACTION_LABEL[r.action] ?? r.action}</Badge></td>
                  <td className="px-3 py-1.5">{profileEmail(r.actor_id) || "—"}</td>
                  <td className="px-3 py-1.5">{profileEmail(r.delegator_id) || "—"}</td>
                  <td className="px-3 py-1.5">{profileEmail(r.delegate_id) || "—"}</td>
                  <td className="px-3 py-1.5">{structName(r.structure_id)}</td>
                  <td className="px-3 py-1.5 font-mono">{(r.modules ?? []).join(", ")}</td>
                  <td className="px-3 py-1.5 max-w-[280px] truncate" title={r.reason ?? ""}>{r.reason ?? "—"}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">Nessun evento.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}