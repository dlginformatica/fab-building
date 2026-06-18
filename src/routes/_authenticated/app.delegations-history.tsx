import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileSpreadsheet } from "lucide-react";
import { fmtDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/app/delegations-history")({ component: Page });

const MODULES = ["*","tickets","assets","maintenance","inventory","suppliers","contracts","work_orders","purchase_orders","utilities","invoices","reports","sla","penalties","users","audit","docs","settings","messages","statistics"];

function statusOf(r: any): { label: string; cls: string } {
  const now = new Date();
  const ends = r.ends_at ? new Date(r.ends_at) : null;
  if (!r.active) return { label: "sospesa", cls: "bg-muted text-muted-foreground" };
  if (ends && ends < now) return { label: "scaduta", cls: "bg-destructive/15 text-destructive" };
  return { label: "attiva", cls: "bg-success/20 text-success" };
}

function Page() {
  const [f, setF] = useState({ user_email: "", module: "*", status: "all" });

  const { data: profiles } = useQuery({
    queryKey: ["profiles_all"],
    queryFn: async () => (await supabase.from("profiles").select("id,email,full_name")).data ?? [],
  });
  const { data: structures } = useQuery({
    queryKey: ["structures-list"],
    queryFn: async () => (await supabase.from("structures").select("id,name")).data ?? [],
  });
  const { data: rows } = useQuery({
    queryKey: ["delegations_history"],
    queryFn: async () => ((await (supabase as any).from("user_delegations").select("*").order("created_at",{ascending:false})).data ?? []),
  });

  const filtered = useMemo(() => {
    const list = rows ?? [];
    const email = f.user_email.trim().toLowerCase();
    return list.filter((r: any) => {
      if (email) {
        const a = (profiles ?? []).find(p => p.id === r.delegator_id)?.email?.toLowerCase() ?? "";
        const b = (profiles ?? []).find(p => p.id === r.delegate_id)?.email?.toLowerCase() ?? "";
        if (!a.includes(email) && !b.includes(email)) return false;
      }
      if (f.module !== "*") {
        const mods: string[] = r.modules ?? [];
        if (!mods.includes(f.module) && !mods.includes("*")) return false;
      }
      if (f.status !== "all") {
        if (statusOf(r).label !== f.status) return false;
      }
      return true;
    });
  }, [rows, profiles, f]);

  const exportCsv = () => {
    const head = ["created_at","delegator","delegate","structure","moduli","attiva","inizio","scadenza","motivo"];
    const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [head.join(",")];
    for (const r of filtered) {
      const a = (profiles ?? []).find(p => p.id === r.delegator_id);
      const b = (profiles ?? []).find(p => p.id === r.delegate_id);
      const s = (structures ?? []).find(x => x.id === r.structure_id);
      lines.push([
        r.created_at, a?.email ?? "", b?.email ?? "", s?.name ?? "Tutte",
        (r.modules ?? []).join("|"), statusOf(r).label, r.starts_at, r.ends_at ?? "", r.reason ?? "",
      ].map(esc).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "storico_deleghe.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Storico deleghe</h1>
        <p className="text-sm text-muted-foreground">Tutte le deleghe per utente e funzione con stato attiva/sospesa/scaduta, scadenza e motivazione.</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="font-display text-base">Filtri</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="space-y-1 md:col-span-2"><Label>Email utente (delegante o delegato)</Label>
              <Input value={f.user_email} onChange={(e) => setF({ ...f, user_email: e.target.value })} placeholder="user@example.com" />
            </div>
            <div className="space-y-1"><Label>Funzione/Modulo</Label>
              <Select value={f.module} onValueChange={(v) => setF({ ...f, module: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{MODULES.map(m => <SelectItem key={m} value={m}>{m === "*" ? "Tutti" : m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Stato</Label>
              <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti</SelectItem>
                  <SelectItem value="attiva">Attiva</SelectItem>
                  <SelectItem value="sospesa">Sospesa</SelectItem>
                  <SelectItem value="scaduta">Scaduta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <div className="text-xs text-muted-foreground">{filtered.length} risultati</div>
            <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
              <FileSpreadsheet className="mr-1 h-4 w-4" />Esporta CSV
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Da</th><th className="px-4 py-2">A</th><th className="px-4 py-2">Struttura</th>
                <th className="px-4 py-2">Moduli</th><th className="px-4 py-2">Stato</th><th className="px-4 py-2">Scadenza</th>
                <th className="px-4 py-2">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r: any) => {
                const a = (profiles ?? []).find(p => p.id === r.delegator_id);
                const b = (profiles ?? []).find(p => p.id === r.delegate_id);
                const s = (structures ?? []).find(x => x.id === r.structure_id);
                const st = statusOf(r);
                return (
                  <tr key={r.id} className="border-b border-border/60">
                    <td className="px-4 py-2 text-xs">{a?.email ?? "—"}</td>
                    <td className="px-4 py-2 text-xs">{b?.email ?? "—"}</td>
                    <td className="px-4 py-2 text-xs">{s?.name ?? "Tutte"}</td>
                    <td className="px-4 py-2 font-mono text-xs">{(r.modules ?? []).join(", ")}</td>
                    <td className="px-4 py-2"><span className={`rounded-md px-2 py-0.5 text-xs ${st.cls}`}>{st.label}</span></td>
                    <td className="px-4 py-2 text-xs">{r.ends_at ? fmtDateTime(r.ends_at) : "∞"}</td>
                    <td className="px-4 py-2 text-xs">{r.reason ?? "—"}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-xs text-muted-foreground">Nessuna delega corrisponde ai filtri.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}