import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Save, Play, AlertTriangle, CheckCircle2, GitBranch } from "lucide-react";
import { toast } from "sonner";
import { fmtDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/app/module-dependencies")({ component: Page });

type Rule = { module: string; depends_on: string; note?: string };

function detectCycles(rules: Rule[]): string[] {
  const g = new Map<string, string[]>();
  rules.forEach((r) => { if (!g.has(r.module)) g.set(r.module, []); g.get(r.module)!.push(r.depends_on); });
  const cycles: string[] = [];
  const visit = (n: string, path: string[]) => {
    if (path.includes(n)) { cycles.push([...path.slice(path.indexOf(n)), n].join(" → ")); return; }
    (g.get(n) ?? []).forEach((m) => visit(m, [...path, n]));
  };
  Array.from(g.keys()).forEach((k) => visit(k, []));
  return Array.from(new Set(cycles));
}

function Page() {
  const qc = useQueryClient();
  const { data: versions } = useQuery({
    queryKey: ["dep_versions"],
    queryFn: async () => ((await (supabase as any).from("module_dependency_versions").select("*").order("version",{ascending:false})).data ?? []),
  });
  const { data: current } = useQuery({
    queryKey: ["module_dependencies"],
    queryFn: async () => ((await (supabase as any).from("module_dependencies").select("*").order("module")).data ?? []),
  });

  const active = (versions ?? []).find((v: any) => v.active);
  const nextVersion = ((versions ?? [])[0]?.version ?? 0) + 1;

  const [rules, setRules] = useState<Rule[]>([]);
  const [note, setNote] = useState("");

  // initialize from active version or current table
  useMemo(() => {
    if (rules.length > 0) return;
    if (active?.rules) setRules(active.rules as Rule[]);
    else if (current && current.length) setRules(current.map((r: any) => ({ module: r.module, depends_on: r.depends_on })));
  }, [active, current]);

  const cycles = detectCycles(rules);
  const dups = rules.filter((r, i) => rules.findIndex((x) => x.module === r.module && x.depends_on === r.depends_on) !== i);
  const selfRefs = rules.filter((r) => r.module === r.depends_on);

  // Impact preview vs current active
  const currentSet = new Set((current ?? []).map((r: any) => `${r.module}→${r.depends_on}`));
  const draftSet = new Set(rules.map((r) => `${r.module}→${r.depends_on}`));
  const added = rules.filter((r) => !currentSet.has(`${r.module}→${r.depends_on}`));
  const removed = (current ?? []).filter((r: any) => !draftSet.has(`${r.module}→${r.depends_on}`));

  const save = useMutation({
    mutationFn: async (activate: boolean) => {
      if (cycles.length || dups.length || selfRefs.length) throw new Error("Risolvi gli errori di validazione prima di salvare.");
      const user = (await supabase.auth.getUser()).data.user;
      const ins = await (supabase as any).from("module_dependency_versions").insert({
        version: nextVersion, rules, note, created_by: user?.id,
      }).select("id").single();
      if (ins.error) throw ins.error;
      if (activate) {
        const { error } = await (supabase as any).rpc("activate_dependency_version", { _version_id: ins.data.id });
        if (error) throw error;
      }
    },
    onSuccess: (_, vars) => { toast.success(vars ? "Versione salvata e attivata" : "Versione salvata"); qc.invalidateQueries(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const activate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).rpc("activate_dependency_version", { _version_id: id });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Versione attivata"); qc.invalidateQueries(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const errors = cycles.length + dups.length + selfRefs.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold flex items-center gap-2"><GitBranch className="h-6 w-6" />Dipendenze tra moduli</h1>
        <p className="text-sm text-muted-foreground">Configura le dipendenze obbligatorie, valida le regole e attiva una versione. Ogni modifica è tracciata in audit.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="font-display text-base">Bozza versione #{nextVersion}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            {rules.map((r, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <Input className="col-span-4" placeholder="module" value={r.module} onChange={(e) => setRules(rules.map((x, j) => j === i ? { ...x, module: e.target.value } : x))} />
                <span className="col-span-1 text-center text-muted-foreground">→</span>
                <Input className="col-span-4" placeholder="depends_on" value={r.depends_on} onChange={(e) => setRules(rules.map((x, j) => j === i ? { ...x, depends_on: e.target.value } : x))} />
                <Input className="col-span-2" placeholder="nota" value={r.note ?? ""} onChange={(e) => setRules(rules.map((x, j) => j === i ? { ...x, note: e.target.value } : x))} />
                <Button variant="ghost" size="icon" className="col-span-1" onClick={() => setRules(rules.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setRules([...rules, { module: "", depends_on: "" }])}><Plus className="mr-1 h-3 w-3" />Aggiungi regola</Button>
          </div>

          <div className="space-y-1"><Label>Note versione</Label><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></div>

          {/* Validation */}
          <div className="rounded-md border border-border/60 p-3 text-xs space-y-1">
            <div className="font-semibold flex items-center gap-2">{errors ? <AlertTriangle className="h-4 w-4 text-amber-500" /> : <CheckCircle2 className="h-4 w-4 text-emerald-500" />}Validazione</div>
            {cycles.map((c, i) => <div key={`c${i}`} className="text-destructive">Ciclo: {c}</div>)}
            {selfRefs.map((r, i) => <div key={`s${i}`} className="text-destructive">Auto-riferimento: {r.module}</div>)}
            {dups.map((r, i) => <div key={`d${i}`} className="text-destructive">Duplicato: {r.module} → {r.depends_on}</div>)}
            {!errors && <div className="text-muted-foreground">Nessun errore.</div>}
          </div>

          {/* Impact preview */}
          <div className="rounded-md border border-border/60 p-3 text-xs space-y-1">
            <div className="font-semibold">Anteprima impatto vs versione attiva</div>
            <div><Badge variant="secondary" className="mr-1">+{added.length}</Badge>aggiunte · <Badge variant="secondary" className="mr-1">-{removed.length}</Badge>rimosse</div>
            {added.length > 0 && <div>Aggiunte: {added.map((r) => `${r.module}→${r.depends_on}`).join(", ")}</div>}
            {removed.length > 0 && <div>Rimosse: {removed.map((r: any) => `${r.module}→${r.depends_on}`).join(", ")}</div>}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => save.mutate(false)} disabled={save.isPending || errors > 0}><Save className="mr-1 h-4 w-4" />Salva bozza</Button>
            <Button onClick={() => save.mutate(true)} disabled={save.isPending || errors > 0}><Play className="mr-1 h-4 w-4" />Salva e attiva</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="font-display text-base">Storico versioni</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-xs">
            <thead className="border-b border-border text-left uppercase text-muted-foreground"><tr>
              <th className="px-3 py-2">v</th><th className="px-3 py-2">Data</th><th className="px-3 py-2">Regole</th><th className="px-3 py-2">Nota</th><th className="px-3 py-2">Stato</th><th></th>
            </tr></thead>
            <tbody>
              {(versions ?? []).map((v: any) => (
                <tr key={v.id} className="border-b border-border/40">
                  <td className="px-3 py-2 font-mono">#{v.version}</td>
                  <td className="px-3 py-2">{fmtDateTime(v.created_at)}</td>
                  <td className="px-3 py-2">{(v.rules ?? []).length}</td>
                  <td className="px-3 py-2 text-muted-foreground">{v.note}</td>
                  <td className="px-3 py-2">{v.active ? <Badge>attiva</Badge> : <Badge variant="secondary">bozza</Badge>}</td>
                  <td className="px-3 py-2 text-right">
                    {!v.active && <Button size="sm" variant="outline" onClick={() => activate.mutate(v.id)}>Attiva</Button>}
                    <Button size="sm" variant="ghost" onClick={() => setRules(v.rules as Rule[])}>Carica in bozza</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}