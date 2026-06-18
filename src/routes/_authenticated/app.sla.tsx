import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Trash2, Wand2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/sla")({ component: Page });

function Page() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ priority: "media", ack_minutes: "60", resolve_minutes: "480", category_id: "", structure_id: "" });
  const [sim, setSim] = useState({ created: new Date().toISOString().slice(0,16), ackAt: "", resolvedAt: "" });
  const { data: rules } = useQuery({ queryKey: ["sla_rules"], queryFn: async () => (await supabase.from("sla_rules").select("*, asset_categories(name), structures(name)").order("priority")).data ?? [] });
  const { data: categories } = useQuery({ queryKey: ["asset_categories"], queryFn: async () => (await supabase.from("asset_categories").select("id,name").order("name")).data ?? [] });
  const { data: structures } = useQuery({ queryKey: ["structures-list"], queryFn: async () => (await supabase.from("structures").select("id,name").order("name")).data ?? [] });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("sla_rules").insert({
        priority: form.priority as "bassa"|"media"|"alta"|"critica",
        ack_minutes: parseInt(form.ack_minutes, 10),
        resolve_minutes: parseInt(form.resolve_minutes, 10),
        category_id: form.category_id || null,
        structure_id: form.structure_id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Regola creata"); qc.invalidateQueries({ queryKey: ["sla_rules"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("sla_rules").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sla_rules"] }),
  });

  const simulation = useMemo(() => {
    const ack = parseInt(form.ack_minutes || "0", 10);
    const res = parseInt(form.resolve_minutes || "0", 10);
    const t0 = new Date(sim.created);
    const ackDue = new Date(t0.getTime() + ack * 60000);
    const resDue = new Date(t0.getTime() + res * 60000);
    const ackOk = sim.ackAt ? new Date(sim.ackAt) <= ackDue : null;
    const resOk = sim.resolvedAt ? new Date(sim.resolvedAt) <= resDue : null;
    const delayMin = sim.resolvedAt ? Math.max(0, Math.round((new Date(sim.resolvedAt).getTime() - resDue.getTime()) / 60000)) : 0;
    return { ackDue, resDue, ackOk, resOk, delayMin };
  }, [form.ack_minutes, form.resolve_minutes, sim]);

  return (
    <div className="space-y-6">
      <div><h1 className="font-display text-2xl font-bold">Regole SLA — configurazione guidata</h1>
        <p className="text-sm text-muted-foreground">Definisci tempi di presa carico e risoluzione per priorità, categoria (tipologia ticket) e struttura. Simula prima di salvare.</p></div>
      <Card>
        <CardHeader><CardTitle className="font-display text-base">1 · Nuova regola</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
            <div className="space-y-1">
              <Label>Priorità</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["bassa","media","alta","critica"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Tipologia (opz.)</Label>
              <Select value={form.category_id || "all"} onValueChange={(v) => setForm({ ...form, category_id: v === "all" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Tutte" /></SelectTrigger>
                <SelectContent><SelectItem value="all">Tutte</SelectItem>{(categories ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Struttura (opz.)</Label>
              <Select value={form.structure_id || "all"} onValueChange={(v) => setForm({ ...form, structure_id: v === "all" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Tutte" /></SelectTrigger>
                <SelectContent><SelectItem value="all">Tutte</SelectItem>{(structures ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Ack (min)</Label><Input type="number" value={form.ack_minutes} onChange={(e) => setForm({ ...form, ack_minutes: e.target.value })} /></div>
            <div className="space-y-1"><Label>Resolve (min)</Label><Input type="number" value={form.resolve_minutes} onChange={(e) => setForm({ ...form, resolve_minutes: e.target.value })} /></div>
            <div className="flex items-end"><Button className="w-full" onClick={() => add.mutate()}>Aggiungi</Button></div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="font-display text-base flex items-center gap-2"><Wand2 className="h-4 w-4" />2 · Simulazione</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1"><Label>Apertura ticket</Label><Input type="datetime-local" value={sim.created} onChange={(e) => setSim({ ...sim, created: e.target.value })} /></div>
            <div className="space-y-1"><Label>Presa in carico</Label><Input type="datetime-local" value={sim.ackAt} onChange={(e) => setSim({ ...sim, ackAt: e.target.value })} /></div>
            <div className="space-y-1"><Label>Risoluzione</Label><Input type="datetime-local" value={sim.resolvedAt} onChange={(e) => setSim({ ...sim, resolvedAt: e.target.value })} /></div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-4 text-sm">
            <div className="rounded-md border border-border p-3"><div className="text-xs text-muted-foreground">Scadenza ack</div><div className="font-mono">{simulation.ackDue.toLocaleString("it-IT")}</div></div>
            <div className="rounded-md border border-border p-3"><div className="text-xs text-muted-foreground">Scadenza risoluzione</div><div className="font-mono">{simulation.resDue.toLocaleString("it-IT")}</div></div>
            <div className={`rounded-md border p-3 ${simulation.ackOk===null?"border-border":simulation.ackOk?"border-success/40 bg-success/10":"border-destructive/40 bg-destructive/10"}`}><div className="text-xs text-muted-foreground">Esito ack</div><div className="font-semibold">{simulation.ackOk===null?"—":simulation.ackOk?"OK":"VIOLATO"}</div></div>
            <div className={`rounded-md border p-3 ${simulation.resOk===null?"border-border":simulation.resOk?"border-success/40 bg-success/10":"border-destructive/40 bg-destructive/10"}`}><div className="text-xs text-muted-foreground">Esito risoluzione</div><div className="font-semibold">{simulation.resOk===null?"—":simulation.resOk?"OK":`VIOLATO · +${simulation.delayMin}min`}</div></div>
          </div>
        </CardContent>
      </Card>
      <Card><CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
            <tr><th className="px-4 py-2">Priorità</th><th className="px-4 py-2">Tipologia</th><th className="px-4 py-2">Struttura</th><th className="px-4 py-2">Ack (min)</th><th className="px-4 py-2">Resolve (min)</th><th></th></tr>
          </thead>
          <tbody>
            {(rules ?? []).map((r) => (
              <tr key={r.id} className="border-b border-border/60">
                <td className="px-4 py-2">{r.priority}</td>
                <td className="px-4 py-2">{(r as { asset_categories?: { name?: string } }).asset_categories?.name ?? "Tutte"}</td>
                <td className="px-4 py-2">{(r as { structures?: { name?: string } }).structures?.name ?? "Globale"}</td>
                <td className="px-4 py-2">{r.ack_minutes}</td>
                <td className="px-4 py-2">{r.resolve_minutes}</td>
                <td className="px-4 py-2 text-right"><Button size="icon" variant="ghost" onClick={() => del.mutate(r.id)}><Trash2 className="h-4 w-4" /></Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent></Card>
    </div>
  );
}