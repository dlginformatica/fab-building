// Helper di backup/restore/export/import per organizzazione.
// Tutto lato client: usa la sessione utente, quindi rispetta RLS.
// Il super_admin (RLS admin) vede tutte le strutture; gli admin org solo le proprie.

import { supabase } from "@/integrations/supabase/client";
import JSZip from "jszip";
import * as XLSX from "xlsx";

/* ============================================================== */
/* Costanti                                                        */
/* ============================================================== */

export const BACKUP_BUCKET = "org-backups";
export const SNAPSHOT_SCHEMA_VERSION = 2;
export const IMPORT_MAPPING_SCHEMA_VERSION = 1;

/** Tabelle dump-abili dell'organizzazione, filtrate per structure_id. */
export const ORG_STRUCTURE_TABLES = [
  "structures",
  "floors","rooms","cost_centers",
  "assets","asset_documents","asset_media","asset_history","asset_scans","asset_qr_audit",
  "suppliers","supplier_documents","supplier_compliance",
  "contracts","contract_attachments","contract_renewals",
  "maintenance_plans","maintenance_tasks",
  "inventory_items","inventory_movements","reorder_requests","reorder_attachments","reorder_events",
  "purchase_orders","work_orders",
  "utility_meters","meter_readings","invoices","cash_movements",
  "tickets","ticket_attachments","ticket_comments","ticket_reports",
  "guest_issues","housekeeping_tasks",
  "sla_rules","sla_escalation_rules","sla_notifications","sla_violations","sla_user_settings",
  "notification_channels","notification_templates","notification_log",
  "penalty_rules","module_permissions","user_delegations","user_roles",
  "report_templates","report_delivery_queue","scheduled_report_runs","scheduled_exports",
  "workflows","workflow_instances","workflow_steps","workflow_transitions",
  "audit_log","permission_audit","access_denied_log","delegation_audit","admin_alerts",
  "integrations","videocall_rooms","conversations","conversation_participants","messages",
] as const;

/** Tabelle dump-abili dell'organizzazione, filtrate per org_id/organization_id. */
export const ORG_DIRECT_TABLES: Array<{ table: string; col: "org_id" | "organization_id" }> = [
  { table: "organizations",       col: "org_id" /* speciale: id == org */ },
  { table: "org_memberships",     col: "org_id" },
  { table: "org_invitations",     col: "org_id" },
  { table: "org_notification_prefs", col: "org_id" },
  { table: "org_subscriptions",   col: "org_id" },
  { table: "profiles",            col: "organization_id" },
];

export type Snapshot = {
  meta: { org_id: string; created_at: string; app: string; version: number; tables: string[] };
  data: Record<string, any[]>;
};

async function listStructureIds(orgId: string): Promise<string[]> {
  const { data, error } = await supabase.from("structures").select("id").eq("organization_id", orgId);
  if (error) throw error;
  return (data ?? []).map((r: any) => r.id);
}

/** Esporta uno snapshot completo dell'org come oggetto JSON. */
export async function exportOrgSnapshot(orgId: string, onProgress?: (t: string, i: number, n: number) => void): Promise<Snapshot> {
  const structureIds = await listStructureIds(orgId);
  const data: Record<string, any[]> = {};
  const allTables = [
    ...ORG_STRUCTURE_TABLES.map((t) => ({ table: t as string, kind: "structure" as const })),
    ...ORG_DIRECT_TABLES.map((t) => ({ table: t.table, kind: t.col === "org_id" && t.table === "organizations" ? ("self" as const) : ("direct" as const), col: t.col })),
  ];
  let i = 0;
  for (const t of allTables) {
    i++; onProgress?.(t.table, i, allTables.length);
    try {
      const sb: any = supabase;
      let q: any = sb.from(t.table).select("*");
      if (t.kind === "structure") {
        if (structureIds.length === 0) { data[t.table] = []; continue; }
        q = q.in("structure_id", structureIds);
      } else if (t.kind === "direct") {
        q = q.eq((t as any).col, orgId);
      } else {
        q = q.eq("id", orgId);
      }
      const { data: rows, error } = await q;
      if (error) { console.warn(`[backup] ${t.table}: ${error.message}`); data[t.table] = []; continue; }
      data[t.table] = rows ?? [];
    } catch (e: any) {
      console.warn(`[backup] ${t.table} skipped:`, e?.message);
      data[t.table] = [];
    }
  }
  return {
    meta: { org_id: orgId, created_at: new Date().toISOString(), app: "HotelOps", version: SNAPSHOT_SCHEMA_VERSION, tables: Object.keys(data) },
    data,
  };
}

