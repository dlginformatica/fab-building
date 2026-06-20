import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Mail, MessageSquare, Plus, Send, Trash2, FileText, Save } from "lucide-react";
import { fmtDateTime } from "@/lib/format";
import { toast } from "sonner";
import { sendTestNotification } from "@/lib/notifications.functions";

export const Route = createFileRoute("/_authenticated/app/notifications")({ component: Page });

const EVENTS = [
  { value: "ticket_created", label: "Ticket creato" },
  { value: "ticket_assigned", label: "Ticket assegnato" },
  { value: "sla_warning", label: "SLA in scadenza" },
  { value: "sla_violated", label: "SLA violato" },
  { value: "workflow_step", label: "Avanzamento workflow" },
  { value: "invoice_due", label: "Fattura in scadenza" },
  { value: "maintenance_due", label: "Manutenzione programmata" },
] as const;

function TemplateEditor({ tpl, onSave, onDelete }: { tpl: any; onSave: (v: any) => void; onDelete: () => void }) {
  const [v, setV] = useState({ id: tpl.id, name: tpl.name, event: tpl.event, channel_type: tpl.channel_type, subject: tpl.subject, body_md: tpl.body_md, active: tpl.active });
  return (
    <Card>
      <CardContent className="pt-4 space-y-2">
        <div className="grid gap-2 md:grid-cols-4">
          <div><Label className="text-xs">Nome</Label><Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })}/></div>
          <div>
            <Label className="text-xs">Evento</Label>
            <Select value={v.event} onValueChange={(x) => setV({ ...v, event: x })}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="sla_warning">SLA in scadenza</SelectItem>
                <SelectItem value="sla_violated">SLA violato</SelectItem>
                <SelectItem value="ticket_created">Ticket creato</SelectItem>
                <SelectItem value="ticket_assigned">Ticket assegnato</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Canale</Label>
            <Select value={v.channel_type} onValueChange={(x) => setV({ ...v, channel_type: x })}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="teams">Teams</SelectItem>
                <SelectItem value="push">Push in-app</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2"><Switch checked={v.active} onCheckedChange={(x) => setV({ ...v, active: x })}/><Label>Attivo</Label></div>
        </div>
        <div><Label className="text-xs">Oggetto</Label><Input value={v.subject} onChange={(e) => setV({ ...v, subject: e.target.value })}/></div>
        <div><Label className="text-xs">Corpo (markdown / placeholder)</Label><Textarea rows={4} value={v.body_md} onChange={(e) => setV({ ...v, body_md: e.target.value })}/></div>
        <div className="flex gap-2 justify-end">
          <Button size="sm" variant="ghost" onClick={onDelete}><Trash2 className="h-4 w-4"/></Button>
          <Button size="sm" onClick={() => onSave(v)}><Save className="h-4 w-4 mr-1"/>Salva</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Page() {
  const qc = useQueryClient();
  const test = useServerFn(sendTestNotification);

  const { data: structures = [] } = useQuery({
    queryKey: ["structures-min"],
    queryFn: async () => (await supabase.from("structures").select("id,name").order("name")).data ?? [],
  });
  const { data: channels = [] } = useQuery({
    queryKey: ["notif_channels"],
    queryFn: async () => (await (supabase as any).from("notification_channels").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  const { data: logs = [] } = useQuery({
    queryKey: ["notif_log"],
    queryFn: async () => (await (supabase as any).from("notification_log").select("*").order("created_at", { ascending: false }).limit(100)).data ?? [],
  });
  const { data: templates = [] } = useQuery({
    queryKey: ["notif_templates"],
    queryFn: async () => (await (supabase as any).from("notification_templates").select("*").order("event").order("channel_type")).data ?? [],
  });

  const saveTpl = useMutation({
    mutationFn: async (t: any) => {
      const { id, ...patch } = t;
      const { error } = await (supabase as any).from("notification_templates").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Template salvato"); qc.invalidateQueries({ queryKey: ["notif_templates"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const newTpl = useMutation({
    mutationFn: async () => {
      const user = (await supabase.auth.getUser()).data.user;
      const { error } = await (supabase as any).from("notification_templates").insert({
        event: "sla_violated", channel_type: "email", name: "Nuovo template",
        subject: "[HotelOps] {{ticket_number}}", body_md: "Ticket {{ticket_number}} — {{title}}",
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notif_templates"] }),
  });
  const delTpl = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("notification_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Template eliminato"); qc.invalidateQueries({ queryKey: ["notif_templates"] }); },
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ name: string; type: "email"|"teams"; target: string; structure_id: string; events: string[]; active: boolean }>({
    name: "", type: "teams", target: "", structure_id: "", events: ["ticket_created","sla_violated"], active: true,
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name || !form.target) throw new Error("Nome e destinazione obbligatori");
      const user = (await supabase.auth.getUser()).data.user;
      const { error } = await (supabase as any).from("notification_channels").insert({
        name: form.name, type: form.type, target: form.target,
        structure_id: form.structure_id || null,
        events: form.events, active: form.active, created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Canale creato"); setOpen(false); setForm({ ...form, name: "", target: "" }); qc.invalidateQueries({ queryKey: ["notif_channels"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await (supabase as any).from("notification_channels").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notif_channels"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("notification_channels").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Canale eliminato"); qc.invalidateQueries({ queryKey: ["notif_channels"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendTest = useMutation({
    mutationFn: async (id: string) => await test({ data: { channel_id: id } }),
    onSuccess: () => { toast.success("Test inviato"); qc.invalidateQueries({ queryKey: ["notif_log"] }); },
    onError: (e: Error) => toast.error(`Errore test: ${e.message}`),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2"><Mail className="h-5 w-5"/>Notifiche Email & Teams</h1>
          <p className="text-sm text-muted-foreground">Canali di notifica multi-evento verso indirizzi email e webhook Microsoft Teams.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4"/>Nuovo canale</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Nuovo canale di notifica</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Team manutenzione"/></div>
                <div>
                  <Label>Tipo</Label>
                  <Select value={form.type} onValueChange={(v: any) => setForm({ ...form, type: v })}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="teams">Microsoft Teams (webhook)</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>{form.type === "teams" ? "URL webhook Teams" : "Indirizzo email"}</Label>
                <Input value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })}
                  placeholder={form.type === "teams" ? "https://outlook.office.com/webhook/..." : "team@hotel.it"}/>
              </div>
              <div>
                <Label>Struttura</Label>
                <Select value={form.structure_id || "all"} onValueChange={(v) => setForm({ ...form, structure_id: v === "all" ? "" : v })}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutte le strutture</SelectItem>
                    {structures.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Eventi sottoscritti</Label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {EVENTS.map((ev) => {
                    const on = form.events.includes(ev.value);
                    return (
                      <label key={ev.value} className="flex items-center gap-2 rounded-md border p-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={on} onChange={(e) => setForm({ ...form, events: e.target.checked ? [...form.events, ev.value] : form.events.filter((x) => x !== ev.value) })}/>
                        {ev.label}
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center gap-2"><Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })}/><Label>Attivo</Label></div>
            </div>
            <DialogFooter><Button onClick={() => save.mutate()} disabled={save.isPending}>Crea canale</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="channels">
        <TabsList>
          <TabsTrigger value="channels">Canali</TabsTrigger>
          <TabsTrigger value="templates">Template</TabsTrigger>
          <TabsTrigger value="log">Log invii</TabsTrigger>
        </TabsList>
        <TabsContent value="channels" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="font-display text-base">Canali configurati ({channels.length})</CardTitle></CardHeader>
            <CardContent>
              {channels.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nessun canale. Aggiungi un webhook Teams o un indirizzo email per iniziare.</p>
              ) : (
                <div className="space-y-2">
                  {channels.map((c: any) => (
                    <div key={c.id} className="flex items-center justify-between rounded-md border p-3">
                      <div className="flex items-start gap-3">
                        {c.type === "teams" ? <MessageSquare className="h-4 w-4 mt-0.5 text-primary"/> : <Mail className="h-4 w-4 mt-0.5 text-primary"/>}
                        <div>
                          <div className="font-medium text-sm">{c.name} <Badge variant="outline" className="ml-1">{c.type}</Badge></div>
                          <div className="text-xs text-muted-foreground truncate max-w-md">{c.target}</div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {(c.events ?? []).map((e: string) => <Badge key={e} variant="secondary" className="text-[10px]">{EVENTS.find(x => x.value === e)?.label ?? e}</Badge>)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch checked={c.active} onCheckedChange={(v) => toggle.mutate({ id: c.id, active: v })}/>
                        <Button size="sm" variant="outline" onClick={() => sendTest.mutate(c.id)} disabled={sendTest.isPending}><Send className="h-3.5 w-3.5 mr-1"/>Test</Button>
                        <Button size="sm" variant="ghost" onClick={() => { if (confirm("Eliminare il canale?")) remove.mutate(c.id); }}><Trash2 className="h-3.5 w-3.5"/></Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="templates" className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Template editabili per evento e canale. Placeholder disponibili: <code>{"{{ticket_number}}"}</code>, <code>{"{{title}}"}</code>, <code>{"{{priority}}"}</code>, <code>{"{{due_at}}"}</code>, <code>{"{{delay_minutes}}"}</code>.</p>
            <Button size="sm" onClick={() => newTpl.mutate()}><Plus className="h-4 w-4 mr-1"/>Nuovo</Button>
          </div>
          <div className="space-y-3">
            {templates.map((t: any) => <TemplateEditor key={t.id} tpl={t} onSave={(v) => saveTpl.mutate(v)} onDelete={() => { if (confirm("Eliminare?")) delTpl.mutate(t.id); }}/>)}
            {templates.length === 0 && <p className="text-sm text-muted-foreground">Nessun template.</p>}
          </div>
        </TabsContent>
        <TabsContent value="log" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="font-display text-base">Ultimi invii ({logs.length})</CardTitle></CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nessun invio registrato.</p>
              ) : (
                <div className="space-y-1">
                  {logs.map((l: any) => (
                    <div key={l.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Badge variant={l.status === "ok" ? "secondary" : "destructive"}>{l.status}</Badge>
                        <span className="font-mono text-xs">{l.channel_type}</span>
                        <span>{l.event}</span>
                        <span className="text-muted-foreground truncate max-w-xs">→ {l.target}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">{fmtDateTime(l.created_at)}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}