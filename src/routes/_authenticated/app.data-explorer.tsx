import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsSuperAdmin } from "@/lib/use-subscription";
import { DATA_EXPLORER_TABLES, getTableEntry, isAllowedTable } from "@/lib/data-explorer-catalog";
import { exportRowsAsCsv, printableHtmlAsPdf } from "@/lib/csv-export";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Plus, Pencil, Trash2, Printer, Download, RefreshCw, Search, Database } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const searchSchema = z.object({
  table: z.string().optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
});

export const Route = createFileRoute("/_authenticated/app/data-explorer")({
  validateSearch: (s) => searchSchema.parse(s),
  component: DataExplorerPage,
});

const PAGE_SIZE = 50;

function DataExplorerPage() {
  const { data: isSuper, isLoading: loadingRole } = useIsSuperAdmin();
  const search = Route.useSearch();
  if (loadingRole) return <div className="p-6 text-sm text-muted-foreground">Verifica permessi…</div>;
  if (!isSuper) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader><CardTitle>Accesso riservato</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Il Data Explorer è disponibile solo per il ruolo <strong>super_admin</strong>.
          </CardContent>
        </Card>
      </div>
    );
  }
  return search.table ? <TableView table={search.table} /> : <TablesIndex />;
}

/* ──────────────────────────────────────── INDEX ──────────────────────────────────────── */

