import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/sla")({ component: Page });

function Page() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ priority: "media", ack_minutes: "60", resolve_minutes: "480", category_id: "" });
  const { data: rules } = useQuery({ queryKey: ["sla_rules"], queryFn: async () => (await supabase.from("sla_rules").select("*, asset_categories(name), structures(name)").order("priority")).data ?? [] });
  const { data: categories } = useQuery({ queryKey: ["asset_categories"], queryFn: async () => (await supabase.from("asset_categories").select("id,name").order("name")).data ?? [] });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("sla_rules").insert({
        priority: form.priority as "bassa"|"media"|"alta"|"critica",
        ack_minutes: parseInt(form.ack_minutes, 10),
        resolve_minutes: parseInt(form.resolve_minutes, 10),
        category_id: form.category_id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Regola creata"); qc.invalidateQueries({ queryKey: ["sla_rules"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Regole SLA</h1>
      <Card>
        <CardHeader><CardTitle className="font-display text-base">Nuova regola</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <div className="space-y-1">
              <Label>Priorità</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["bassa","media","alta","critica"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Categoria (opz.)</Label>
              <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                <SelectTrigger><SelectValue placeholder="Tutte" /></SelectTrigger>
                <SelectContent>{(categories ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Ack (min)</Label><Input type="number" value={form.ack_minutes} onChange={(e) => setForm({ ...form, ack_minutes: e.target.value })} /></div>
            <div className="space-y-1"><Label>Resolve (min)</Label><Input type="number" value={form.resolve_minutes} onChange={(e) => setForm({ ...form, resolve_minutes: e.target.value })} /></div>
            <div className="flex items-end"><Button className="w-full" onClick={() => add.mutate()}>Aggiungi</Button></div>
          </div>
        </CardContent>
      </Card>
      <Card><CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
            <tr><th className="px-4 py-2">Priorità</th><th className="px-4 py-2">Categoria</th><th className="px-4 py-2">Struttura</th><th className="px-4 py-2">Ack (min)</th><th className="px-4 py-2">Resolve (min)</th></tr>
          </thead>
          <tbody>
            {(rules ?? []).map((r) => (
              <tr key={r.id} className="border-b border-border/60">
                <td className="px-4 py-2">{r.priority}</td>
                <td className="px-4 py-2">{(r as { asset_categories?: { name?: string } }).asset_categories?.name ?? "Tutte"}</td>
                <td className="px-4 py-2">{(r as { structures?: { name?: string } }).structures?.name ?? "Globale"}</td>
                <td className="px-4 py-2">{r.ack_minutes}</td>
                <td className="px-4 py-2">{r.resolve_minutes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent></Card>
    </div>
  );
}