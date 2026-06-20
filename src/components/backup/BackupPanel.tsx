import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Download, Upload, Database, FileJson, FileSpreadsheet, FileArchive, AlertTriangle, CloudUpload, History, Clock, Trash2 } from "lucide-react";
import {
  exportOrgSnapshot, snapshotToJSONBlob, snapshotToZipCSV, snapshotToXLSX,
  restoreOrgSnapshot, downloadBlob, type Snapshot,
  uploadSnapshotAndRecord, downloadSnapshotFromStorage, signedBackupUrl,
  findNearestBackup, recordRestore, deleteBackup,
} from "@/lib/backup";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export function BackupPanel({ orgId, orgName }: { orgId: string; orgName: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>("");
  const [restoreMode, setRestoreMode] = useState<"merge" | "replace" | "point_in_time">("merge");
  const [pitTarget, setPitTarget] = useState<string>("");
  const [confirmName, setConfirmName] = useState("");
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const qc = useQueryClient();

  const { data: history } = useQuery({
    queryKey: ["backup_runs", orgId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("backup_runs")
        .select("id, kind, format, storage_path, size_bytes, tables_count, rows_count, snapshot_taken_at, status, actor_id")
        .eq("org_id", orgId).order("snapshot_taken_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data as any[];
    },
  });

  async function doExport(kind: "json" | "zip" | "xlsx") {
    setBusy(kind); setProgress("Inizializzazione…");
    try {
      const snap = await exportOrgSnapshot(orgId, (t, i, n) => setProgress(`${i}/${n} · ${t}`));
      const base = `hotelops_backup_${orgName.replace(/\W+/g, "-")}_${new Date().toISOString().slice(0,10)}`;
      if (kind === "json") downloadBlob(snapshotToJSONBlob(snap), `${base}.json`);
      else if (kind === "zip") downloadBlob(await snapshotToZipCSV(snap), `${base}.zip`);
      else downloadBlob(snapshotToXLSX(snap), `${base}.xlsx`);
      toast.success("Backup pronto");
    } catch (e: any) {
      toast.error(`Errore export: ${e?.message ?? e}`);
    } finally { setBusy(null); setProgress(""); }
  }

  async function doCloudBackup() {
    setBusy("cloud"); setProgress("Snapshot…");
    try {
      const snap = await exportOrgSnapshot(orgId, (t, i, n) => setProgress(`${i}/${n} · ${t}`));
      setProgress("Upload sul cloud…");
      const res = await uploadSnapshotAndRecord(orgId, snap, "manual");
      toast.success(`Backup cloud salvato (${(res.size/1024).toFixed(1)} KB)`);
      qc.invalidateQueries({ queryKey: ["backup_runs", orgId] });
    } catch (e: any) {
      toast.error(`Errore backup cloud: ${e?.message ?? e}`);
    } finally { setBusy(null); setProgress(""); }
  }

  async function restoreFromCloud(runId: string, path: string) {
    if (!confirm("Confermi il restore (merge per ID) da questo backup?")) return;
    setBusy("restoreCloud"); setProgress("Download snapshot…");
    try {
      const snap = await downloadSnapshotFromStorage(path);
      const res = await restoreOrgSnapshot(orgId, snap, "merge", (t, i, n) => setProgress(`${i}/${n} · ${t}`));
      const ok = Object.values(res.inserted).reduce((a, b) => a + b, 0);
      const err = Object.keys(res.errors).length;
      await recordRestore({ orgId, sourceBackupId: runId, sourceFilename: path, mode: "merge", rowsInserted: ok, errorsCount: err, details: { inserted: res.inserted, errors: res.errors } });
      toast.success(`Restore: ${ok} righe (${err} errori)`);
    } catch (e: any) {
      toast.error(`Errore: ${e?.message ?? e}`);
    } finally { setBusy(null); setProgress(""); }
  }

  async function doPointInTime() {
    if (!pitTarget) { toast.error("Seleziona data e ora"); return; }
    if (confirmName !== orgName) { toast.error("Digita il nome dell'organizzazione per confermare"); return; }
    setBusy("pit"); setProgress("Ricerca snapshot più vicino…");
    try {
      const near = await findNearestBackup(orgId, new Date(pitTarget));
      if (!near) { toast.error("Nessun backup precedente alla data scelta"); return; }
      setProgress(`Download snapshot del ${new Date(near.snapshot_taken_at).toLocaleString("it-IT")}`);
      const snap = await downloadSnapshotFromStorage(near.storage_path);
      setProgress("Backup pre-restore di sicurezza…");
      try { const pre = await exportOrgSnapshot(orgId); await uploadSnapshotAndRecord(orgId, pre, "pre_restore"); } catch {}
      setProgress("Restore replace in corso…");
      const res = await restoreOrgSnapshot(orgId, snap, "replace", (t, i, n) => setProgress(`${i}/${n} · ${t}`));
      const ok = Object.values(res.inserted).reduce((a, b) => a + b, 0);
      const err = Object.keys(res.errors).length;
      await recordRestore({ orgId, sourceBackupId: near.id, sourceFilename: near.storage_path, mode: "point_in_time", pitTarget: new Date(pitTarget).toISOString(), pitResolved: near.snapshot_taken_at, rowsInserted: ok, errorsCount: err, details: { inserted: res.inserted, errors: res.errors } });
      toast.success(`Point-in-time ripristinato (${ok} righe, ${err} errori)`);
      qc.invalidateQueries({ queryKey: ["backup_runs", orgId] });
    } catch (e: any) {
      toast.error(`Errore PIT: ${e?.message ?? e}`);
      await recordRestore({ orgId, mode: "point_in_time", pitTarget: new Date(pitTarget).toISOString(), rowsInserted: 0, errorsCount: 1, status: "failed", errorMessage: e?.message ?? String(e) });
    } finally { setBusy(null); setProgress(""); }
  }

  async function doRestore() {
    if (!restoreFile) return;
    if (restoreMode === "replace" && confirmName !== orgName) {
      toast.error("Per il restore distruttivo digita esattamente il nome dell'organizzazione.");
      return;
    }
    setBusy("restore"); setProgress("Lettura file…");
    try {
      const text = await restoreFile.text();
      const snap = JSON.parse(text) as Snapshot;
      const effective = restoreMode === "point_in_time" ? "replace" : restoreMode;
      const res = await restoreOrgSnapshot(orgId, snap, effective as any, (t, i, n) => setProgress(`${i}/${n} · ${t}`));
      const errCount = Object.keys(res.errors).length;
      const okCount = Object.values(res.inserted).reduce((a, b) => a + b, 0);
      await recordRestore({ orgId, sourceFilename: restoreFile.name, mode: effective as any, rowsInserted: okCount, errorsCount: errCount, details: { inserted: res.inserted, errors: res.errors } });
      if (errCount) {
        console.warn("Restore errors:", res.errors);
        toast.warning(`Restore completato con ${errCount} tabelle in errore (${okCount} righe inserite). Vedi console.`);
      } else {
        toast.success(`Restore completato: ${okCount} righe ripristinate.`);
      }
    } catch (e: any) {
      toast.error(`Errore restore: ${e?.message ?? e}`);
      try { await recordRestore({ orgId, sourceFilename: restoreFile?.name ?? null, mode: restoreMode === "point_in_time" ? "replace" : restoreMode, rowsInserted: 0, errorsCount: 1, status: "failed", errorMessage: e?.message ?? String(e) }); } catch {}
    } finally { setBusy(null); setProgress(""); }
  }

  async function dlBackup(path: string) {
    try { window.open(await signedBackupUrl(path), "_blank"); }
    catch (e: any) { toast.error(e?.message ?? String(e)); }
  }
  async function delBackup(id: string, path: string | null) {
    if (!confirm("Eliminare definitivamente questo backup?")) return;
    try { await deleteBackup(id, path); qc.invalidateQueries({ queryKey: ["backup_runs", orgId] }); toast.success("Backup eliminato"); }
    catch (e: any) { toast.error(e?.message ?? String(e)); }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="font-display text-base flex items-center gap-2"><Database className="h-4 w-4" /> Backup & Export</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Snapshot completo dei dati dell'organizzazione <strong>{orgName}</strong>. Il file JSON è re-importabile dal pannello di restore.</p>
          <div className="grid gap-2 md:grid-cols-3">
            <Button disabled={!!busy} onClick={() => doExport("json")} variant="outline"><FileJson className="mr-2 h-4 w-4" /> JSON</Button>
            <Button disabled={!!busy} onClick={() => doExport("zip")} variant="outline"><FileArchive className="mr-2 h-4 w-4" /> ZIP di CSV</Button>
            <Button disabled={!!busy} onClick={() => doExport("xlsx")} variant="outline"><FileSpreadsheet className="mr-2 h-4 w-4" /> Excel</Button>
          </div>
          <Button disabled={!!busy} onClick={doCloudBackup} className="w-full"><CloudUpload className="mr-2 h-4 w-4" /> Backup nel cloud (audit + retention)</Button>
          {busy && <p className="text-xs text-muted-foreground">{progress}</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="font-display text-base flex items-center gap-2"><Upload className="h-4 w-4" /> Restore</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1"><Label>File JSON di backup</Label>
            <Input type="file" accept=".json,application/json" onChange={(e) => setRestoreFile(e.target.files?.[0] ?? null)} />
          </div>
          <div className="space-y-1"><Label>Modalità</Label>
            <Select value={restoreMode} onValueChange={(v) => setRestoreMode(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="merge">Merge (upsert per ID, non distrugge)</SelectItem>
                <SelectItem value="replace">Replace (cancella e ricarica · pericoloso)</SelectItem>
                <SelectItem value="point_in_time">Point-in-time (cloud, data/ora)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(restoreMode === "replace" || restoreMode === "point_in_time") && (
            <div className="space-y-1 rounded border border-destructive/40 bg-destructive/10 p-2">
              <Label className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" /> Digita il nome dell'organizzazione per confermare</Label>
              <Input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} placeholder={orgName} />
            </div>
          )}
          {restoreMode === "point_in_time" ? (
            <>
              <div className="space-y-1"><Label className="flex items-center gap-2"><Clock className="h-4 w-4" /> Data/ora target</Label>
                <Input type="datetime-local" value={pitTarget} onChange={(e) => setPitTarget(e.target.value)} />
                <p className="text-[11px] text-muted-foreground">Useremo lo snapshot pianificato più vicino e antecedente alla data scelta.</p>
              </div>
              <Button disabled={!!busy || !pitTarget} onClick={doPointInTime}><Clock className="mr-2 h-4 w-4" /> Esegui point-in-time</Button>
            </>
          ) : (
            <Button disabled={!restoreFile || !!busy} onClick={doRestore}><Download className="mr-2 h-4 w-4" /> Esegui restore</Button>
          )}
          {busy === "restore" && <p className="text-xs text-muted-foreground">{progress}</p>}
          {busy === "pit" && <p className="text-xs text-muted-foreground">{progress}</p>}
          {busy === "restoreCloud" && <p className="text-xs text-muted-foreground">{progress}</p>}
        </CardContent>
      </Card>
      <Card className="md:col-span-2">
        <CardHeader><CardTitle className="font-display text-base flex items-center gap-2"><History className="h-4 w-4" /> Storico backup nel cloud</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <tr><th className="px-3 py-2">Data snapshot</th><th className="px-3 py-2">Tipo</th><th className="px-3 py-2">Tabelle</th><th className="px-3 py-2">Righe</th><th className="px-3 py-2">Dim.</th><th className="px-3 py-2">Azioni</th></tr>
            </thead>
            <tbody>
              {(history ?? []).map((r) => (
                <tr key={r.id} className="border-b border-border/60">
                  <td className="px-3 py-2 text-xs whitespace-nowrap">{new Date(r.snapshot_taken_at).toLocaleString("it-IT")}</td>
                  <td className="px-3 py-2 text-xs">{r.kind}</td>
                  <td className="px-3 py-2 text-xs">{r.tables_count ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">{r.rows_count ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">{r.size_bytes ? `${(r.size_bytes/1024).toFixed(1)} KB` : "—"}</td>
                  <td className="px-3 py-2 flex gap-2">
                    {r.storage_path && <Button size="sm" variant="outline" onClick={() => dlBackup(r.storage_path)}><Download className="h-3 w-3" /></Button>}
                    {r.storage_path && <Button size="sm" variant="outline" onClick={() => restoreFromCloud(r.id, r.storage_path)}><Upload className="h-3 w-3" /></Button>}
                    <Button size="sm" variant="outline" onClick={() => delBackup(r.id, r.storage_path)}><Trash2 className="h-3 w-3" /></Button>
                  </td>
                </tr>
              ))}
              {!history?.length && <tr><td colSpan={6} className="px-3 py-6 text-center text-xs text-muted-foreground">Nessun backup nel cloud.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}