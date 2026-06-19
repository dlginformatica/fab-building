import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/sla-escalations")({ component: Page });

const ROLES = ["super_admin","direttore","facility_manager","manutentore","fornitore","economato","viewer"] as const;
const EVENTS = ["sla_escalation_l1","sla_escalation_l2","sla_escalation_l3","sla_violated"] as const;

function Page() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ sla_rule_id: "", structure_id: "", level: "1", after_minutes: "30", notify_role: "", notify_channel_id: "", event: "sla_escalation_l1", notes: "" });

  const { data: rules = [] } = useQuery({
    queryKey: ["sla_rules-min"],
    queryFn: async () => (await supabase.from("sla_rules").select("id,name,priority,structures(name)").order("priority")).data ?? [],
  });
  const { data: structures = [] } = useQuery({
    queryKey: ["structures-min"],
    queryFn: async () => (await supabase.from("structures").select("id,name").order("name")).data ?? [],
  });
  const { data: channels = [] } = useQuery({
    queryKey: ["channels-min"],
    queryFn: async () => (await supabase.from("notification_channels").select("id,name,type,structure_id").eq("active", true).order("name")).data ?? [],
  });
  const { data: escalations = [] } = useQuery({
    queryKey: ["sla_escalation_rules"],
    queryFn: async () => (await (supabase as any).from("sla_escalation_rules")
      .select("*, sla_rules(name,priority), structures(name), notification_channels(name,type)")
      .order("level")).data ?? [],
  });

  const add = useMutation({
    mutationFn: async () => {
      const payload: any = {
        level: parseInt(form.level, 10),
        after_minutes: parseInt(form.after_minutes, 10),
        event: form.event,
        enabled: true,
        notes: form.notes || null,
      };
      if (form.sla_rule_id) payload.sla_rule_id = form.sla_rule_id;
      if (form.structure_id) payload.structure_id = form.structure_id;
      if (form.notify_role) payload.notify_role = form.notify_role;
      if (form.notify_channel_id) payload.notify_channel_id = form.notify_channel_id;
      const { error } = await (supabase as any).from("sla_escalation_rules").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Escalation aggiunta"); qc.invalidateQueries({queryKey:["sla_escalation_rules"]}); setForm({...form, after_minutes:"30", notes:""}); },
    onError: (e: Error) => toast.error(e.message),
  });
  const toggle = useMutation({
    mutationFn: async (row: any) => { const { error } = await (supabase as any).from("sla_escalation_rules").update({ enabled: !row.enabled }).eq("id", row.id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({queryKey:["sla_escalation_rules"]}),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await (supabase as any).from("sla_escalation_rules").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({queryKey:["sla_escalation_rules"]}),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-500"/>SLA — Catena di escalation</h1>
        <p className="text-sm text-muted-foreground">Configura livelli L1/L2/L3 con minuti di ritardo, destinatario (ruolo o canale) ed evento associato. Il cron orario invia automaticamente la notifica al primo livello non ancora processato.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="font-display text-base">Nuova escalation</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-7">
            <div className="space-y-1 md:col-span-2"><Label>Regola SLA (opz.)</Label>
              <Select value={form.sla_rule_id || "all"} onValueChange={(v)=>setForm({...form, sla_rule_id: v==="all"?"":v})}>
                <SelectTrigger><SelectValue placeholder="Tutte"/></SelectTrigger>
                <SelectContent><SelectItem value="all">Tutte</SelectItem>
                  {(rules as any[]).map(r=> <SelectItem key={r.id} value={r.id}>{r.name ?? r.priority} {r.structures?.name && `· ${r.structures.name}`}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Struttura (opz.)</Label>
              <Select value={form.structure_id || "all"} onValueChange={(v)=>setForm({...form, structure_id: v==="all"?"":v})}>
                <SelectTrigger><SelectValue placeholder="Tutte"/></SelectTrigger>
                <SelectContent><SelectItem value="all">Tutte</SelectItem>
                  {(structures as any[]).map(s=> <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Livello</Label>
              <Select value={form.level} onValueChange={(v)=>setForm({...form, level:v, event: v==="1"?"sla_escalation_l1":v==="2"?"sla_escalation_l2":"sla_escalation_l3"})}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>{["1","2","3","4","5"].map(l=><SelectItem key={l} value={l}>L{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Dopo (min)</Label><Input type="number" value={form.after_minutes} onChange={(e)=>setForm({...form, after_minutes:e.target.value})}/></div>
            <div className="space-y-1"><Label>Ruolo (opz.)</Label>
              <Select value={form.notify_role || "none"} onValueChange={(v)=>setForm({...form, notify_role: v==="none"?"":v})}>
                <SelectTrigger><SelectValue placeholder="—"/></SelectTrigger>
                <SelectContent><SelectItem value="none">—</SelectItem>{ROLES.map(r=><SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Canale (opz.)</Label>
              <Select value={form.notify_channel_id || "none"} onValueChange={(v)=>setForm({...form, notify_channel_id: v==="none"?"":v})}>
                <SelectTrigger><SelectValue placeholder="Auto"/></SelectTrigger>
                <SelectContent><SelectItem value="none">Auto (per evento)</SelectItem>
                  {(channels as any[]).map(c=><SelectItem key={c.id} value={c.id}>{c.name} ({c.type})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 md:col-span-6"><Label>Note</Label><Input value={form.notes} placeholder="Es. notificare reperibile spa" onChange={(e)=>setForm({...form, notes:e.target.value})}/></div>
            <div className="flex items-end"><Button className="w-full" disabled={add.isPending} onClick={()=>add.mutate()}><Plus className="mr-1 h-4 w-4"/>Aggiungi</Button></div>
          </div>
        </CardContent>
      </Card>

      <Card><CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
            <tr><th className="p-2">Livello</th><th className="p-2">Regola</th><th className="p-2">Struttura</th><th className="p-2">Dopo</th><th className="p-2">Destinatario</th><th className="p-2">Evento</th><th className="p-2">Stato</th><th></th></tr>
          </thead>
          <tbody>
            {(escalations as any[]).length === 0 && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Nessuna escalation configurata.</td></tr>}
            {(escalations as any[]).map((e)=>(
              <tr key={e.id} className="border-b border-border/60">
                <td className="p-2"><Badge>L{e.level}</Badge></td>
                <td className="p-2">{e.sla_rules?.name ?? (e.sla_rules?.priority ? `Priorità ${e.sla_rules.priority}` : "Tutte le regole")}</td>
                <td className="p-2">{e.structures?.name ?? "Globale"}</td>
                <td className="p-2">+{e.after_minutes} min</td>
                <td className="p-2 text-xs">
                  {e.notify_channel_id && e.notification_channels ? `📡 ${e.notification_channels.name} (${e.notification_channels.type})` : null}
                  {e.notify_role && <div>👤 ruolo {e.notify_role}</div>}
                  {!e.notify_channel_id && !e.notify_role && <span className="text-muted-foreground">canali sottoscritti all'evento</span>}
                </td>
                <td className="p-2 text-xs font-mono">{e.event}</td>
                <td className="p-2"><Button size="sm" variant={e.enabled?"default":"outline"} onClick={()=>toggle.mutate(e)}>{e.enabled?"Attiva":"Disattivata"}</Button></td>
                <td className="p-2 text-right"><Button size="icon" variant="ghost" onClick={()=>del.mutate(e.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent></Card>
    </div>
  );
}