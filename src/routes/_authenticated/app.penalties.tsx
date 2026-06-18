import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useActiveStructure } from "@/lib/structure-context";
import { fmtDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/app/penalties")({ component: Page });

function Page() {
  const qc = useQueryClient();
  const { activeStructureId } = useActiveStructure();
  const [f, setF] = useState({ name: "", trigger_type: "sla_resolve", threshold_minutes: "0", amount_eur: "0", per_hour: false });

  const { data: rules } = useQuery({
    queryKey: ["penalty_rules", activeStructureId],
    queryFn: async () => ((await (supabase as any).from("penalty_rules").select("*").order("created_at",{ascending:false})).data ?? []),
  });
  const { data: violations } = useQuery({
    queryKey: ["sla_violations", activeStructureId],
    queryFn: async () => {
      let q = (supabase as any).from("sla_violations").select("*, tickets(ticket_number,title)").order("created_at",{ascending:false}).limit(200);
      if (activeStructureId) q = q.eq("structure_id", activeStructureId);
      return (await q).data ?? [];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("penalty_rules").insert({
        ...f, threshold_minutes: Number(f.threshold_minutes), amount_eur: Number(f.amount_eur),
        structure_id: activeStructureId,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Regola creata"); qc.invalidateQueries({ queryKey: ["penalty_rules"] }); setF({ name:"",trigger_type:"sla_resolve",threshold_minutes:"0",amount_eur:"0",per_hour:false }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const totalPenalty = (violations ?? []).reduce((a: number, b: any) => a + Number(b.penalty_eur || 0), 0);

  return (
    <div className="space-y-6">
      <div><h1 className="font-display text-2xl font-bold">Penali & Violazioni SLA</h1>
        <p className="text-sm text-muted-foreground">Le violazioni vengono calcolate automaticamente alla risoluzione del ticket.</p></div>
      <Tabs defaultValue="violations">
        <TabsList><TabsTrigger value="violations">Violazioni ({(violations ?? []).length})</TabsTrigger><TabsTrigger value="rules">Regole</TabsTrigger></TabsList>
        <TabsContent value="violations" className="space-y-3">
          <Card><CardContent className="flex items-center justify-between p-4">
            <div className="text-sm text-muted-foreground">Totale penali maturate</div>
            <div className="font-display text-2xl font-bold">€{totalPenalty.toFixed(2)}</div>
          </CardContent></Card>
          <Card><CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <tr><th className="px-4 py-2">Data</th><th className="px-4 py-2">Ticket</th><th className="px-4 py-2">Tipo</th><th className="px-4 py-2 text-right">Ritardo (min)</th><th className="px-4 py-2 text-right">Penale</th><th className="px-4 py-2">Stato</th></tr>
              </thead>
              <tbody>
                {(violations ?? []).map((v: any) => (
                  <tr key={v.id} className="border-b border-border/60">
                    <td className="px-4 py-2 text-xs">{fmtDateTime(v.created_at)}</td>
                    <td className="px-4 py-2 font-mono text-xs">#{v.tickets?.ticket_number} · {v.tickets?.title}</td>
                    <td className="px-4 py-2">{v.kind}</td>
                    <td className="px-4 py-2 text-right">{v.delay_minutes}</td>
                    <td className="px-4 py-2 text-right font-medium">€{Number(v.penalty_eur).toFixed(2)}</td>
                    <td className="px-4 py-2">{v.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="rules" className="space-y-3">
          <Card>
            <CardHeader><CardTitle className="font-display text-base">Nuova regola</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-5">
                <div className="space-y-1 md:col-span-2"><Label>Nome</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
                <div className="space-y-1"><Label>Trigger</Label>
                  <Select value={f.trigger_type} onValueChange={(v) => setF({ ...f, trigger_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="sla_resolve">SLA risoluzione</SelectItem><SelectItem value="sla_ack">SLA presa carico</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Soglia ritardo (min)</Label><Input type="number" value={f.threshold_minutes} onChange={(e) => setF({ ...f, threshold_minutes: e.target.value })} /></div>
                <div className="space-y-1"><Label>Importo €</Label><Input type="number" step="0.01" value={f.amount_eur} onChange={(e) => setF({ ...f, amount_eur: e.target.value })} /></div>
                <div className="space-y-1"><Label>Per ora di ritardo?</Label>
                  <Select value={f.per_hour ? "y" : "n"} onValueChange={(v) => setF({ ...f, per_hour: v === "y" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="n">No (forfait)</SelectItem><SelectItem value="y">Sì (€/h)</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="flex items-end md:col-span-5"><Button disabled={add.isPending || !f.name} onClick={() => add.mutate()}>Crea regola</Button></div>
              </div>
            </CardContent>
          </Card>
          <Card><CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <tr><th className="px-4 py-2">Nome</th><th className="px-4 py-2">Trigger</th><th className="px-4 py-2 text-right">Soglia</th><th className="px-4 py-2 text-right">Importo</th><th className="px-4 py-2">Tipo</th></tr>
              </thead>
              <tbody>
                {(rules ?? []).map((r: any) => (
                  <tr key={r.id} className="border-b border-border/60">
                    <td className="px-4 py-2">{r.name}</td>
                    <td className="px-4 py-2">{r.trigger_type}</td>
                    <td className="px-4 py-2 text-right">{r.threshold_minutes} min</td>
                    <td className="px-4 py-2 text-right">€{Number(r.amount_eur).toFixed(2)}</td>
                    <td className="px-4 py-2">{r.per_hour ? "per ora" : "forfait"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}