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
import { Trash2 } from "lucide-react";
import { fmtDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/app/delegations")({ component: Page });

function Page() {
  const qc = useQueryClient();
  const [f, setF] = useState({ delegate_email: "", structure_id: "", modules: "*", starts_at: "", ends_at: "", reason: "" });

  const { data: profiles } = useQuery({
    queryKey: ["profiles_all"],
    queryFn: async () => (await supabase.from("profiles").select("id,email,full_name")).data ?? [],
  });
  const { data: structures } = useQuery({
    queryKey: ["structures-list"],
    queryFn: async () => (await supabase.from("structures").select("id,name").order("name")).data ?? [],
  });
  const { data: rows } = useQuery({
    queryKey: ["delegations"],
    queryFn: async () => ((await (supabase as any).from("user_delegations").select("*").order("created_at",{ascending:false})).data ?? []),
  });

  const add = useMutation({
    mutationFn: async () => {
      const user = (await supabase.auth.getUser()).data.user;
      const p = (profiles ?? []).find(x => x.email?.toLowerCase() === f.delegate_email.toLowerCase());
      if (!p) throw new Error("Delegato non trovato");
      const { error } = await (supabase as any).from("user_delegations").insert({
        delegator_id: user?.id, delegate_id: p.id,
        structure_id: f.structure_id || null,
        modules: f.modules.split(",").map(s => s.trim()).filter(Boolean),
        starts_at: f.starts_at || new Date().toISOString(),
        ends_at: f.ends_at || null,
        reason: f.reason || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Delega creata"); qc.invalidateQueries({ queryKey: ["delegations"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const toggle = useMutation({
    mutationFn: async (r: any) => { const { error } = await (supabase as any).from("user_delegations").update({ active: !r.active }).eq("id", r.id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["delegations"] }),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await (supabase as any).from("user_delegations").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["delegations"] }),
  });

  return (
    <div className="space-y-6">
      <div><h1 className="font-display text-2xl font-bold">Deleghe</h1>
        <p className="text-sm text-muted-foreground">Trasferisci temporaneamente i tuoi diritti a un altro utente.</p></div>
      <Card>
        <CardHeader><CardTitle className="font-display text-base">Nuova delega</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1 md:col-span-1"><Label>Email delegato</Label><Input value={f.delegate_email} onChange={(e) => setF({ ...f, delegate_email: e.target.value })} /></div>
            <div className="space-y-1"><Label>Struttura</Label>
              <Select value={f.structure_id} onValueChange={(v) => setF({ ...f, structure_id: v })}>
                <SelectTrigger><SelectValue placeholder="Tutte" /></SelectTrigger>
                <SelectContent>{(structures ?? []).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Moduli (csv, * = tutti)</Label><Input value={f.modules} onChange={(e) => setF({ ...f, modules: e.target.value })} /></div>
            <div className="space-y-1"><Label>Inizio</Label><Input type="datetime-local" value={f.starts_at} onChange={(e) => setF({ ...f, starts_at: e.target.value })} /></div>
            <div className="space-y-1"><Label>Fine</Label><Input type="datetime-local" value={f.ends_at} onChange={(e) => setF({ ...f, ends_at: e.target.value })} /></div>
            <div className="space-y-1 md:col-span-1"><Label>Motivo</Label><Input value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></div>
          </div>
          <Button className="mt-3" disabled={add.isPending} onClick={() => add.mutate()}>Crea delega</Button>
        </CardContent>
      </Card>
      <Card><CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
            <tr><th className="px-4 py-2">Da</th><th className="px-4 py-2">A</th><th className="px-4 py-2">Moduli</th><th className="px-4 py-2">Periodo</th><th className="px-4 py-2">Stato</th><th></th></tr>
          </thead>
          <tbody>
            {(rows ?? []).map((r: any) => {
              const a = (profiles ?? []).find(x => x.id === r.delegator_id);
              const b = (profiles ?? []).find(x => x.id === r.delegate_id);
              return (
                <tr key={r.id} className="border-b border-border/60">
                  <td className="px-4 py-2 text-xs">{a?.email ?? "—"}</td>
                  <td className="px-4 py-2 text-xs">{b?.email ?? "—"}</td>
                  <td className="px-4 py-2 font-mono text-xs">{(r.modules ?? []).join(", ")}</td>
                  <td className="px-4 py-2 text-xs">{fmtDateTime(r.starts_at)} → {r.ends_at ? fmtDateTime(r.ends_at) : "∞"}</td>
                  <td className="px-4 py-2">
                    <button onClick={() => toggle.mutate(r)} className={`rounded-md px-2 py-0.5 text-xs ${r.active ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"}`}>{r.active ? "attiva" : "sospesa"}</button>
                  </td>
                  <td className="px-4 py-2 text-right"><Button size="icon" variant="ghost" onClick={() => del.mutate(r.id)}><Trash2 className="h-4 w-4" /></Button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent></Card>
    </div>
  );
}