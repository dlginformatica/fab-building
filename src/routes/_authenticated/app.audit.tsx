import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileSpreadsheet, FileDown } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const Route = createFileRoute("/_authenticated/app/audit")({ component: Page });

const ENTITIES = ["", "sla_rules", "penalty_rules", "module_permissions", "user_delegations", "report_templates", "sla_violations", "invoices"];
const ACTIONS = ["", "insert", "update", "delete"];

function Page() {
  const [entity, setEntity] = useState("");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");

  const { data: profiles } = useQuery({
    queryKey: ["profiles_all"],
    queryFn: async () => (await supabase.from("profiles").select("id,email")).data ?? [],
  });

  const { data: logs = [], error } = useQuery({
    queryKey: ["audit", entity, action, from, to],
    queryFn: async () => {
      let qy: any = supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(1000);
      if (entity) qy = qy.eq("entity_type", entity);
      if (action) qy = qy.eq("action", action);
      if (from) qy = qy.gte("created_at", from);
      if (to) qy = qy.lte("created_at", to + "T23:59:59");
      return (await qy).data ?? [];
    },
  });

  const emailOf = (id: string | null) => (profiles ?? []).find((p) => p.id === id)?.email ?? (id ? id.slice(0, 8) : "sistema");

  const filtered = useMemo(() => {
    if (!q) return logs;
    const ql = q.toLowerCase();
    return logs.filter((l: any) => emailOf(l.user_id)?.toLowerCase().includes(ql) || JSON.stringify(l.diff ?? {}).toLowerCase().includes(ql));
  }, [logs, q, profiles]);

  const exportCsv = () => {
    const cols = ["created_at", "entity_type", "action", "entity_id", "user_email"];
    const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [cols.join(","), ...filtered.map((l: any) => [l.created_at, l.entity_type, l.action, l.entity_id, emailOf(l.user_id)].map(esc).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `audit_${Date.now()}.csv`; a.click();
  };
  const exportPdf = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14); doc.text(`HotelOps · Audit Log`, 14, 16);
    doc.setFontSize(9); doc.text(`Filtri: entità=${entity||"tutte"} azione=${action||"tutte"} · Righe: ${filtered.length}`, 14, 22);
    autoTable(doc, { startY: 26, head: [["Quando","Entità","Azione","Utente","ID entità"]],
      body: filtered.map((l: any) => [new Date(l.created_at).toLocaleString("it-IT"), l.entity_type, l.action, emailOf(l.user_id), l.entity_id ?? ""]),
      styles: { fontSize: 7 } });
    doc.save(`audit_${Date.now()}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div><h1 className="font-display text-2xl font-bold">Audit log</h1>
        <p className="text-sm text-muted-foreground">Tracciamento delle azioni critiche con filtri ed export.</p></div>
      <Card>
        <CardHeader><CardTitle className="font-display text-base">Filtri</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-6">
            <div className="space-y-1"><Label>Entità</Label>
              <Select value={entity || "all"} onValueChange={(v) => setEntity(v === "all" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Tutte" /></SelectTrigger>
                <SelectContent>{ENTITIES.map(e => <SelectItem key={e || "_all"} value={e || "all"}>{e || "tutte"}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Azione</Label>
              <Select value={action || "all"} onValueChange={(v) => setAction(v === "all" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Tutte" /></SelectTrigger>
                <SelectContent>{ACTIONS.map(a => <SelectItem key={a || "_all"} value={a || "all"}>{a || "tutte"}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Da</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div className="space-y-1"><Label>A</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            <div className="space-y-1 md:col-span-2"><Label>Cerca (utente / contenuto)</Label><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="email, valore..." /></div>
          </div>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" onClick={exportCsv}><FileSpreadsheet className="mr-1 h-4 w-4" />CSV</Button>
            <Button variant="outline" onClick={exportPdf}><FileDown className="mr-1 h-4 w-4" />PDF</Button>
            <div className="ml-auto self-center text-xs text-muted-foreground">{filtered.length} righe</div>
          </div>
        </CardContent>
      </Card>
      {error && <Card><CardContent className="p-6 text-sm text-destructive">{(error as Error).message}</CardContent></Card>}
      <Card><CardContent className="p-0">
        {filtered.length === 0 ? <div className="p-10 text-center text-sm text-muted-foreground">Nessuna voce.</div> :
          <table className="w-full text-xs">
            <thead className="bg-muted/50"><tr>
              <th className="p-2 text-left">Quando</th><th className="p-2 text-left">Entità</th>
              <th className="p-2 text-left">Azione</th><th className="p-2 text-left">Utente</th>
              <th className="p-2 text-left">ID entità</th>
            </tr></thead>
            <tbody>{filtered.map((l: any) => (
              <tr key={l.id} className="border-t">
                <td className="p-2 whitespace-nowrap">{new Date(l.created_at).toLocaleString("it-IT")}</td>
                <td className="p-2 font-mono">{l.entity_type}</td>
                <td className="p-2"><span className={`rounded px-1.5 py-0.5 text-[10px] ${l.action==="delete"?"bg-destructive/20 text-destructive":l.action==="update"?"bg-amber-500/20 text-amber-600":"bg-success/20 text-success"}`}>{l.action}</span></td>
                <td className="p-2">{emailOf(l.user_id)}</td>
                <td className="p-2 font-mono text-[10px]">{l.entity_id?.slice(0, 8)}</td>
              </tr>
            ))}</tbody>
          </table>}
      </CardContent></Card>
    </div>
  );
}