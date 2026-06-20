import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Upload, FileText, ListChecks, Eye, CheckCircle2, AlertTriangle } from "lucide-react";
import {
  IMPORT_TARGETS, parseCsvText, buildImportRows, commitImport,
  type ImportTarget, type ParsedCSV,
  buildMappingFile, parseMappingFile,
} from "@/lib/backup";
import { downloadBlob } from "@/lib/backup";
import { FileDown, FileUp } from "lucide-react";

export function ImportWizard({ structures }: { structures: Array<{ id: string; name: string }> }) {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [targetKey, setTargetKey] = useState<string>(IMPORT_TARGETS[0].table);
  const [structureId, setStructureId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [delimiter, setDelimiter] = useState<string>("");
  const [parsed, setParsed] = useState<ParsedCSV | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [mappingName, setMappingName] = useState("");

  const target: ImportTarget = useMemo(
    () => IMPORT_TARGETS.find((t) => t.table === targetKey) ?? IMPORT_TARGETS[0],
    [targetKey],
  );

  function exportMapping() {
    if (!Object.keys(mapping).length) { toast.error("Definisci prima la mappatura"); return; }
    const file = buildMappingFile(target, mapping, mappingName || `mapping-${target.table}`, delimiter || undefined);
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
    downloadBlob(blob, `${file.name.replace(/\W+/g,"-")}.mapping.json`);
    toast.success("Schema mapping esportato");
  }

  async function importMappingFile(f: File) {
    try {
      const txt = await f.text();
      const m = parseMappingFile(txt);
      if (m.target_table !== target.table) {
        if (!confirm(`Il file riguarda "${m.target_table}", non "${target.table}". Caricarlo comunque?`)) return;
      }
      setMapping(m.mapping);
      setMappingName(m.name);
      if (m.delimiter) setDelimiter(m.delimiter);
      toast.success(`Mapping "${m.name}" v${m.schema_version} caricato`);
    } catch (e: any) { toast.error(e?.message ?? String(e)); }
  }

  async function handleFile(f: File) {
    setFile(f);
    const txt = await f.text();
    const p = parseCsvText(txt, delimiter || undefined);
    setParsed(p);
    // automap per nome esatto o per "label normalizzata"
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
    const m: Record<string, string> = {};
    for (const f of target.fields) {
      const h = p.headers.find((h) => norm(h) === norm(f.key) || norm(h) === norm(f.label));
      if (h) m[f.key] = h;
    }
    setMapping(m);
    setStep(3);
  }

  const validation = useMemo(() => {
    if (!parsed) return null;
    return buildImportRows(target, parsed, mapping, structureId || null);
  }, [parsed, target, mapping, structureId]);

  async function commit() {
    if (!validation) return;
    if (validation.errors.length) { toast.error(`${validation.errors.length} errori di validazione: correggi prima di importare.`); return; }
    setBusy(true);
    try {
      const res = await commitImport(target, validation.rows);
      if (res.error) { toast.error(`Import fallito: ${res.error}`); return; }
      toast.success(`Importate ${res.inserted} righe in ${target.label}`);
      setStep(5);
    } finally { setBusy(false); }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-base flex items-center gap-2">
          <Upload className="h-4 w-4" /> Import guidato CSV / TXT
        </CardTitle>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {["1. Gestione","2. File","3. Mappatura","4. Anteprima","5. Fine"].map((s, i) => (
            <Badge key={s} variant={step === (i+1) as any ? "default" : "outline"}>{s}</Badge>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {step === 1 && (
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Cosa vuoi importare?</Label>
              <Select value={targetKey} onValueChange={(v) => { setTargetKey(v); setMapping({}); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{IMPORT_TARGETS.map((t) => <SelectItem key={t.table} value={t.table}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{target.description}</p>
            </div>
            {target.scopeColumn && (
              <div className="space-y-1">
                <Label>Struttura di destinazione</Label>
                <Select value={structureId} onValueChange={setStructureId}>
                  <SelectTrigger><SelectValue placeholder="Seleziona struttura" /></SelectTrigger>
                  <SelectContent>{structures.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="md:col-span-2"><Button disabled={target.scopeColumn ? !structureId : false} onClick={() => setStep(2)}>Avanti</Button></div>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1 md:col-span-2">
                <Label>File CSV / TXT</Label>
                <Input type="file" accept=".csv,.txt,text/csv,text/plain" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                <p className="text-xs text-muted-foreground">Auto-detect del delimitatore. La prima riga deve contenere le intestazioni delle colonne.</p>
              </div>
              <div className="space-y-1">
                <Label>Delimitatore (opzionale)</Label>
                <Select value={delimiter || "auto"} onValueChange={(v) => setDelimiter(v === "auto" ? "" : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto</SelectItem>
                    <SelectItem value=",">Virgola ,</SelectItem>
                    <SelectItem value=";">Punto e virgola ;</SelectItem>
                    <SelectItem value={"\t"}>Tab</SelectItem>
                    <SelectItem value="|">Pipe |</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button variant="outline" onClick={() => setStep(1)}>Indietro</Button>
          </div>
        )}
        {step === 3 && parsed && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground flex items-center gap-2"><ListChecks className="h-4 w-4" /> File: <strong>{file?.name}</strong> · {parsed.rows.length} righe · delimitatore "{parsed.delimiter}"</p>
            <div className="flex flex-wrap items-end gap-3 rounded border border-border p-3">
              <div className="space-y-1"><Label>Nome schema mapping</Label>
                <Input value={mappingName} onChange={(e) => setMappingName(e.target.value)} placeholder={`mapping-${target.table}`} className="w-64" />
              </div>
              <Button type="button" variant="outline" onClick={exportMapping}><FileDown className="mr-2 h-4 w-4" /> Esporta mapping</Button>
              <div>
                <Label className="text-xs">Carica mapping (.json)</Label>
                <Input type="file" accept=".json,application/json" onChange={(e) => { const f = e.target.files?.[0]; if (f) importMappingFile(f); }} className="w-64" />
              </div>
            </div>
            <div className="overflow-x-auto rounded border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase"><tr><th className="px-3 py-2 text-left">Campo destinazione</th><th className="px-3 py-2 text-left">Colonna CSV</th><th className="px-3 py-2 text-left">Tipo</th></tr></thead>
                <tbody>
                  {target.fields.map((f) => (
                    <tr key={f.key} className="border-t border-border/60">
                      <td className="px-3 py-2"><div className="font-medium">{f.label}{f.required && <span className="text-destructive"> *</span>}</div><div className="text-xs text-muted-foreground">{f.key}</div></td>
                      <td className="px-3 py-2">
                        <Select value={mapping[f.key] || "_"} onValueChange={(v) => setMapping({ ...mapping, [f.key]: v === "_" ? "" : v })}>
                          <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_">— non importare —</SelectItem>
                            {parsed.headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{f.type ?? "string"}{f.default !== undefined ? ` (default: ${String(f.default)})` : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2"><Button variant="outline" onClick={() => setStep(2)}>Indietro</Button><Button onClick={() => setStep(4)}>Anteprima & valida</Button></div>
          </div>
        )}
        {step === 4 && validation && (
          <div className="space-y-3">
            <p className="text-sm flex items-center gap-2"><Eye className="h-4 w-4" /> Anteprima: prime 10 righe · totale {validation.rows.length}</p>
            {validation.errors.length > 0 && (
              <div className="rounded border border-destructive/40 bg-destructive/10 p-3 text-sm">
                <p className="font-medium flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> {validation.errors.length} errori di validazione</p>
                <ul className="mt-2 max-h-32 overflow-auto text-xs">
                  {validation.errors.slice(0, 20).map((e, i) => <li key={i}>riga {e.row} · campo {e.field}: {e.message}</li>)}
                </ul>
              </div>
            )}
            <div className="overflow-x-auto rounded border border-border">
              <table className="w-full text-xs">
                <thead className="bg-muted/40"><tr>{target.fields.map((f) => <th key={f.key} className="px-2 py-1 text-left">{f.label}</th>)}</tr></thead>
                <tbody>
                  {validation.rows.slice(0, 10).map((r, i) => (
                    <tr key={i} className="border-t border-border/60">
                      {target.fields.map((f) => <td key={f.key} className="px-2 py-1">{r[f.key] === undefined || r[f.key] === null ? <span className="text-muted-foreground">—</span> : String(r[f.key])}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(3)}>Indietro</Button>
              <Button disabled={busy || validation.errors.length > 0} onClick={commit}>{busy ? "Importazione…" : `Importa ${validation.rows.length} righe`}</Button>
            </div>
          </div>
        )}
        {step === 5 && (
          <div className="rounded border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" /> Import completato.
            <Button size="sm" variant="outline" className="ml-auto" onClick={() => { setStep(1); setFile(null); setParsed(null); setMapping({}); }}>Nuovo import</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}