/** Scarica blob nel browser. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function snapshotToJSONBlob(s: Snapshot): Blob {
  return new Blob([JSON.stringify(s, null, 2)], { type: "application/json" });
}

/** Converte uno snapshot in ZIP con un CSV per tabella. */
export async function snapshotToZipCSV(s: Snapshot): Promise<Blob> {
  const zip = new JSZip();
  zip.file("_meta.json", JSON.stringify(s.meta, null, 2));
  for (const [table, rows] of Object.entries(s.data)) {
    if (!rows?.length) continue;
    const ws = XLSX.utils.json_to_sheet(rows);
    const csv = XLSX.utils.sheet_to_csv(ws);
    zip.file(`${table}.csv`, csv);
  }
  return await zip.generateAsync({ type: "blob" });
}

/** Converte uno snapshot in workbook XLSX multi-foglio. */
export function snapshotToXLSX(s: Snapshot): Blob {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([s.meta]), "_meta");
  for (const [table, rows] of Object.entries(s.data)) {
    if (!rows?.length) continue;
    // limita nome a 31 char (Excel)
    const name = table.slice(0, 31);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), name);
  }
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

/** Restore: merge (upsert per id) o replace (cancella poi inserisce) per ciascuna tabella dello snapshot. */
export async function restoreOrgSnapshot(orgId: string, snapshot: Snapshot, mode: "merge" | "replace", onProgress?: (t: string, i: number, n: number) => void): Promise<{ inserted: Record<string, number>; errors: Record<string, string> }> {
  if (snapshot?.meta?.org_id && snapshot.meta.org_id !== orgId) {
    throw new Error(`Snapshot appartiene a org ${snapshot.meta.org_id}, non a quella corrente (${orgId}).`);
  }
  const inserted: Record<string, number> = {};
  const errors: Record<string, string> = {};
  const tables = Object.keys(snapshot.data ?? {});
  // Replace: ordine inverso al popolamento per FK; per semplicità cancelliamo solo righe collegate alle structures dell'org
  if (mode === "replace") {
    const structureIds = await listStructureIds(orgId);
    for (let i = tables.length - 1; i >= 0; i--) {
      const t = tables[i];
      if (t === "structures" || t === "organizations") continue;
    try {
        const sb: any = supabase;
        if ((ORG_STRUCTURE_TABLES as readonly string[]).includes(t) && structureIds.length) {
          await sb.from(t).delete().in("structure_id", structureIds);
        } else if (t === "profiles") {
          await sb.from("profiles").delete().eq("organization_id", orgId);
        } else if (["org_memberships","org_invitations","org_notification_prefs","org_subscriptions"].includes(t)) {
          await sb.from(t).delete().eq("org_id", orgId);
        }
      } catch (e: any) { errors[`delete:${t}`] = e?.message ?? String(e); }
    }
  }
  let i = 0;
  for (const t of tables) {
    i++; onProgress?.(t, i, tables.length);
    const rows = snapshot.data[t];
    if (!rows?.length) { inserted[t] = 0; continue; }
    try {
      const sb: any = supabase;
      const { error } = await sb.from(t).upsert(rows, { onConflict: "id" });
      if (error) { errors[t] = error.message; continue; }
      inserted[t] = rows.length;
    } catch (e: any) {
      errors[t] = e?.message ?? String(e);
    }
  }
  return { inserted, errors };
}

/* ============================================================== */
/* Import wizard: parser CSV/TXT generico                          */
/* ============================================================== */

import Papa from "papaparse";

export type ParsedCSV = { headers: string[]; rows: Record<string, string>[]; delimiter: string };

