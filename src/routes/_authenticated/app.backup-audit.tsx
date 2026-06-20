import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMySubscription, useIsSuperAdmin } from "@/lib/use-subscription";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollText, FileSpreadsheet, Printer } from "lucide-react";
import { exportRowsAsCsv, printableHtmlAsPdf } from "@/lib/csv-export";

export const Route = createFileRoute("/_authenticated/app/backup-audit")({ component: Page });

function Page() {
  const { data: sub } = useMySubscription();
  const { data: isSuper } = useIsSuperAdmin();
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [orgFilter, setOrgFilter] = useState("");

  const { data: orgs } = useQuery({
    enabled: !!isSuper,
    queryKey: ["orgs-list-bk-audit"],
    queryFn: async () => (await supabase.from("organizations").select("id,name").order("name")).data ?? [],
  });

  const { data: backups } = useQuery({
    queryKey: ["audit_backup_runs", fromDate, toDate, orgFilter, isSuper, sub?.orgId],
    queryFn: async () => {
      let q: any = (supabase as any).from("backup_runs")
        .select("id, org_id, actor_id, kind, format, storage_path, size_bytes, tables_count, rows_count, snapshot_taken_at, created_at, status, integrity_status, integrity_hash, verified_at, duration_ms, organizations(name)")
        .order("snapshot_taken_at", { ascending: false }).limit(2000);
      if (fromDate) q = q.gte("snapshot_taken_at", fromDate);
      if (toDate) q = q.lte("snapshot_taken_at", `${toDate}T23:59:59`);
      if (orgFilter) q = q.eq("org_id", orgFilter);
      else if (!isSuper && sub?.orgId) q = q.eq("org_id", sub.orgId);
      const { data } = await q;
      return data ?? [];
    },
  });
  const { data: restores } = useQuery({
    queryKey: ["audit_restore_runs", fromDate, toDate, orgFilter, isSuper, sub?.orgId],
    queryFn: async () => {
      let q: any = (supabase as any).from("restore_runs")
        .select("id, org_id, actor_id, mode, pit_target, pit_resolved_to, source_filename, status, rows_inserted, errors_count, error_message, steps_total, steps_done, current_step, created_at, organizations(name)")
        .order("created_at", { ascending: false }).limit(2000);
      if (fromDate) q = q.gte("created_at", fromDate);
      if (toDate) q = q.lte("created_at", `${toDate}T23:59:59`);
      if (orgFilter) q = q.eq("org_id", orgFilter);
      else if (!isSuper && sub?.orgId) q = q.eq("org_id", sub.orgId);
      const { data } = await q;
      return data ?? [];
    },
  });

  const flat = useMemo(() => ({ backups: backups ?? [], restores: restores ?? [] }), [backups, restores]);

  function exportBackupsCsv() {
    exportRowsAsCsv((flat.backups).map((r: any) => ({
      data: r.snapshot_taken_at, organizzazione: r.organizations?.name ?? r.org_id, tipo: r.kind, formato: r.format,
      tabelle: r.tables_count, righe: r.rows_count, dim_byte: r.size_bytes, stato: r.status, path: r.storage_path, autore: r.actor_id,
    })), `audit_backup_${new Date().toISOString().slice(0,10)}.csv`);
  }
  function exportRestoresCsv() {
    exportRowsAsCsv((flat.restores).map((r: any) => ({
      data: r.created_at, organizzazione: r.organizations?.name ?? r.org_id, modo: r.mode,
      pit_target: r.pit_target, pit_resolved: r.pit_resolved_to, file: r.source_filename, stato: r.status,
      righe: r.rows_inserted, errori: r.errors_count, errore: r.error_message, autore: r.actor_id,
    })), `audit_restore_${new Date().toISOString().slice(0,10)}.csv`);
  }
  function printAll() {
    const cols = ["Data","Tipo","Organizzazione","Categoria","Dettagli"];
    const rows: any[][] = [];
    flat.backups.forEach((r: any) => rows.push([new Date(r.snapshot_taken_at).toLocaleString("it-IT"), "BACKUP", r.organizations?.name ?? "—", r.kind, `${r.tables_count ?? "?"} tabelle · ${r.rows_count ?? "?"} righe · ${r.format}`]));
    flat.restores.forEach((r: any) => rows.push([new Date(r.created_at).toLocaleString("it-IT"), "RESTORE", r.organizations?.name ?? "—", r.mode, `righe=${r.rows_inserted} errori=${r.errors_count}${r.pit_target ? ` · PIT ${new Date(r.pit_target).toLocaleString("it-IT")}` : ""}`]));
    rows.sort((a, b) => (a[0] < b[0] ? 1 : -1));
    printableHtmlAsPdf("Audit Backup & Restore", cols, rows);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold flex items-center gap-2"><ScrollText className="h-6 w-6" /> Audit Backup & Restore</h1>
        <p className="text-sm text-muted-foreground">Tracciabilità completa di ogni backup e restore: chi, cosa, quando, su quale snapshot. Esportabile in CSV/PDF.</p>
      </div>
      <Card>
        <CardContent className="p-4 grid gap-3 md:grid-cols-5 items-end">
          <div className="space-y-1"><Label>Dal</Label><Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} /></div>
          <div className="space-y-1"><Label>Al</Label><Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} /></div>
          {isSuper && (
            <div className="space-y-1 md:col-span-2"><Label>Organizzazione</Label>
              <Select value={orgFilter || "all"} onValueChange={(v) => setOrgFilter(v === "all" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">Tutte</SelectItem>{(orgs ?? []).map((o: any) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportBackupsCsv}><FileSpreadsheet className="mr-2 h-4 w-4" /> CSV backup</Button>
            <Button variant="outline" onClick={exportRestoresCsv}><FileSpreadsheet className="mr-2 h-4 w-4" /> CSV restore</Button>
            <Button variant="outline" onClick={printAll}><Printer className="mr-2 h-4 w-4" /> PDF</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="font-display text-base">Backup ({flat.backups.length})</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <tr><th className="px-3 py-2">Data</th><th className="px-3 py-2">Org</th><th className="px-3 py-2">Tipo</th><th className="px-3 py-2">Formato</th><th className="px-3 py-2">Tabelle</th><th className="px-3 py-2">Righe</th><th className="px-3 py-2">Dim.</th><th className="px-3 py-2">Durata</th><th className="px-3 py-2">Integrità</th><th className="px-3 py-2">Stato</th></tr>
            </thead>
            <tbody>
              {flat.backups.map((r: any) => (
                <tr key={r.id} className="border-b border-border/60">
                  <td className="px-3 py-2 text-xs whitespace-nowrap">{new Date(r.snapshot_taken_at).toLocaleString("it-IT")}</td>
                  <td className="px-3 py-2 text-xs">{r.organizations?.name ?? r.org_id?.slice(0,8)}</td>
                  <td className="px-3 py-2"><Badge variant="outline">{r.kind}</Badge></td>
                  <td className="px-3 py-2 text-xs">{r.format}</td>
                  <td className="px-3 py-2 text-xs">{r.tables_count ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">{r.rows_count ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">{r.size_bytes ? `${(r.size_bytes/1024).toFixed(1)} KB` : "—"}</td>
                  <td className="px-3 py-2 text-xs">{r.duration_ms ? `${(r.duration_ms/1000).toFixed(1)}s` : "—"}</td>
                  <td className="px-3 py-2 text-xs">
                    <Badge variant={r.integrity_status === "verified" ? "outline" : r.integrity_status === "unverified" ? "secondary" : "destructive"}>
                      {r.integrity_status ?? "—"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-xs">{r.status}</td>
                </tr>
              ))}
              {!flat.backups.length && <tr><td colSpan={10} className="px-3 py-6 text-center text-xs text-muted-foreground">Nessun backup nel periodo.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="font-display text-base">Restore ({flat.restores.length})</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <tr><th className="px-3 py-2">Data</th><th className="px-3 py-2">Org</th><th className="px-3 py-2">Modo</th><th className="px-3 py-2">PIT target / risolto</th><th className="px-3 py-2">File</th><th className="px-3 py-2">Avanzamento</th><th className="px-3 py-2">Righe</th><th className="px-3 py-2">Errori</th><th className="px-3 py-2">Stato</th></tr>
            </thead>
            <tbody>
              {flat.restores.map((r: any) => (
                <tr key={r.id} className="border-b border-border/60">
                  <td className="px-3 py-2 text-xs whitespace-nowrap">{new Date(r.created_at).toLocaleString("it-IT")}</td>
                  <td className="px-3 py-2 text-xs">{r.organizations?.name ?? r.org_id?.slice(0,8)}</td>
                  <td className="px-3 py-2"><Badge variant="outline">{r.mode}</Badge></td>
                  <td className="px-3 py-2 text-xs">{r.pit_target ? `${new Date(r.pit_target).toLocaleString("it-IT")} → ${r.pit_resolved_to ? new Date(r.pit_resolved_to).toLocaleString("it-IT") : "—"}` : "—"}</td>
                  <td className="px-3 py-2 text-xs max-w-[260px] truncate" title={r.source_filename}>{r.source_filename ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">{r.steps_total ? `${r.steps_done ?? 0}/${r.steps_total} · ${r.current_step ?? ""}` : "—"}</td>
                  <td className="px-3 py-2 text-xs">{r.rows_inserted}</td>
                  <td className="px-3 py-2 text-xs">{r.errors_count}</td>
                  <td className="px-3 py-2 text-xs">{r.status}</td>
                </tr>
              ))}
              {!flat.restores.length && <tr><td colSpan={9} className="px-3 py-6 text-center text-xs text-muted-foreground">Nessun restore nel periodo.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}