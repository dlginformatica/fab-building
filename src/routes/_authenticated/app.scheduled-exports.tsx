import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveStructure } from "@/lib/structure-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, Plus, Share2, Trash2, FileDown } from "lucide-react";
import { toast } from "sonner";
import { shareLink } from "@/lib/exports";

export const Route = createFileRoute("/_authenticated/app/scheduled-exports")({ component: Page });

const MODULES = [
  { v: "invoices", l: "Fatture SDI" },
  { v: "cashbook", l: "Prima Nota / Cassa" },
  { v: "housekeeping", l: "Housekeeping KPI" },
  { v: "sla", l: "Conformità SLA" },
  { v: "sustainability", l: "Consumi & ESG" },
];
const FORMATS = [{ v: "pdf", l: "PDF" }, { v: "csv", l: "CSV" }, { v: "xml_sdi", l: "XML SDI (FatturaPA)" }];
const FREQS = [{ v: "daily", l: "Giornaliero" }, { v: "weekly", l: "Settimanale" }, { v: "monthly", l: "Mensile" }];

function Page() {
  const { activeStructureId } = useActiveStructure();
  const qc = useQueryClient();
  const [draft, setDraft] = useState({ name: "", module: "invoices", format: "pdf", frequency: "monthly" });

  const { data: items = [] } = useQuery({
    queryKey: ["sched_exports", activeStructureId],
    enabled: !!activeStructureId,
    queryFn: async () => (await (supabase as any).from("scheduled_exports").select("*").eq("structure_id", activeStructureId).order("created_at", { ascending: false })).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      const u = (await supabase.auth.getUser()).data.user;
      if (!u) throw new Error("Non autenticato");
      if (!draft.name) throw new Error("Inserisci un nome");
      const next = new Date(); next.setDate(next.getDate() + 1);
      const { error } = await (supabase as any).from("scheduled_exports").insert({
        structure_id: activeStructureId, created_by: u.id, ...draft, next_run_at: next.toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Export pianificato"); setDraft({ name: "", module: "invoices", format: "pdf", frequency: "monthly" }); qc.invalidateQueries({ queryKey: ["sched_exports"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async (row: any) => {
      const { error } = await (supabase as any).from("scheduled_exports").update({ enabled: !row.enabled }).eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sched_exports"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("scheduled_exports").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Eliminato"); qc.invalidateQueries({ queryKey: ["sched_exports"] }); },
  });

  const shareUrl = (token: string) => `${typeof window !== "undefined" ? window.location.origin : ""}/exports/${token}`;

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="font-display text-2xl font-semibold flex items-center gap-2"><CalendarClock className="h-6 w-6" />Export schedulati</h1>
        <p className="text-sm text-muted-foreground">Genera automaticamente PDF/CSV/XML SDI per fatture, cashbook, KPI e ESG. Ogni export ha un link condivisibile.</p>
      </header>

      <Card>
        <CardHeader><CardTitle>Nuovo export pianificato</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-5">
          <div className="md:col-span-2"><Label>Nome</Label><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="es. Fatture mese corrente" /></div>
          <div><Label>Modulo</Label>
            <Select value={draft.module} onValueChange={(v) => setDraft({ ...draft, module: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{MODULES.map((m) => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Formato</Label>
            <Select value={draft.format} onValueChange={(v) => setDraft({ ...draft, format: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{FORMATS.map((m) => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Frequenza</Label>
            <Select value={draft.frequency} onValueChange={(v) => setDraft({ ...draft, frequency: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{FREQS.map((m) => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="md:col-span-5"><Button onClick={() => create.mutate()} disabled={create.isPending}><Plus className="h-4 w-4 mr-1" />Aggiungi</Button></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Pianificazioni attive</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b text-xs uppercase text-muted-foreground">
              <tr><th className="px-3 py-2 text-left">Nome</th><th className="px-3 py-2">Modulo</th><th className="px-3 py-2">Formato</th><th className="px-3 py-2">Frequenza</th><th className="px-3 py-2">Prossimo</th><th className="px-3 py-2">Stato</th><th></th></tr>
            </thead>
            <tbody>
              {items.map((r: any) => (
                <tr key={r.id} className="border-b border-border/40">
                  <td className="px-3 py-2 font-medium">{r.name}</td>
                  <td className="px-3 py-2 text-center"><Badge variant="outline">{MODULES.find((m) => m.v === r.module)?.l ?? r.module}</Badge></td>
                  <td className="px-3 py-2 text-center uppercase">{r.format}</td>
                  <td className="px-3 py-2 text-center">{FREQS.find((f) => f.v === r.frequency)?.l ?? r.frequency}</td>
                  <td className="px-3 py-2 text-center text-xs">{r.next_run_at ? new Date(r.next_run_at).toLocaleString("it-IT") : "—"}</td>
                  <td className="px-3 py-2 text-center">
                    <Badge variant="outline" className={r.enabled ? "bg-emerald-500/15 text-emerald-600" : "bg-slate-500/15"}>{r.enabled ? "Attivo" : "Pausa"}</Badge>
                  </td>
                  <td className="px-3 py-2 text-right space-x-1">
                    <Button size="sm" variant="outline" onClick={() => shareLink(shareUrl(r.share_token), r.name)}><Share2 className="h-3 w-3" /></Button>
                    {r.last_artifact_url && <a href={r.last_artifact_url} target="_blank" rel="noreferrer"><Button size="sm" variant="outline"><FileDown className="h-3 w-3" /></Button></a>}
                    <Button size="sm" variant="ghost" onClick={() => toggle.mutate(r)}>{r.enabled ? "Pausa" : "Attiva"}</Button>
                    <Button size="sm" variant="ghost" onClick={() => remove.mutate(r.id)}><Trash2 className="h-3 w-3 text-red-500" /></Button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">Nessuna pianificazione attiva</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}