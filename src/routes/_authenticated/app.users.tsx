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

const ROLES = ["super_admin","direttore","facility_manager","manutentore","fornitore","economato","viewer"] as const;

export const Route = createFileRoute("/_authenticated/app/users")({ component: Page });

function Page() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ email: "", role: "manutentore", structure_id: "" });

  const { data: roles } = useQuery({
    queryKey: ["user_roles_all"],
    queryFn: async () => (await supabase.from("user_roles").select("*")).data ?? [],
  });
  const { data: profiles } = useQuery({
    queryKey: ["profiles_all"],
    queryFn: async () => (await supabase.from("profiles").select("id,email,full_name")).data ?? [],
  });
  const { data: structures } = useQuery({
    queryKey: ["structures-list"],
    queryFn: async () => (await supabase.from("structures").select("id,name").order("name")).data ?? [],
  });

  const add = useMutation({
    mutationFn: async () => {
      const p = (profiles ?? []).find((x) => x.email?.toLowerCase() === form.email.toLowerCase());
      if (!p) throw new Error("Utente non trovato. Deve prima registrarsi.");
      const { error } = await supabase.from("user_roles").insert({
        user_id: p.id, role: form.role as typeof ROLES[number],
        structure_id: form.structure_id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Ruolo assegnato"); qc.invalidateQueries({ queryKey: ["user_roles_all"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Utenti & Ruoli</h1>
      <Card>
        <CardHeader><CardTitle className="font-display text-base">Assegna ruolo</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="space-y-1"><Label>Email utente</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="user@example.com" /></div>
            <div className="space-y-1">
              <Label>Ruolo</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Struttura (vuoto = tutte)</Label>
              <Select value={form.structure_id} onValueChange={(v) => setForm({ ...form, structure_id: v })}>
                <SelectTrigger><SelectValue placeholder="Tutte" /></SelectTrigger>
                <SelectContent>{(structures ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-end"><Button className="w-full" disabled={!form.email || add.isPending} onClick={() => add.mutate()}>Assegna</Button></div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Suggerimento: per il primo super_admin, dopo aver registrato l'account, inserisci manualmente in user_roles un record con role='super_admin'.</p>
        </CardContent>
      </Card>
      <Card><CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
            <tr><th className="px-4 py-2">Utente</th><th className="px-4 py-2">Email</th><th className="px-4 py-2">Ruolo</th><th className="px-4 py-2">Struttura</th></tr>
          </thead>
          <tbody>
            {(roles ?? []).map((r) => {
              const p = (profiles ?? []).find((x) => x.id === r.user_id);
              const s = (structures ?? []).find((x) => x.id === r.structure_id);
              return (
                <tr key={r.id} className="border-b border-border/60">
                  <td className="px-4 py-2">{p?.full_name ?? "—"}</td>
                  <td className="px-4 py-2 font-mono text-xs">{p?.email ?? "—"}</td>
                  <td className="px-4 py-2">{r.role}</td>
                  <td className="px-4 py-2">{s?.name ?? "Globale"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent></Card>
    </div>
  );
}