export function parseCsvText(text: string, delimiter?: string): ParsedCSV {
  const res = Papa.parse<Record<string, string>>(text, {
    header: true, skipEmptyLines: true, delimiter: delimiter || "",
  });
  return {
    headers: res.meta.fields ?? [],
    rows: (res.data ?? []) as Record<string, string>[],
    delimiter: (res.meta as any).delimiter ?? delimiter ?? ",",
  };
}

export type FieldDef = {
  key: string;
  label: string;
  required?: boolean;
  type?: "string" | "number" | "boolean" | "date" | "uuid";
  default?: any;
};

export type ImportTarget = {
  table: string;
  label: string;
  description: string;
  /** Campo che lega la riga alla struttura (di solito `structure_id`). Se assente, viene iniettato lato wizard. */
  scopeColumn?: "structure_id";
  fields: FieldDef[];
};

export const IMPORT_TARGETS: ImportTarget[] = [
  {
    table: "assets", label: "Asset & Impianti",
    description: "Anagrafica asset (codice, nome, brand, modello, seriale, scadenze garanzia).",
    scopeColumn: "structure_id",
    fields: [
      { key: "code", label: "Codice", required: true },
      { key: "name", label: "Nome", required: true },
      { key: "brand", label: "Marca" },
      { key: "model", label: "Modello" },
      { key: "serial_number", label: "Seriale" },
      { key: "install_date", label: "Data installazione", type: "date" },
      { key: "warranty_until", label: "Garanzia fino al", type: "date" },
      { key: "status", label: "Stato (operational/...)", default: "operational" },
      { key: "notes", label: "Note" },
    ],
  },
  {
    table: "suppliers", label: "Fornitori",
    description: "Anagrafica fornitori con P.IVA, contatti, scadenze DURC.",
    scopeColumn: "structure_id",
    fields: [
      { key: "name", label: "Ragione sociale", required: true },
      { key: "vat_number", label: "Partita IVA" },
      { key: "tax_code", label: "Codice fiscale" },
      { key: "category", label: "Categoria" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Telefono" },
      { key: "pec", label: "PEC" },
      { key: "sdi_code", label: "Codice SDI" },
      { key: "address", label: "Indirizzo" },
      { key: "city", label: "Città" },
      { key: "province", label: "Provincia" },
      { key: "postal_code", label: "CAP" },
      { key: "durc_expiry", label: "Scadenza DURC", type: "date" },
      { key: "insurance_expiry", label: "Scadenza assicurazione", type: "date" },
      { key: "status", label: "Stato", default: "active" },
    ],
  },
  {
    table: "contracts", label: "Contratti",
    description: "Contratti con fornitori, date e SLA.",
    scopeColumn: "structure_id",
    fields: [
      { key: "code", label: "Codice", required: true },
      { key: "title", label: "Titolo", required: true },
      { key: "supplier_id", label: "ID Fornitore", type: "uuid" },
      { key: "type", label: "Tipo", default: "service" },
      { key: "status", label: "Stato", default: "active" },
      { key: "start_date", label: "Inizio", type: "date" },
      { key: "end_date", label: "Fine", type: "date" },
      { key: "amount", label: "Importo", type: "number" },
      { key: "currency", label: "Valuta", default: "EUR" },
      { key: "auto_renew", label: "Rinnovo automatico", type: "boolean" },
      { key: "renewal_months", label: "Mesi rinnovo", type: "number" },
      { key: "notice_period_days", label: "Preavviso (gg)", type: "number" },
    ],
  },
  {
    table: "inventory_items", label: "Articoli magazzino",
    description: "Articoli con SKU, scorta, unità di misura.",
    scopeColumn: "structure_id",
    fields: [
      { key: "sku", label: "SKU", required: true },
      { key: "name", label: "Nome", required: true },
      { key: "category", label: "Categoria" },
      { key: "unit", label: "Unità", default: "pz" },
      { key: "quantity", label: "Quantità", type: "number", default: 0 },
      { key: "min_quantity", label: "Scorta minima", type: "number", default: 0 },
      { key: "unit_cost", label: "Costo unitario", type: "number" },
      { key: "location", label: "Ubicazione" },
      { key: "supplier_id", label: "ID Fornitore", type: "uuid" },
    ],
  },
  {
    table: "meter_readings", label: "Letture contatori",
    description: "Letture periodiche dei contatori utenze.",
    fields: [
      { key: "meter_id", label: "ID Contatore", type: "uuid", required: true },
      { key: "reading_date", label: "Data lettura", type: "date", required: true },
      { key: "value", label: "Valore", type: "number", required: true },
      { key: "notes", label: "Note" },
    ],
  },
  {
    table: "tickets", label: "Ticket",
    description: "Ticket di intervento (correttivi/preventivi).",
    scopeColumn: "structure_id",
    fields: [
      { key: "code", label: "Codice", required: true },
      { key: "title", label: "Titolo", required: true },
      { key: "description", label: "Descrizione" },
      { key: "priority", label: "Priorità", default: "medium" },
      { key: "status", label: "Stato", default: "open" },
      { key: "category", label: "Categoria" },
    ],
  },
];

export function coerceValue(value: any, type?: FieldDef["type"]): any {
  if (value == null || value === "") return null;
  const s = String(value).trim();
  switch (type) {
    case "number": { const n = Number(s.replace(",", ".")); return Number.isFinite(n) ? n : null; }
    case "boolean": return /^(1|true|si|sì|yes|y|x)$/i.test(s);
    case "date": {
      // accetta yyyy-mm-dd, dd/mm/yyyy
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
      const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
      if (m) { const y = m[3].length === 2 ? `20${m[3]}` : m[3]; return `${y}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`; }
      return null;
    }
    case "uuid": return /^[0-9a-f-]{36}$/i.test(s) ? s : null;
    default: return s;
  }
}

export function buildImportRows(
  target: ImportTarget,
  parsed: ParsedCSV,
  mapping: Record<string, string>, // fieldKey -> csvHeader
  scopeStructureId?: string | null,
): { rows: any[]; errors: Array<{ row: number; field: string; message: string }> } {
  const errors: Array<{ row: number; field: string; message: string }> = [];
  const rows: any[] = [];
  parsed.rows.forEach((csv, idx) => {
    const out: any = {};
    for (const f of target.fields) {
      const src = mapping[f.key];
      const raw = src ? csv[src] : undefined;
      let val = coerceValue(raw, f.type);
      if ((val === null || val === undefined) && f.default !== undefined) val = f.default;
      if (f.required && (val === null || val === undefined || val === "")) {
        errors.push({ row: idx + 2, field: f.key, message: "richiesto" });
      }
      if (val !== null && val !== undefined) out[f.key] = val;
    }
    if (target.scopeColumn && scopeStructureId) out[target.scopeColumn] = scopeStructureId;
    rows.push(out);
  });
  return { rows, errors };
}

export async function commitImport(target: ImportTarget, rows: any[]): Promise<{ inserted: number; error?: string }> {
  if (!rows.length) return { inserted: 0 };
  const sb: any = supabase;
  const { error, count } = await sb.from(target.table).insert(rows, { count: "exact" });
  if (error) return { inserted: 0, error: error.message };
  return { inserted: count ?? rows.length };
}

/* ============================================================== */
/* Storage backup (cloud)                                          */
/* ============================================================== */

/** Conta righe totali in uno snapshot. */
export function snapshotRowCount(s: Snapshot): number {
  return Object.values(s.data).reduce((a, b) => a + (Array.isArray(b) ? b.length : 0), 0);
}

/** Carica uno snapshot JSON sul bucket privato `org-backups` e registra l'audit. */
export async function uploadSnapshotAndRecord(orgId: string, snap: Snapshot, kind: "manual" | "scheduled" | "pre_restore" | "pre_reset" = "manual"): Promise<{ id: string; path: string; size: number }> {
  const json = JSON.stringify(snap);
  const blob = new Blob([json], { type: "application/json" });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const path = `${orgId}/${ts}__${kind}.json`;
  const { error: upErr } = await supabase.storage.from(BACKUP_BUCKET).upload(path, blob, { upsert: false, contentType: "application/json" });
  if (upErr) throw new Error(`Upload backup fallito: ${upErr.message}`);
  const sb: any = supabase;
  const { data, error } = await sb.rpc("backup_record", {
    _org: orgId, _kind: kind, _format: "json",
    _bucket: BACKUP_BUCKET, _path: path,
    _size: blob.size, _tables: snap.meta.tables.length, _rows: snapshotRowCount(snap),
    _details: { app: snap.meta.app, version: snap.meta.version },
  });
  if (error) throw error;
  return { id: data?.id, path, size: blob.size };
}

/** Scarica uno snapshot dal bucket. */
export async function downloadSnapshotFromStorage(path: string): Promise<Snapshot> {
  const { data, error } = await supabase.storage.from(BACKUP_BUCKET).download(path);
  if (error || !data) throw new Error(`Download fallito: ${error?.message ?? "no data"}`);
  const txt = await data.text();
  return JSON.parse(txt) as Snapshot;
}

/** URL firmato (10 min) per scaricare un file di backup. */
export async function signedBackupUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BACKUP_BUCKET).createSignedUrl(path, 600);
  if (error || !data?.signedUrl) throw new Error(error?.message ?? "URL non disponibile");
  return data.signedUrl;
}

