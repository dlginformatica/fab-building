import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveStructure } from "@/lib/structure-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { SimpleList, ListCard } from "@/components/SimpleList";
import { Plus, Camera, CheckCircle2, History, CalendarDays, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, addMonths, isSameDay, parseISO } from "date-fns";
import { it } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/app/maintenance")({ component: Page });

function Page() {
  const qc = useQueryClient();
  const { activeStructureId } = useActiveStructure();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name:"", description:"", frequency:"mensile", interval_days:"", next_due:"", asset_id:"", supplier_id:"", checklist:"" });
  const { data: assets = [] } = useQuery({ queryKey:["assets-m", activeStructureId], enabled:!!activeStructureId,
    queryFn: async()=> (await supabase.from("assets").select("id,name,code").eq("structure_id",activeStructureId!).order("name")).data ?? [] });
  const { data: suppliers = [] } = useQuery({ queryKey:["sup-m"], queryFn: async()=> (await supabase.from("suppliers").select("id,name").order("name")).data ?? [] });
  const { data: items = [] } = useQuery({
    queryKey: ["maintenance", activeStructureId], enabled: !!activeStructureId,
    queryFn: async () => (await supabase.from("maintenance_plans").select("*, assets(name,code), suppliers(name)").eq("structure_id", activeStructureId!).order("next_due",{ascending:true,nullsFirst:false})).data ?? [],
  });
  const mut = useMutation({
    mutationFn: async () => {
      const checklist = form.checklist.split("\n").map(s=>s.trim()).filter(Boolean).map((label,i)=>({id:i,label,done:false}));
      const { error } = await supabase.from("maintenance_plans").insert({
        structure_id: activeStructureId!, name: form.name, description: form.description || null,
        frequency: form.frequency as any, interval_days: form.interval_days ? parseInt(form.interval_days) : null,
        next_due: form.next_due || null, asset_id: form.asset_id || null, supplier_id: form.supplier_id || null,
        checklist,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Piano creato"); qc.invalidateQueries({queryKey:["maintenance"]}); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  if (!activeStructureId) return <div className="p-10 text-center text-sm text-muted-foreground">Seleziona una struttura.</div>;
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Manutenzione programmata</h1>
          <p className="text-sm text-muted-foreground">Piani preventivi, calendario interventi, checklist operatore e storico.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4"/>Nuovo piano</Button></DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nuovo piano di manutenzione</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1"><Label>Nome *</Label><Input value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})}/></div>
              <div className="space-y-1"><Label>Descrizione</Label><Textarea rows={2} value={form.description} onChange={(e)=>setForm({...form,description:e.target.value})}/></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Frequenza</Label>
                  <Select value={form.frequency} onValueChange={(v)=>setForm({...form,frequency:v})}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>{["giornaliera","settimanale","mensile","trimestrale","semestrale","annuale","custom"].map(x=><SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Ogni N giorni (custom)</Label><Input type="number" value={form.interval_days} onChange={(e)=>setForm({...form,interval_days:e.target.value})}/></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Prossima scadenza</Label><Input type="date" value={form.next_due} onChange={(e)=>setForm({...form,next_due:e.target.value})}/></div>
                <div className="space-y-1"><Label>Asset</Label>
                  <Select value={form.asset_id} onValueChange={(v)=>setForm({...form,asset_id:v})}>
                    <SelectTrigger><SelectValue placeholder="—"/></SelectTrigger>
                    <SelectContent>{assets.map((a:any)=><SelectItem key={a.id} value={a.id}>{a.code} · {a.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1"><Label>Fornitore</Label>
                <Select value={form.supplier_id} onValueChange={(v)=>setForm({...form,supplier_id:v})}>
                  <SelectTrigger><SelectValue placeholder="—"/></SelectTrigger>
                  <SelectContent>{suppliers.map((s:any)=><SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Checklist (una riga per voce)</Label><Textarea rows={4} placeholder="Verifica pressione&#10;Sostituisci filtri&#10;…" value={form.checklist} onChange={(e)=>setForm({...form,checklist:e.target.value})}/></div>
              <Button disabled={!form.name || mut.isPending} className="w-full" onClick={()=>mut.mutate()}>Crea</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="plans" className="space-y-4">
        <TabsList>
          <TabsTrigger value="plans"><ClipboardList className="mr-1 h-4 w-4"/>Piani</TabsTrigger>
          <TabsTrigger value="calendar"><CalendarDays className="mr-1 h-4 w-4"/>Calendario</TabsTrigger>
          <TabsTrigger value="history"><History className="mr-1 h-4 w-4"/>Storico interventi</TabsTrigger>
        </TabsList>

        <TabsContent value="plans">
          {items.length === 0 ? (
            <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">Nessun piano.</div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {items.map((p:any)=>(
                <ListCard key={p.id} title={p.name} meta={<>{p.assets?.name ?? "—"} · ogni {p.frequency}</>}
                  badges={p.active ? <Badge>attivo</Badge> : <Badge variant="outline">off</Badge>}
                  footer={<div>{p.next_due && <div>Prossima: <b>{p.next_due}</b></div>}{p.suppliers && <div>👷 {p.suppliers.name}</div>}<div>{(p.checklist as any[])?.length ?? 0} voci checklist</div></div>}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="calendar">
          <MaintenanceCalendar structureId={activeStructureId} plans={items as any[]} />
        </TabsContent>

        <TabsContent value="history">
          <MaintenanceHistory structureId={activeStructureId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MaintenanceCalendar({ structureId, plans }: { structureId: string; plans: any[] }) {
  const qc = useQueryClient();
  const [month, setMonth] = useState<Date>(new Date());
  const [selected, setSelected] = useState<Date | undefined>(new Date());
  const planIds = plans.map(p => p.id);
  const from = format(startOfMonth(month), "yyyy-MM-dd");
  const to = format(endOfMonth(addMonths(month, 1)), "yyyy-MM-dd");

  const { data: tasks = [], refetch } = useQuery({
    queryKey: ["maint-tasks", structureId, from, to],
    enabled: planIds.length > 0,
    queryFn: async () => (await supabase
      .from("maintenance_tasks")
      .select("*, maintenance_plans!inner(id,name,checklist,structure_id,asset_id, assets(name,code))")
      .in("plan_id", planIds)
      .gte("due_date", from).lte("due_date", to)
      .order("due_date")).data ?? [],
  });

  const dayTasks = useMemo(() => {
    if (!selected) return [] as any[];
    return (tasks as any[]).filter(t => isSameDay(parseISO(t.due_date), selected));
  }, [tasks, selected]);

  const dueDays = useMemo(() => (tasks as any[]).map(t => parseISO(t.due_date)), [tasks]);
  const overdueDays = useMemo(() => (tasks as any[])
    .filter(t => t.status !== "done" && parseISO(t.due_date) < new Date(new Date().toDateString()))
    .map(t => parseISO(t.due_date)), [tasks]);
  const doneDays = useMemo(() => (tasks as any[]).filter(t => t.status === "done").map(t => parseISO(t.due_date)), [tasks]);

  const [activeTask, setActiveTask] = useState<any | null>(null);

  return (
    <div className="grid gap-4 lg:grid-cols-[auto,1fr]">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="font-display text-base">Pianificazione</CardTitle></CardHeader>
        <CardContent>
          <Calendar mode="single" locale={it} month={month} onMonthChange={setMonth}
            selected={selected} onSelect={setSelected}
            modifiers={{ due: dueDays, overdue: overdueDays, done: doneDays }}
            modifiersClassNames={{
              due: "bg-primary/15 text-primary font-semibold",
              overdue: "bg-destructive/20 text-destructive font-semibold",
              done: "bg-emerald-500/20 text-emerald-600",
            }}
            className="pointer-events-auto"
          />
          <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
            <span className="flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-full bg-primary/60"/>in scadenza</span>
            <span className="flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-full bg-destructive/80"/>scaduto</span>
            <span className="flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-full bg-emerald-500"/>completato</span>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="font-display text-base">{selected ? format(selected, "EEEE d MMMM yyyy", { locale: it }) : "—"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {dayTasks.length === 0 && <div className="text-sm text-muted-foreground">Nessun task pianificato.</div>}
          {dayTasks.map((t:any) => (
            <button key={t.id} onClick={()=>setActiveTask(t)}
              className="w-full rounded-md border bg-card/60 p-3 text-left hover:bg-accent">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="font-medium">{t.maintenance_plans?.name}</div>
                  <div className="text-xs text-muted-foreground">{t.maintenance_plans?.assets?.name ?? "—"}</div>
                </div>
                <Badge variant={t.status === "done" ? "default" : t.status === "in_progress" ? "secondary" : "outline"}>
                  {t.status === "done" ? "completato" : t.status === "in_progress" ? "in corso" : "da fare"}
                </Badge>
              </div>
            </button>
          ))}
        </CardContent>
      </Card>
      {activeTask && (
        <TaskExecutionDialog task={activeTask} onClose={()=>{ setActiveTask(null); refetch(); qc.invalidateQueries({queryKey:["maint-history"]}); }}/>
      )}
    </div>
  );
}

function TaskExecutionDialog({ task, onClose }: { task: any; onClose: () => void }) {
  const initialChecklist = (task.checklist_result && Array.isArray(task.checklist_result) && task.checklist_result.length > 0)
    ? task.checklist_result
    : (task.maintenance_plans?.checklist as any[] | null) ?? [];
  const [checklist, setChecklist] = useState<any[]>(initialChecklist.map((c:any)=>({...c})));
  const [notes, setNotes] = useState<string>(task.notes ?? "");
  const [hours, setHours] = useState<string>(task.actual_hours?.toString() ?? "");
  const [outcome, setOutcome] = useState<string>(task.outcome ?? "ok");
  const [photos, setPhotos] = useState<string[]>(Array.isArray(task.photos) ? task.photos : []);
  const [uploading, setUploading] = useState(false);

  const uploadPhoto = async (file: File) => {
    setUploading(true);
    try {
      const path = `maintenance/${task.id}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("assets").upload(path, file, { upsert: false });
      if (error) throw error;
      setPhotos(p => [...p, path]);
    } catch (e:any) { toast.error(e.message); } finally { setUploading(false); }
  };

  const save = useMutation({
    mutationFn: async (close: boolean) => {
      const user = (await supabase.auth.getUser()).data.user;
      const allDone = checklist.length > 0 && checklist.every((c:any)=>c.done);
      const { error } = await supabase.from("maintenance_tasks").update({
        checklist_result: checklist,
        notes: notes || null,
        actual_hours: hours ? Number(hours.replace(",", ".")) : null,
        outcome,
        photos,
        status: close ? "done" : (checklist.some((c:any)=>c.done) ? "in_progress" : "pending"),
        completed_at: close ? new Date().toISOString() : null,
        completed_by: close ? user?.id ?? null : null,
        signed_at: close ? new Date().toISOString() : null,
      }).eq("id", task.id);
      if (error) throw error;
      if (close && !allDone) toast.warning("Chiuso con voci non spuntate");
    },
    onSuccess: (_d, close) => { toast.success(close ? "Intervento firmato" : "Salvato"); if (close) onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o)=>{ if(!o) onClose(); }}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Esecuzione: {task.maintenance_plans?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            {task.maintenance_plans?.assets?.name ?? "—"} · Scadenza: <b>{task.due_date}</b>
          </div>

          <div className="space-y-2">
            <Label>Checklist</Label>
            {checklist.length === 0 && <div className="text-xs text-muted-foreground">Nessuna voce</div>}
            {checklist.map((c:any, i:number) => (
              <label key={i} className="flex items-start gap-2 rounded-md border p-2 text-sm">
                <Checkbox checked={!!c.done} onCheckedChange={(v)=>{
                  const next=[...checklist]; next[i] = {...c, done: !!v }; setChecklist(next);
                }}/>
                <span className={c.done ? "line-through text-muted-foreground" : ""}>{c.label}</span>
              </label>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Ore lavorate</Label><Input value={hours} onChange={(e)=>setHours(e.target.value)} placeholder="1.5"/></div>
            <div className="space-y-1"><Label>Esito</Label>
              <Select value={outcome} onValueChange={setOutcome}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ok">OK</SelectItem>
                  <SelectItem value="da_rifare">Da rifare</SelectItem>
                  <SelectItem value="problema">Problema</SelectItem>
                  <SelectItem value="annullato">Annullato</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1"><Label>Note intervento</Label><Textarea rows={3} value={notes} onChange={(e)=>setNotes(e.target.value)}/></div>

          <div className="space-y-2">
            <Label>Foto ({photos.length})</Label>
            <div className="flex flex-wrap gap-2">
              {photos.map(p=>(
                <div key={p} className="rounded border bg-muted/30 px-2 py-1 text-[11px]">{p.split("/").pop()}</div>
              ))}
              <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-dashed px-3 py-1 text-xs hover:bg-accent">
                <Camera className="h-3 w-3"/>{uploading ? "Carico…" : "Aggiungi foto"}
                <input type="file" accept="image/*" className="hidden" onChange={(e)=>{
                  const f=e.target.files?.[0]; if (f) uploadPhoto(f); e.target.value="";
                }}/>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t pt-3">
            <Button variant="outline" onClick={()=>save.mutate(false)} disabled={save.isPending}>Salva bozza</Button>
            <Button onClick={()=>save.mutate(true)} disabled={save.isPending}>
              <CheckCircle2 className="mr-1 h-4 w-4"/>Firma e chiudi
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MaintenanceHistory({ structureId }: { structureId: string }) {
  const [outcome, setOutcome] = useState<string>("all");
  const { data: rows = [] } = useQuery({
    queryKey: ["maint-history", structureId, outcome],
    queryFn: async () => {
      let q = supabase
        .from("maintenance_tasks")
        .select("*, maintenance_plans!inner(name, structure_id, assets(name,code)), profiles:completed_by(full_name,email)")
        .eq("status", "done")
        .eq("maintenance_plans.structure_id", structureId)
        .order("completed_at", { ascending: false })
        .limit(200);
      if (outcome !== "all") q = q.eq("outcome", outcome);
      return (await q).data ?? [];
    },
  });
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="font-display text-base">Storico interventi</CardTitle>
        <Select value={outcome} onValueChange={setOutcome}>
          <SelectTrigger className="w-44"><SelectValue/></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti gli esiti</SelectItem>
            <SelectItem value="ok">OK</SelectItem>
            <SelectItem value="da_rifare">Da rifare</SelectItem>
            <SelectItem value="problema">Problema</SelectItem>
            <SelectItem value="annullato">Annullato</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 && <div className="text-sm text-muted-foreground">Nessun intervento storicizzato.</div>}
        {(rows as any[]).map((r:any)=>(
          <div key={r.id} className="rounded-md border p-3 text-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{r.maintenance_plans?.name}</div>
                <div className="text-xs text-muted-foreground">
                  {r.maintenance_plans?.assets?.name ?? "—"} · {r.due_date} · {r.profiles?.full_name ?? r.profiles?.email ?? "—"} · {r.actual_hours ?? "—"}h
                </div>
              </div>
              <Badge variant={r.outcome === "ok" ? "default" : r.outcome === "problema" ? "destructive" : "secondary"}>
                {r.outcome ?? "—"}
              </Badge>
            </div>
            {r.notes && <div className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{r.notes}</div>}
            {Array.isArray(r.photos) && r.photos.length>0 && (
              <div className="mt-2 text-[11px] text-muted-foreground">📷 {r.photos.length} foto</div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}