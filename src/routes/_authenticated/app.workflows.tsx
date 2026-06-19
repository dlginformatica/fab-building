import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useActiveStructure } from "@/lib/structure-context";
import { fmtDateTime } from "@/lib/format";
import { ArrowRight, Plus, Play, Trash2, CheckCircle2, XCircle, Workflow } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/workflows")({ component: Page });

const STEP_TYPES = ["approval","action","notification","wait","condition","form"] as const;
const TRIGGERS = ["manual","ticket_opened","ticket_resolved","contract_expiring","invoice_received","asset_created","maintenance_due","custom"] as const;
const ROLES = ["super_admin","direttore","facility_manager","manutentore","fornitore","economato","viewer"] as const;

function Page() {
  const qc = useQueryClient();
  const { activeStructureId } = useActiveStructure();
  const [selected, setSelected] = useState<string | null>(null);
  const [newWf, setNewWf] = useState({ name: "", description: "", trigger_type: "manual" });

  const { data: workflows } = useQuery({
    queryKey: ["workflows", activeStructureId],
    queryFn: async () => {
      let q = (supabase as any).from("workflows").select("*").order("created_at",{ascending:false});
      if (activeStructureId) q = q.or(`structure_id.eq.${activeStructureId},structure_id.is.null`);
      return (await q).data ?? [];
    },
  });

  const { data: instances } = useQuery({
    queryKey: ["workflow_instances", activeStructureId],
    queryFn: async () => {
      let q = (supabase as any).from("workflow_instances")
        .select("*, workflows(name), workflow_steps:current_step_id(name)")
        .order("started_at",{ascending:false}).limit(100);
      if (activeStructureId) q = q.eq("structure_id", activeStructureId);
      return (await q).data ?? [];
    },
  });

  const createWf = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("workflows").insert({
        ...newWf, structure_id: activeStructureId, created_by: (await supabase.auth.getUser()).data.user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Procedura creata"); qc.invalidateQueries({ queryKey: ["workflows"] }); setNewWf({ name:"",description:"",trigger_type:"manual" }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await (supabase as any).from("workflows").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workflows"] }),
  });

  const startInstance = useMutation({
    mutationFn: async (wf: any) => {
      const { data: steps } = await (supabase as any).from("workflow_steps").select("*").eq("workflow_id", wf.id).order("position");
      const first = steps?.[0];
      const user = (await supabase.auth.getUser()).data.user;
      const { error } = await (supabase as any).from("workflow_instances").insert({
        workflow_id: wf.id, structure_id: wf.structure_id ?? activeStructureId, current_step_id: first?.id ?? null,
        started_by: user?.id, status: first ? "running" : "completed", completed_at: first ? null : new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Istanza avviata"); qc.invalidateQueries({ queryKey: ["workflow_instances"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeWf = useMutation({
    mutationFn: async (id: string) => { const { error } = await (supabase as any).from("workflows").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Procedura eliminata"); qc.invalidateQueries({ queryKey: ["workflows"] }); setSelected(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold flex items-center gap-2"><Workflow className="h-6 w-6" />Workflow & Procedure</h1>
        <p className="text-sm text-muted-foreground">Definisci procedure operative multi-step con approvazioni, azioni e SLA.</p>
      </div>

      <Tabs defaultValue="definitions">
        <TabsList>
          <TabsTrigger value="definitions">Procedure ({(workflows ?? []).length})</TabsTrigger>
          <TabsTrigger value="instances">Esecuzioni ({(instances ?? []).length})</TabsTrigger>
        </TabsList>

        <TabsContent value="definitions" className="space-y-3">
          <Card>
            <CardHeader><CardTitle className="font-display text-base">Nuova procedura</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-4">
                <div className="space-y-1 md:col-span-2"><Label>Nome</Label><Input value={newWf.name} onChange={(e) => setNewWf({ ...newWf, name: e.target.value })} placeholder="es. Approvazione ordine > 500€" /></div>
                <div className="space-y-1"><Label>Trigger</Label>
                  <Select value={newWf.trigger_type} onValueChange={(v) => setNewWf({ ...newWf, trigger_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TRIGGERS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="flex items-end"><Button disabled={createWf.isPending || !newWf.name} onClick={() => createWf.mutate()}><Plus className="h-4 w-4 mr-1" />Crea</Button></div>
                <div className="space-y-1 md:col-span-4"><Label>Descrizione</Label><Textarea value={newWf.description} onChange={(e) => setNewWf({ ...newWf, description: e.target.value })} rows={2} /></div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-3 lg:grid-cols-2">
            {(workflows ?? []).map((w: any) => (
              <Card key={w.id} className={selected === w.id ? "border-primary" : ""}>
                <CardHeader className="flex flex-row items-start justify-between gap-2">
                  <div>
                    <CardTitle className="font-display text-base">{w.name}</CardTitle>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                      <Badge variant={w.active ? "default" : "secondary"}>{w.active ? "attiva" : "disattiva"}</Badge>
                      <Badge variant="outline">{w.trigger_type}</Badge>
                      <span className="text-muted-foreground">v{w.version}</span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => startInstance.mutate(w)} disabled={!w.active}><Play className="h-3 w-3" /></Button>
                    <Button size="sm" variant="outline" onClick={() => toggleActive.mutate({ id: w.id, active: !w.active })}>{w.active ? "Off" : "On"}</Button>
                    <Button size="sm" variant="outline" onClick={() => setSelected(selected === w.id ? null : w.id)}>Step</Button>
                    <Button size="sm" variant="ghost" onClick={() => { if (confirm("Eliminare?")) removeWf.mutate(w.id); }}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </CardHeader>
                {w.description && <CardContent className="pt-0 text-sm text-muted-foreground">{w.description}</CardContent>}
                {selected === w.id && <CardContent><StepsEditor workflowId={w.id} /></CardContent>}
              </Card>
            ))}
            {(workflows ?? []).length === 0 && <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Nessuna procedura definita.</CardContent></Card>}
          </div>
        </TabsContent>

        <TabsContent value="instances" className="space-y-3">
          <Card><CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <tr><th className="px-4 py-2">Avviata</th><th className="px-4 py-2">Procedura</th><th className="px-4 py-2">Step corrente</th><th className="px-4 py-2">Stato</th><th className="px-4 py-2">Azioni</th></tr>
              </thead>
              <tbody>
                {(instances ?? []).map((i: any) => (
                  <tr key={i.id} className="border-b border-border/60">
                    <td className="px-4 py-2 text-xs">{fmtDateTime(i.started_at)}</td>
                    <td className="px-4 py-2">{i.workflows?.name}</td>
                    <td className="px-4 py-2">{i.workflow_steps?.name ?? <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-4 py-2"><InstanceStatus status={i.status} /></td>
                    <td className="px-4 py-2"><InstanceActions instance={i} /></td>
                  </tr>
                ))}
                {(instances ?? []).length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Nessuna esecuzione.</td></tr>}
              </tbody>
            </table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InstanceStatus({ status }: { status: string }) {
  const map: Record<string, string> = { running: "default", completed: "secondary", cancelled: "outline", failed: "destructive", waiting: "outline" };
  return <Badge variant={(map[status] ?? "outline") as any}>{status}</Badge>;
}

function InstanceActions({ instance }: { instance: any }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");

  const transition = useMutation({
    mutationFn: async (outcome: string) => {
      const user = (await supabase.auth.getUser()).data.user;
      const { data: steps } = await (supabase as any).from("workflow_steps").select("*").eq("workflow_id", instance.workflow_id).order("position");
      const cur = steps?.find((s: any) => s.id === instance.current_step_id);
      const next = cur ? steps?.find((s: any) => s.position > cur.position) : null;
      const finalStatus = outcome === "rejected" || outcome === "cancelled" ? "cancelled" : (next ? "running" : "completed");
      await (supabase as any).from("workflow_transitions").insert({
        instance_id: instance.id, from_step_id: instance.current_step_id, to_step_id: next?.id ?? null,
        actor_id: user?.id, outcome, note,
      });
      const { error } = await (supabase as any).from("workflow_instances").update({
        status: finalStatus, current_step_id: next?.id ?? null,
        completed_at: finalStatus === "completed" || finalStatus === "cancelled" ? new Date().toISOString() : null,
      }).eq("id", instance.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Step registrato"); qc.invalidateQueries({ queryKey: ["workflow_instances"] }); setOpen(false); setNote(""); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (instance.status !== "running" && instance.status !== "waiting") return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline"><ArrowRight className="h-3 w-3 mr-1" />Avanza</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Avanzamento step</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>Nota</Label><Textarea value={note} onChange={(e) => setNote(e.target.value)} /></div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => transition.mutate("approved")}><CheckCircle2 className="h-3 w-3 mr-1" />Approva</Button>
            <Button size="sm" variant="secondary" onClick={() => transition.mutate("completed")}>Completa</Button>
            <Button size="sm" variant="outline" onClick={() => transition.mutate("skipped")}>Salta</Button>
            <Button size="sm" variant="destructive" onClick={() => transition.mutate("rejected")}><XCircle className="h-3 w-3 mr-1" />Rifiuta</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StepsEditor({ workflowId }: { workflowId: string }) {
  const qc = useQueryClient();
  const [s, setS] = useState({ name: "", step_type: "approval", assignee_role: "facility_manager", sla_minutes: "" });

  const { data: steps } = useQuery({
    queryKey: ["workflow_steps", workflowId],
    queryFn: async () => ((await (supabase as any).from("workflow_steps").select("*").eq("workflow_id", workflowId).order("position")).data ?? []),
  });

  const add = useMutation({
    mutationFn: async () => {
      const next = ((steps ?? []).at(-1)?.position ?? 0) + 1;
      const { error } = await (supabase as any).from("workflow_steps").insert({
        workflow_id: workflowId, position: next, name: s.name, step_type: s.step_type,
        assignee_role: s.assignee_role || null, sla_minutes: s.sla_minutes ? Number(s.sla_minutes) : null,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["workflow_steps", workflowId] }); setS({ name:"",step_type:"approval",assignee_role:"facility_manager",sla_minutes:"" }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await (supabase as any).from("workflow_steps").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workflow_steps", workflowId] }),
  });

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        {(steps ?? []).map((st: any, i: number) => (
          <div key={st.id} className="flex items-center gap-2 rounded-md border border-border p-2 text-sm">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-muted text-xs font-bold">{i + 1}</span>
            <span className="flex-1">{st.name}</span>
            <Badge variant="outline" className="text-xs">{st.step_type}</Badge>
            {st.assignee_role && <Badge variant="secondary" className="text-xs">{st.assignee_role}</Badge>}
            {st.sla_minutes && <span className="text-xs text-muted-foreground">SLA {st.sla_minutes}min</span>}
            <Button size="sm" variant="ghost" onClick={() => del.mutate(st.id)}><Trash2 className="h-3 w-3" /></Button>
          </div>
        ))}
      </div>
      <div className="grid gap-2 md:grid-cols-5 rounded-md border border-dashed border-border p-3">
        <Input className="md:col-span-2" placeholder="Nome step" value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} />
        <Select value={s.step_type} onValueChange={(v) => setS({ ...s, step_type: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{STEP_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={s.assignee_role} onValueChange={(v) => setS({ ...s, assignee_role: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
        </Select>
        <Input type="number" placeholder="SLA min" value={s.sla_minutes} onChange={(e) => setS({ ...s, sla_minutes: e.target.value })} />
        <Button className="md:col-span-5" size="sm" disabled={add.isPending || !s.name} onClick={() => add.mutate()}><Plus className="h-4 w-4 mr-1" />Aggiungi step</Button>
      </div>
    </div>
  );
}