/** Elimina un backup (storage + record). */
export async function deleteBackup(runId: string, path: string | null): Promise<void> {
  if (path) { await supabase.storage.from(BACKUP_BUCKET).remove([path]); }
  await supabase.from("backup_runs").delete().eq("id", runId);
}

/* ============================================================== */
/* Audit registro & restore                                        */
/* ============================================================== */

/** Registra un evento di restore. */
export async function recordRestore(params: {
  orgId: string; sourceBackupId?: string | null; sourceFilename?: string | null;
  mode: "merge" | "replace" | "point_in_time";
  pitTarget?: string | null; pitResolved?: string | null;
  rowsInserted: number; errorsCount: number; details?: any; errorMessage?: string | null;
  status?: "success" | "partial" | "failed";
}) {
  const sb: any = supabase;
  const status = params.status ?? (params.errorsCount ? "partial" : "success");
  const { data, error } = await sb.rpc("restore_record", {
    _org: params.orgId, _source_id: params.sourceBackupId ?? null,
    _source_name: params.sourceFilename ?? null, _mode: params.mode,
    _pit: params.pitTarget ?? null, _pit_resolved: params.pitResolved ?? null,
    _status: status, _rows: params.rowsInserted, _errors: params.errorsCount,
    _details: params.details ?? {}, _err: params.errorMessage ?? null,
  });
  if (error) console.warn("recordRestore:", error.message);
  return data;
}

