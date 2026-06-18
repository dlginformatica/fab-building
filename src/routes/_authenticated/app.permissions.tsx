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

export const Route = createFileRoute("/_authenticated/app/permissions")({ component: Page });

const MODULES = [
  "tickets","assets","maintenance","inventory","suppliers","contracts","work_orders",
  "purchase_orders","utilities","invoices","reports","sla","penalties","users","audit","docs","settings","messages","statistics"
];
const ACTIONS = ["view","create","edit","delete","export","*"];
const ROLES = ["super_admin","direttore","facility_manager","manutentore","fornitore","economato","viewer"];

function Page() {
  const qc = useQueryClient();
  const [f, setF] = useState({ scope: "role", role: "manutentore", email: "", module: "tickets", action: "view", structure_id: "" });

  const { data: rows } = useQuery({
    queryKey: ["perms"],
    queryFn: async () => ((await (supabase as any).from("module_permissions").select("*").order("created_at",{ascending:false})).data ?? []),
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
      let user_id: string | null = null;
      let role: string | null = null;
      if (f.scope === "user") {
        const p = (profiles ?? []).find((x) => x.email?.toLowerCase() === f.email.toLowerCase());
        if (!p) throw new Error("Utente non trovato");
        user_id = p.id;
      } else role = f.role;
      const { error } = await (supabase as any).from("module_permissions").insert({
        user_id, role, module: f.module, action: f.action,
        structure_id: f.structure_id || null, allowed: true,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Permesso aggiunto"); qc.invalidateQueries({ queryKey: ["perms"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await (supabase as any).from("module_permissions").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["perms"] }),
  });

  return (
    <div className="space-y-6">
      <div><h1 className="font-display text-2xl font-bold">Permessi per funzione</h1>
        <p className="text-sm text-muted-foreground">Profilazione granulare per utente o ruolo, opzionalmente per struttura.</p></div>
      <Card>
        <CardHeader><CardTitle className="font-display text-base">Nuovo permesso</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-6">
            <div className="space-y-1"><Label>Scope</Label>
              <Select value={f.scope} onValueChange={(v) => setF({ ...f, scope: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="role">Per ruolo</SelectItem><SelectItem value="user">Per utente</SelectItem></SelectContent>
              </Select>
            </div>
            {f.scope === "role" ? (
              <div className="space-y-1"><Label>Ruolo</Label>
                <Select value={f.role} onValueChange={(v) => setF({ ...f, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1"><Label>Email utente</Label><Input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
            )}
            <div className="space-y-1"><Label>Modulo</Label>
              <Select value={f.module} onValueChange={(v) => setF({ ...f, module: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{MODULES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Azione</Label>
              <Select value={f.action} onValueChange={(v) => setF({ ...f, action: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ACTIONS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Struttura (vuoto = tutte)</Label>
              <Select value={f.structure_id} onValueChange={(v) => setF({ ...f, structure_id: v })}>
                <SelectTrigger><SelectValue placeholder="Tutte" /></SelectTrigger>
                <SelectContent>{(structures ?? []).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-end"><Button className="w-full" disabled={add.isPending} onClick={() => add.mutate()}>Aggiungi</Button></div>
          </div>
        </CardContent>
      </Card>
      <Card><CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
            <tr><th className="px-4 py-2">Soggetto</th><th className="px-4 py-2">Modulo</th><th className="px-4 py-2">Azione</th><th className="px-4 py-2">Struttura</th><th></th></tr>
          </thead>
          <tbody>
            {(rows ?? []).map((r: any) => {
              const p = (profiles ?? []).find(x => x.id === r.user_id);
              const s = (structures ?? []).find(x => x.id === r.structure_id);
              return (
                <tr key={r.id} className="border-b border-border/60">
                  <td className="px-4 py-2">{r.user_id ? (p?.email ?? "utente") : `ruolo: ${r.role}`}</td>
                  <td className="px-4 py-2 font-mono text-xs">{r.module}</td>
                  <td className="px-4 py-2">{r.action}</td>
                  <td className="px-4 py-2">{s?.name ?? "Tutte"}</td>
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