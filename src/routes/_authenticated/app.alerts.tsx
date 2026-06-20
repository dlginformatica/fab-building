import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveStructure } from "@/lib/structure-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Bell, Download, FileSignature, Receipt, ShieldCheck } from "lucide-react";
import { exportCSV, exportPDF, type Column } from "@/lib/exports";

export const Route = createFileRoute("/_authenticated/app/alerts")({ component: Page });

type Alert = { kind: string; severity: string; title: string; detail: string; ref_id: string; due_at: string | null };

const KIND_META: Record<string, { label: string; icon: any; href: string }> = {
  sla_violation: { label: "SLA", icon: ShieldCheck, href: "/app/sla-compliance" },
  contract_expiry: { label: "Contratti", icon: FileSignature, href: "/app/contracts" },
  invoice_due: { label: "Fatture", icon: Receipt, href: "/app/invoices" },
  supplier_doc_expiry: { label: "Documenti", icon: ShieldCheck, href: "/app/suppliers-compliance" },
};

function Page() {
  const { activeStructureId } = useActiveStructure();
  const [kind, setKind] = useState<string>("");

  const { data: alerts = [] } = useQuery({
    queryKey: ["alerts", activeStructureId],
    enabled: !!activeStructureId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("alerts_for_structure", { _structure: activeStructureId });
      if (error) throw error; return (data ?? []) as Alert[];
    },
    refetchInterval: 60_000,
  });

  const filtered = useMemo(() => kind ? alerts.filter((a) => a.kind === kind) : alerts, [alerts, kind]);
  const counts = useMemo(() => alerts.reduce<Record<string, number>>((a, x) => { a[x.kind] = (a[x.kind] ?? 0) + 1; return a; }, {}), [alerts]);

  const cols: Column<Alert>[] = [
    { header: "Tipo", key: "kind", format: (r) => KIND_META[r.kind]?.label ?? r.kind },
    { header: "Severità", key: "severity" },
    { header: "Titolo", key: "title" },
    { header: "Dettaglio", key: "detail" },
    { header: "Scadenza", key: "due_at", format: (r) => r.due_at ? new Date(r.due_at).toLocaleString("it-IT") : "—" },
  ];

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold flex items-center gap-2"><Bell className="h-6 w-6"/>Alert & Scadenze</h1>
          <p className="text-sm text-muted-foreground">Reminder automatici per SLA, contratti, fatture e documenti fornitori. Aggiornato ogni minuto.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportCSV(`alerts_${Date.now()}`, filtered, cols)}><Download className="h-4 w-4 mr-1"/>CSV</Button>
          <Button variant="outline" size="sm" onClick={() => exportPDF(`alerts_${Date.now()}`, "Alert & Scadenze", filtered, cols, `Struttura attiva · ${kind || "tutti"}`)}><Download className="h-4 w-4 mr-1"/>PDF</Button>
        </div>
      </header>

      <div className="grid gap-3 md:grid-cols-4">
        {Object.entries(KIND_META).map(([k, meta]) => {
          const Icon = meta.icon; const n = counts[k] ?? 0;
          return (
            <button key={k} onClick={() => setKind(kind === k ? "" : k)} className={`text-left rounded-lg border p-3 transition-colors ${kind === k ? "border-primary bg-primary/10" : "border-border/40 hover:bg-muted/40"}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase text-muted-foreground">{meta.label}</span>
                <Icon className="h-4 w-4 text-primary"/>
              </div>
              <div className="mt-1 text-2xl font-semibold">{n}</div>
            </button>
          );
        })}
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">{filtered.length} alert {kind && `(${KIND_META[kind]?.label})`}</CardTitle></CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? <p className="p-6 text-sm text-muted-foreground">Nessun alert attivo. 🎉</p> :
            <div className="divide-y divide-border/40">
              {filtered.map((a, i) => {
                const meta = KIND_META[a.kind] ?? { label: a.kind, icon: AlertTriangle, href: "/app" };
                const Icon = meta.icon;
                return (
                  <div key={`${a.ref_id}-${i}`} className="flex items-start gap-3 p-3 hover:bg-muted/30">
                    <span className={`mt-0.5 grid h-7 w-7 place-items-center rounded-md ${a.severity === "high" ? "bg-red-500/15 text-red-500" : "bg-amber-500/15 text-amber-500"}`}><Icon className="h-4 w-4"/></span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{meta.label}</Badge>
                        <Badge variant="outline" className={a.severity === "high" ? "bg-red-500/10 text-red-500" : "bg-amber-500/10 text-amber-500"}>{a.severity}</Badge>
                        <span className="font-medium text-sm">{a.title}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{a.detail}</p>
                    </div>
                    <Link to={meta.href as any} className="text-xs text-primary hover:underline self-center">Apri →</Link>
                  </div>
                );
              })}
            </div>
          }
        </CardContent>
      </Card>
    </div>
  );
}