/** Trova lo snapshot pianificato più vicino (≤ target). */
export async function findNearestBackup(orgId: string, target: Date): Promise<{ id: string; storage_path: string; snapshot_taken_at: string } | null> {
  const sb: any = supabase;
  const { data, error } = await sb.rpc("backup_nearest_to", { _org: orgId, _target: target.toISOString() });
  if (error) throw error;
  return data ?? null;
}

/* ============================================================== */
/* Mapping import versionato                                       */
/* ============================================================== */

export type ImportMappingFile = {
  app: "HotelOps";
  kind: "import-mapping";
  schema_version: number;
  target_table: string;
  name: string;
  delimiter?: string;
  mapping: Record<string, string>;
  fields_snapshot?: any;
  exported_at: string;
};

export function buildMappingFile(target: ImportTarget, mapping: Record<string,string>, name: string, delimiter?: string): ImportMappingFile {
  return {
    app: "HotelOps", kind: "import-mapping",
    schema_version: IMPORT_MAPPING_SCHEMA_VERSION,
    target_table: target.table, name,
    delimiter, mapping,
    fields_snapshot: target.fields,
    exported_at: new Date().toISOString(),
  };
}

export function parseMappingFile(text: string): ImportMappingFile {
  const j = JSON.parse(text);
  if (j?.kind !== "import-mapping" || !j?.mapping || !j?.target_table) throw new Error("File mapping non valido");
  return j as ImportMappingFile;
}
