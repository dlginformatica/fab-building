import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Download, Upload, Database, FileJson, FileSpreadsheet, FileArchive, AlertTriangle } from "lucide-react";
import {
  exportOrgSnapshot, snapshotToJSONBlob, snapshotToZipCSV, snapshotToXLSX,
  restoreOrgSnapshot, downloadBlob, type Snapshot,
} from "@/lib/backup";

export function BackupPanel({ orgId, orgName }: { orgId: string; orgName: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>("");
  const [restoreMode, setRestoreMode] = useState<"merge" | "replace">("merge");
  const [confirmName, setConfirmName] = useState("");
  const [restoreFile, setRestoreFile] = useState<File | null>(null);

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
      const res = await restoreOrgSnapshot(orgId, snap, restoreMode, (t, i, n) => setProgress(`${i}/${n} · ${t}`));
      const errCount = Object.keys(res.errors).length;
      const okCount = Object.values(res.inserted).reduce((a, b) => a + b, 0);
      if (errCount) {
        console.warn("Restore errors:", res.errors);
        toast.warning(`Restore completato con ${errCount} tabelle in errore (${okCount} righe inserite). Vedi console.`);
      } else {
        toast.success(`Restore completato: ${okCount} righe ripristinate.`);
      }
    } catch (e: any) {
      toast.error(`Errore restore: ${e?.message ?? e}`);
    } finally { setBusy(null); setProgress(""); }
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
              </SelectContent>
            </Select>
          </div>
          {restoreMode === "replace" && (
            <div className="space-y-1 rounded border border-destructive/40 bg-destructive/10 p-2">
              <Label className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" /> Digita il nome dell'organizzazione per confermare</Label>
              <Input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} placeholder={orgName} />
            </div>
          )}
          <Button disabled={!restoreFile || !!busy} onClick={doRestore}><Download className="mr-2 h-4 w-4" /> Esegui restore</Button>
          {busy === "restore" && <p className="text-xs text-muted-foreground">{progress}</p>}
        </CardContent>
      </Card>
    </div>
  );
}