function TablesIndex() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const groups = useMemo(() => {
    const byGroup: Record<string, typeof DATA_EXPLORER_TABLES> = {};
    const needle = q.trim().toLowerCase();
    for (const t of DATA_EXPLORER_TABLES) {
      if (needle && !(`${t.name} ${t.label}`.toLowerCase().includes(needle))) continue;
      (byGroup[t.group] ||= []).push(t);
    }
    return Object.entries(byGroup).sort(([a], [b]) => a.localeCompare(b));
  }, [q]);

  return (
    <div className="space-y-6 p-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Database className="h-4 w-4" /> Data Explorer
        </div>
        <h1 className="font-display text-2xl">CRUD universale (super admin)</h1>
        <p className="text-sm text-muted-foreground max-w-3xl">
          Strumento tecnico di emergenza per leggere, esportare, modificare e stampare
          i dati di qualunque tabella esposta dal Data API. Usa le pagine dedicate
          (Strutture, Ticket, Asset, ecc.) per i flussi operativi quotidiani.
          Le RLS restano attive: super_admin vede tutto in lettura/scrittura per design.
        </p>
      </header>
      <div className="flex items-center gap-2 max-w-md">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca tabella per nome o etichetta…" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {groups.map(([group, items]) => (
          <Card key={group}>
            <CardHeader><CardTitle className="text-base">{group}</CardTitle></CardHeader>
            <CardContent className="space-y-1">
              {items.map((t) => (
                <button
                  key={t.name}
                  onClick={() => navigate({ to: "/app/data-explorer", search: { table: t.name, page: 1 } })}
                  className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent text-left"
                >
                  <span className="truncate">
                    <span className="font-medium">{t.label}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{t.name}</span>
                  </span>
                  {t.readonly && <Badge variant="outline" className="text-[10px]">read-only</Badge>}
                </button>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────── TABLE VIEW ──────────────────────────────────────── */

function TableView({ table }: { table: string }) {
  const navigate = useNavigate();
  const router = useRouter();
  const search = Route.useSearch();
  const qc = useQueryClient();
  const entry = getTableEntry(table);
  const [editing, setEditing] = useState<{ row: any | null } | null>(null);
  const [deleting, setDeleting] = useState<any | null>(null);
  const [localQ, setLocalQ] = useState(search.q ?? "");

  useEffect(() => { setLocalQ(search.q ?? ""); }, [search.q]);

  if (!isAllowedTable(table) || !entry) {
    return (
      <div className="p-6">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/app/data-explorer", search: {} as any })}>
          <ArrowLeft className="h-4 w-4 mr-1" />Torna all'indice
        </Button>
        <p className="mt-4 text-sm text-destructive">Tabella «{table}» non consentita.</p>
      </div>
    );
  }

  const page = search.page ?? 1;

  const listQ = useQuery({
    queryKey: ["de-list", table, search.q ?? "", page],
    queryFn: async () => {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      let req: any = (supabase as any).from(table).select("*", { count: "exact" });
      // best-effort order by created_at desc, fallback id
      req = req.order("created_at", { ascending: false, nullsFirst: false });
      const { data, error, count } = await req.range(from, to);
      if (error) {
        // retry senza order
        const r2 = await (supabase as any).from(table).select("*", { count: "exact" }).range(from, to);
        if (r2.error) throw r2.error;
        return { rows: r2.data ?? [], count: r2.count ?? 0 };
      }
      return { rows: data ?? [], count: count ?? 0 };
    },
  });

  const columns = useMemo<string[]>(() => {
    const first = listQ.data?.rows?.[0];
    if (!first) return [];
    return Object.keys(first);
  }, [listQ.data]);

  const filteredRows = useMemo(() => {
    const rows = listQ.data?.rows ?? [];
    const q = (search.q ?? "").trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r: any) =>
      Object.values(r).some((v) => v != null && String(v).toLowerCase().includes(q))
    );
  }, [listQ.data, search.q]);

  const total = listQ.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const del = useMutation({
    mutationFn: async (row: any) => {
      const id = row.id ?? row.user_id;
      if (!id) throw new Error("Riga senza chiave primaria 'id'");
      const { error } = await (supabase as any).from(table).delete().eq(idField(row), id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Riga eliminata"); setDeleting(null); qc.invalidateQueries({ queryKey: ["de-list", table] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const upsert = useMutation({
    mutationFn: async (payload: { row: any | null; values: Record<string, any> }) => {
      if (payload.row) {
        const id = payload.row.id ?? payload.row.user_id;
        const { error } = await (supabase as any).from(table).update(payload.values).eq(idField(payload.row), id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from(table).insert(payload.values);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Salvato"); setEditing(null); qc.invalidateQueries({ queryKey: ["de-list", table] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const exportCsv = () => exportRowsAsCsv(listQ.data?.rows ?? [], `${table}.csv`);
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(listQ.data?.rows ?? [], null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${table}.json`; a.click();
    URL.revokeObjectURL(url);
  };
  const printList = () => {
    const cols = columns;
    const rows = (listQ.data?.rows ?? []).map((r: any) => cols.map((c) => fmtCell(r[c])));
    printableHtmlAsPdf(`${entry.label} (${table})`, cols, rows);
  };

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/app/data-explorer", search: {} as any })}>
          <ArrowLeft className="h-4 w-4 mr-1" />Indice
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-xl truncate">{entry.label}</h1>
          <p className="text-xs text-muted-foreground">{entry.group} · {table} · {total} righe totali</p>
        </div>
        {entry.readonly && <Badge variant="outline">sola lettura</Badge>}
        <Button size="sm" variant="outline" onClick={() => listQ.refetch()}><RefreshCw className="h-4 w-4 mr-1" />Ricarica</Button>
        <Button size="sm" variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-1" />CSV</Button>
        <Button size="sm" variant="outline" onClick={exportJson}><Download className="h-4 w-4 mr-1" />JSON</Button>
        <Button size="sm" variant="outline" onClick={printList}><Printer className="h-4 w-4 mr-1" />Stampa</Button>
        {!entry.readonly && (
          <Button size="sm" onClick={() => setEditing({ row: null })}><Plus className="h-4 w-4 mr-1" />Nuova riga</Button>
        )}
      </div>

      <form
        className="flex items-center gap-2 max-w-md"
        onSubmit={(e) => { e.preventDefault(); navigate({ to: "/app/data-explorer", search: { table, q: localQ || undefined, page: 1 } as any }); }}
      >
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input value={localQ} onChange={(e) => setLocalQ(e.target.value)} placeholder="Filtra nella pagina corrente…" />
        <Button type="submit" size="sm" variant="outline">Applica</Button>
      </form>

      {listQ.isLoading && <p className="text-sm text-muted-foreground">Caricamento…</p>}
      {listQ.error && <p className="text-sm text-destructive">{(listQ.error as Error).message}</p>}

      {!listQ.isLoading && !listQ.error && (
        <div className="border rounded overflow-auto max-h-[68vh]">
          <table className="w-full text-xs">
            <thead className="bg-muted sticky top-0">
              <tr>
                <th className="px-2 py-1 text-left w-24">Azioni</th>
                {columns.map((c) => <th key={c} className="px-2 py-1 text-left whitespace-nowrap">{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r: any, i: number) => (
                <tr key={r.id ?? r.user_id ?? i} className="border-t hover:bg-accent/40">
                  <td className="px-2 py-1">
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="Modifica" onClick={() => setEditing({ row: r })} disabled={entry.readonly}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="Stampa scheda" onClick={() => printRow(entry.label, table, r)}>
                        <Printer className="h-3.5 w-3.5" />
                      </Button>
                      {!entry.readonly && !entry.hideDelete && (
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" title="Elimina" onClick={() => setDeleting(r)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                  {columns.map((c) => (
                    <td key={c} className="px-2 py-1 align-top max-w-[280px] truncate" title={fmtCell(r[c])}>
                      {fmtCell(r[c])}
                    </td>
                  ))}
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr><td colSpan={columns.length + 1} className="p-4 text-center text-muted-foreground">Nessuna riga.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Pagina {page} di {totalPages}</span>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" disabled={page <= 1}
            onClick={() => navigate({ to: "/app/data-explorer", search: { ...search, table, page: page - 1 } as any })}>
            ← Precedente
          </Button>
          <Button size="sm" variant="outline" disabled={page >= totalPages}
            onClick={() => navigate({ to: "/app/data-explorer", search: { ...search, table, page: page + 1 } as any })}>
            Successiva →
          </Button>
        </div>
      </div>

      {editing && (
        <RowEditor
          table={table}
          row={editing.row}
          columns={columns.length ? columns : Object.keys(editing.row ?? {})}
          onClose={() => setEditing(null)}
          onSubmit={(values) => upsert.mutate({ row: editing.row, values })}
          pending={upsert.isPending}
        />
      )}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare la riga?</AlertDialogTitle>
            <AlertDialogDescription>
              Operazione irreversibile su <code>{table}</code>. ID:{" "}
              <code>{deleting?.id ?? deleting?.user_id ?? "-"}</code>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && del.mutate(deleting)} className="bg-destructive text-destructive-foreground">
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ──────────────────────────────────────── ROW EDITOR ──────────────────────────────────────── */

function RowEditor({
  table, row, columns, onClose, onSubmit, pending,
}: {
  table: string; row: any | null; columns: string[];
  onClose: () => void; onSubmit: (v: Record<string, any>) => void; pending: boolean;
}) {
  const skip = new Set(["id", "created_at", "updated_at"]);
  const editable = columns.filter((c) => !skip.has(c));
  const initial: Record<string, string> = {};
  for (const c of editable) initial[c] = stringify(row?.[c]);
  const [values, setValues] = useState<Record<string, string>>(initial);

  const submit = () => {
    const out: Record<string, any> = {};
    for (const c of editable) {
      const raw = values[c];
      if (raw === "" || raw == null) { out[c] = null; continue; }
      out[c] = parseValue(raw);
    }
    onSubmit(out);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{row ? "Modifica riga" : "Nuova riga"} · {table}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 max-h-[60vh] overflow-auto pr-2">
          {editable.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nessuna riga di riferimento: non è possibile inferire le colonne.
              Crea prima una riga dall'interfaccia operativa dedicata, poi torna qui.
            </p>
          )}
          {editable.map((c) => {
            const v = values[c] ?? "";
            const isLong = v.length > 80 || v.includes("\n") || v.startsWith("{") || v.startsWith("[");
            return (
              <div key={c}>
                <Label className="text-xs">{c}</Label>
                {isLong ? (
                  <Textarea value={v} onChange={(e) => setValues({ ...values, [c]: e.target.value })} rows={4} className="font-mono text-xs" />
                ) : (
                  <Input value={v} onChange={(e) => setValues({ ...values, [c]: e.target.value })} />
                )}
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annulla</Button>
          <Button onClick={submit} disabled={pending || editable.length === 0}>
            {pending ? "Salvataggio…" : "Salva"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ──────────────────────────────────────── helpers ──────────────────────────────────────── */

function idField(row: any): string {
  return "id" in row ? "id" : "user_id";
}
function fmtCell(v: any): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
function stringify(v: any): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v, null, 2);
  return String(v);
}
function parseValue(raw: string): any {
  const t = raw.trim();
  if (t === "null") return null;
  if (t === "true") return true;
  if (t === "false") return false;
  if ((t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"))) {
    try { return JSON.parse(t); } catch { /* fallthrough */ }
  }
  if (/^-?\d+$/.test(t)) return Number(t);
  if (/^-?\d+\.\d+$/.test(t)) return Number(t);
  return raw;
}
function printRow(label: string, table: string, row: any) {
  const cols = Object.keys(row);
  const rows = cols.map((c) => [c, fmtCell(row[c])]);
  printableHtmlAsPdf(`${label} — scheda`, ["Campo", "Valore"], rows);
}