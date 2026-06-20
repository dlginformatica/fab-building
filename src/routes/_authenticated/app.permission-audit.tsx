import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollText, FileSpreadsheet, FileDown } from "lucide-react";
import { fmtDateTime } from "@/lib/format";
import { exportCSV, exportPDF } from "@/lib/exports";

export const Route = createFileRoute("/_authenticated/app/permission-audit")({ component: Page });

const MODULES = ["*","tickets","assets","maintenance","inventory","suppliers","contracts","work_orders","purchase_orders","utilities","invoices","reports","sla","penalties","users","audit","docs","settings","messages","statistics"];

function Page() {
  const [q, setQ] = useState("");
  const [org, setOrg] = useState("all");
  const [module, setModule] = useState("*");
  const [actor, setActor] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data: rows } = useQuery({
    queryKey: ["permission_audit"],
    queryFn: async () => ((await (supabase as any).from("permission_audit").select("*").order("created_at",{ascending:false}).limit(2000)).data ?? []),
  });
  const { data: profiles } = useQuery({
    queryKey: ["profiles_all"],
    queryFn: async () => (await supabase.from("profiles").select("id,email,full_name")).data ?? [],
  });
  const { data: organizations } = useQuery({
    queryKey: ["organizations_all"],
    queryFn: async () => ((await (supabase as any).from("organizations").select("id,name")).data ?? []),
  });
  const { data: memberships } = useQuery({
    queryKey: ["org_memberships_all"],
    queryFn: async () => ((await (supabase as any).from("org_memberships").select("user_id,org_id,role")).data ?? []),
  });
  const { data: structures } = useQuery({
    queryKey: ["structures_orgs"],
    queryFn: async () => (await supabase.from("structures").select("id,name,org_id")).data ?? [],
  });

  const emailOf = (id?: string | null) => (profiles ?? []).find((p) => p.id === id)?.email ?? "—";
  const orgOfUser = (uid?: string | null) => (memberships ?? []).find((m: any) => m.user_id === uid)?.org_id ?? null;
  const orgOfStruct = (sid?: string | null) => (structures ?? []).find((s: any) => s.id === sid)?.org_id ?? null;
  const orgName = (oid?: string | null) => (organizations ?? []).find((o: any) => o.id === oid)?.name ?? "—";
  const moduleOf = (r: any) => {
    const a = r.after ?? {}; const b = r.before ?? {};
    return a?.module ?? b?.module ?? (Array.isArray(a?.modules) ? a.modules.join("|") : Array.isArray(b?.modules) ? b.modules.join("|") : "");
  };

  const adminUsers = useMemo(() => {
    const ids = new Set((memberships ?? []).filter((m: any) => m.role === "owner" || m.role === "admin").map((m: any) => m.user_id));
    return (profiles ?? []).filter((p: any) => ids.has(p.id));
  }, [profiles, memberships]);

  const filtered = useMemo(() => (rows ?? []).filter((r: any) => {
    if (q && !`${r.entity} ${r.action} ${emailOf(r.actor_id)} ${emailOf(r.target_user_id)} ${r.reason ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (org !== "all") {
      const ro = orgOfStruct(r.structure_id) ?? orgOfUser(r.target_user_id) ?? orgOfUser(r.actor_id);
      if (ro !== org) return false;
    }
    if (module !== "*") {
      const m = String(moduleOf(r));
      if (!m.split("|").includes(module)) return false;
    }
    if (actor !== "all" && r.actor_id !== actor) return false;
    if (from && r.created_at < from) return false;
    if (to && r.created_at > to + "T23:59:59") return false;
    return true;
  }), [rows, q, org, module, actor, from, to, profiles, memberships, structures]);

  const exportRows = filtered.map((r: any) => ({
    quando: fmtDateTime(r.created_at),
    organizzazione: orgName(orgOfStruct(r.structure_id) ?? orgOfUser(r.target_user_id) ?? orgOfUser(r.actor_id)),
    attore: emailOf(r.actor_id),
    target: emailOf(r.target_user_id),
    entita: r.entity,
    azione: r.action,
    modulo: String(moduleOf(r)),
    motivo: r.reason ?? "",
    before: JSON.stringify(r.before ?? {}),
    after: JSON.stringify(r.after ?? {}),
  }));
  const cols = [
    { header: "Quando", key: "quando" }, { header: "Organizzazione", key: "organizzazione" },
    { header: "Attore", key: "attore" }, { header: "Target", key: "target" },
    { header: "Entità", key: "entita" }, { header: "Azione", key: "azione" },
    { header: "Modulo", key: "modulo" }, { header: "Motivo", key: "motivo" },
    { header: "Before", key: "before" }, { header: "After", key: "after" },
  ];
  const fname = `audit_permessi_${new Date().toISOString().slice(0,10)}`;
  const subtitle = `Org: ${org === "all" ? "tutte" : orgName(org)} · Modulo: ${module} · Admin: ${actor === "all" ? "tutti" : emailOf(actor)}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold flex items-center gap-2"><ScrollText className="h-6 w-6" />Audit permessi & deleghe</h1>
        <p className="text-sm text-muted-foreground">Tutte le modifiche a deleghe, permessi granulari, ruoli e versioni delle dipendenze.</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="font-display text-base">Filtri & export</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-6">
          <div className="space-y-1 md:col-span-6"><Label className="text-xs">Ricerca</Label>
            <Input placeholder="email / azione / motivo…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div className="space-y-1 md:col-span-2"><Label className="text-xs">Organizzazione</Label>
            <Select value={org} onValueChange={setOrg}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte</SelectItem>
                {(organizations ?? []).map((o: any) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
              </SelectContent>
            </Select></div>
          <div className="space-y-1"><Label className="text-xs">Modulo</Label>
            <Select value={module} onValueChange={setModule}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{MODULES.map((m) => <SelectItem key={m} value={m}>{m === "*" ? "Tutti" : m}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="space-y-1 md:col-span-3"><Label className="text-xs">Utente admin (attore)</Label>
            <Select value={actor} onValueChange={setActor}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti</SelectItem>
                {adminUsers.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.email ?? u.full_name ?? u.id.slice(0,8)}</SelectItem>)}
              </SelectContent>
            </Select></div>
          <div className="space-y-1"><Label className="text-xs">Da</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">A</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <div className="md:col-span-6 flex justify-end gap-2">
            <Button variant="outline" onClick={() => exportCSV(fname, exportRows, cols as any)}><FileSpreadsheet className="mr-1 h-4 w-4" />CSV ({filtered.length})</Button>
            <Button variant="outline" onClick={() => exportPDF(fname, "Audit permessi & deleghe", exportRows, cols as any, subtitle)}><FileDown className="mr-1 h-4 w-4" />PDF</Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-display text-base">Eventi recenti</CardTitle>
          <div className="text-xs text-muted-foreground">{filtered.length} eventi</div>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-xs">
            <thead className="border-b border-border text-left uppercase text-muted-foreground"><tr>
              <th className="px-3 py-2">Quando</th><th className="px-3 py-2">Organizzazione</th><th className="px-3 py-2">Attore</th><th className="px-3 py-2">Target</th>
              <th className="px-3 py-2">Entità</th><th className="px-3 py-2">Azione</th><th className="px-3 py-2">Modulo</th><th className="px-3 py-2">Motivo</th><th className="px-3 py-2">Diff</th>
            </tr></thead>
            <tbody>
              {filtered.map((r: any) => (
                <tr key={r.id} className="border-b border-border/40">
                  <td className="px-3 py-2">{fmtDateTime(r.created_at)}</td>
                  <td className="px-3 py-2">{orgName(orgOfStruct(r.structure_id) ?? orgOfUser(r.target_user_id) ?? orgOfUser(r.actor_id))}</td>
                  <td className="px-3 py-2">{emailOf(r.actor_id)}</td>
                  <td className="px-3 py-2">{emailOf(r.target_user_id)}</td>
                  <td className="px-3 py-2 font-mono">{r.entity}</td>
                  <td className="px-3 py-2"><Badge variant="secondary">{r.action}</Badge></td>
                  <td className="px-3 py-2 font-mono">{String(moduleOf(r)) || "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.reason ?? "—"}</td>
                  <td className="px-3 py-2"><details><summary className="cursor-pointer text-muted-foreground">vedi</summary><pre className="mt-1 max-h-48 overflow-auto rounded bg-muted/30 p-2 text-[10px]">{JSON.stringify({ before: r.before, after: r.after }, null, 2)}</pre></details></td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={9} className="p-4 text-center text-muted-foreground">Nessun evento</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}