import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Info } from "lucide-react";
import { useMissingDeps } from "@/lib/use-permission";

export const Route = createFileRoute("/_authenticated/app/permissions-matrix")({ component: Page });

type Row = { user_id: string; email: string; full_name: string | null; module: string; enabled: boolean; source: string };

function Page() {
  const [filter, setFilter] = useState("");
  const [previewSel, setPreviewSel] = useState<string[]>([]);

  const { data: rows } = useQuery<Row[]>({
    queryKey: ["permission_matrix"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("permission_matrix", { _org: null });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const { data: deps } = useQuery({
    queryKey: ["module_dependencies"],
    queryFn: async () => (await (supabase as any).from("module_dependencies").select("*")).data ?? [],
  });

  const grouped = useMemo(() => {
    const m = new Map<string, Row[]>();
    (rows ?? []).forEach((r) => {
      if (filter && !(`${r.email} ${r.full_name ?? ""}`.toLowerCase().includes(filter.toLowerCase()))) return;
      const k = r.user_id;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(r);
    });
    return Array.from(m.values());
  }, [rows, filter]);

  const allModules = useMemo(() => {
    const s = new Set<string>();
    (rows ?? []).forEach((r) => s.add(r.module));
    return Array.from(s).sort();
  }, [rows]);

  const { data: missing } = useMissingDeps(previewSel);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Matrice Permessi</h1>
        <p className="text-sm text-muted-foreground">
          Vista server-authoritative: ogni cella riflette la verifica reale che l&apos;app esegue prima di
          mostrare/abilitare la funzione (ruolo + delega + permesso granulare + dipendenze).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base flex items-center gap-2">
            <Info className="h-4 w-4" /> Dipendenze obbligatorie tra moduli
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-muted-foreground">
            Selezionando un modulo da delegare, l&apos;app espande automaticamente le sue dipendenze. Qui sotto
            puoi simulare la selezione.
          </p>
          <div className="flex flex-wrap gap-2">
            {allModules.map((m) => {
              const sel = previewSel.includes(m);
              return (
                <button
                  key={m}
                  onClick={() => setPreviewSel((p) => (sel ? p.filter((x) => x !== m) : [...p, m]))}
                  className={`rounded-md border px-2 py-1 text-xs ${sel ? "border-primary bg-primary/10 text-primary" : "border-border"}`}
                >
                  {m}
                </button>
              );
            })}
          </div>
          {previewSel.length > 0 && (
            <div className="mt-3 text-xs">
              <span className="font-medium">Dipendenze aggiunte automaticamente:</span>{" "}
              {(missing ?? []).length === 0 ? (
                <span className="text-muted-foreground">nessuna</span>
              ) : (
                <span className="flex flex-wrap gap-1 mt-1">
                  {(missing ?? []).map((d) => (
                    <Badge key={d} variant="secondary">{d}</Badge>
                  ))}
                </span>
              )}
            </div>
          )}
          {(deps ?? []).length > 0 && (
            <details className="mt-4 text-xs">
              <summary className="cursor-pointer text-muted-foreground">Mostra tutte le dipendenze registrate ({(deps ?? []).length})</summary>
              <ul className="mt-2 grid grid-cols-2 gap-1 md:grid-cols-3">
                {(deps ?? []).map((d: any, i: number) => (
                  <li key={i}><code className="font-mono">{d.module}</code> → <code className="font-mono">{d.depends_on}</code></li>
                ))}
              </ul>
            </details>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">Utenti × Moduli</CardTitle>
        </CardHeader>
        <CardContent>
          <Input className="mb-3 max-w-sm" placeholder="Filtra per nome/email…" value={filter} onChange={(e) => setFilter(e.target.value)} />
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-background border-b border-border text-left uppercase text-muted-foreground">
                <tr>
                  <th className="px-2 py-2">Utente</th>
                  {allModules.map((m) => <th key={m} className="px-1 py-2 text-center font-mono">{m}</th>)}
                </tr>
              </thead>
              <tbody>
                {grouped.map((urows) => {
                  const u = urows[0];
                  return (
                    <tr key={u.user_id} className="border-b border-border/40 hover:bg-muted/30">
                      <td className="px-2 py-2 whitespace-nowrap">
                        <div className="font-medium">{u.full_name ?? u.email}</div>
                        <div className="text-[10px] text-muted-foreground">{u.email}</div>
                      </td>
                      {allModules.map((m) => {
                        const cell = urows.find((r) => r.module === m);
                        if (!cell) return <td key={m} className="px-1 py-2 text-center">—</td>;
                        return (
                          <td key={m} className="px-1 py-2 text-center" title={`origine: ${cell.source}`}>
                            {cell.enabled ? (
                              <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-500" />
                            ) : (
                              <XCircle className="mx-auto h-4 w-4 text-muted-foreground/40" />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {grouped.length === 0 && (
                  <tr><td colSpan={allModules.length + 1} className="p-6 text-center text-muted-foreground">Nessun utente trovato</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-500" /> abilitato (server)</span>
            <span className="flex items-center gap-1"><XCircle className="h-3 w-3" /> negato</span>
            <span>Passa il mouse su una cella per vedere la fonte (ruolo / delega / permesso).</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}