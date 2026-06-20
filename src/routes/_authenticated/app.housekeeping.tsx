import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveStructure } from "@/lib/structure-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { BedDouble, Sparkles, PlayCircle, CheckCircle2, Ban, ClipboardList } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/housekeeping")({ component: Page });

const HK_LABELS: Record<string, { label: string; cls: string }> = {
  clean: { label: "Pulita", cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
  dirty: { label: "Sporca", cls: "bg-amber-500/15 text-amber-500 border-amber-500/30" },
  in_progress: { label: "In pulizia", cls: "bg-sky-500/15 text-sky-500 border-sky-500/30" },
  inspected: { label: "Ispezionata", cls: "bg-emerald-600/15 text-emerald-600 border-emerald-600/30" },
  out_of_order: { label: "Fuori uso", cls: "bg-red-500/15 text-red-500 border-red-500/30" },
};
const OCC_LABELS: Record<string, string> = { vacant: "Libera", occupied: "Occupata", arrival: "Arrivo", departure: "Partenza", stayover: "Permanenza" };

function Page() {
  const qc = useQueryClient();
  const { activeStructureId } = useActiveStructure();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const { data: kpi } = useQuery({
    queryKey: ["hk_kpi", activeStructureId, date],
    queryFn: async () => {
      if (!activeStructureId) return null;
      const { data, error } = await (supabase as any).rpc("housekeeping_kpi", { _structure: activeStructureId, _date: date });
      if (error) throw error;
      return Array.isArray(data) ? data[0] : data;
    },
    enabled: !!activeStructureId,
  });

  const { data: rooms = [] } = useQuery({
    queryKey: ["hk_rooms", activeStructureId],
    queryFn: async () => {
      if (!activeStructureId) return [];
      const { data, error } = await (supabase as any).from("rooms")
        .select("id,name,floor_id,housekeeping_status,occupancy_status,floors(level,name)")
        .eq("structure_id", activeStructureId).order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!activeStructureId,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["hk_tasks", activeStructureId, date],
    queryFn: async () => {
      if (!activeStructureId) return [];
      const { data, error } = await (supabase as any).from("housekeeping_tasks")
        .select("id,room_id,task_type,status,priority,notes,rooms(name)")
        .eq("structure_id", activeStructureId).eq("task_date", date).order("created_at");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!activeStructureId,
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await (supabase as any).from("rooms").update({ housekeeping_status: status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hk_rooms"] }); qc.invalidateQueries({ queryKey: ["hk_kpi"] }); },
  });

  const generateToday = useMutation({
    mutationFn: async () => {
      if (!activeStructureId) throw new Error("Nessuna struttura");
      const dirty = rooms.filter((r: any) => r.housekeeping_status === "dirty");
      if (!dirty.length) return 0;
      const rows = dirty.map((r: any) => ({
        structure_id: activeStructureId, room_id: r.id, task_date: date, task_type: "pulizia", status: "pending", priority: "normal",
      }));
      const { error } = await (supabase as any).from("housekeeping_tasks").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (n) => { toast.success(`Generati ${n} task pulizia`); qc.invalidateQueries({ queryKey: ["hk_tasks"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const setTaskStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const patch: any = { status };
      if (status === "in_progress") patch.started_at = new Date().toISOString();
      if (status === "done") patch.completed_at = new Date().toISOString();
      const { error } = await (supabase as any).from("housekeeping_tasks").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hk_tasks"] }),
  });

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold flex items-center gap-2"><BedDouble className="h-6 w-6"/>Housekeeping</h1>
          <p className="text-sm text-muted-foreground">Stato camere, turni pulizia e check-list mobile per il personale.</p>
        </div>
        <div className="flex gap-2 items-end">
          <div><label className="text-xs text-muted-foreground">Data</label>
            <Input type="date" value={date} onChange={(e)=>setDate(e.target.value)} className="w-44" /></div>
          <Button onClick={() => generateToday.mutate()} disabled={generateToday.isPending}>
            <Sparkles className="h-4 w-4 mr-2"/>Genera turni da camere sporche
          </Button>
        </div>
      </header>

      {kpi && (
        <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
          <Kpi label="Camere" value={kpi.total_rooms} />
          <Kpi label="Sporche" value={kpi.dirty} tone="amber" />
          <Kpi label="In pulizia" value={kpi.in_progress} tone="sky" />
          <Kpi label="Pulite" value={kpi.clean} tone="emerald" />
          <Kpi label="Fuori uso" value={kpi.ooo} tone="red" />
          <Kpi label="Turni oggi" value={kpi.tasks_today} />
          <Kpi label="Completati" value={kpi.tasks_done} tone="emerald" />
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5"/>Turni del {new Date(date).toLocaleDateString("it-IT")}</CardTitle></CardHeader>
        <CardContent>
          {tasks.length === 0 ? <p className="text-sm text-muted-foreground">Nessun turno. Clicca "Genera turni" per creare task dalle camere sporche.</p> :
            <div className="divide-y divide-border/40">
              {tasks.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Camera {t.rooms?.name}</Badge>
                    <span className="text-muted-foreground">{t.task_type}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant="outline" className={t.status === "done" ? "bg-emerald-500/15 text-emerald-500" : t.status === "in_progress" ? "bg-sky-500/15 text-sky-500" : ""}>{t.status}</Badge>
                    {t.status !== "in_progress" && t.status !== "done" && <Button size="sm" variant="outline" onClick={() => setTaskStatus.mutate({ id: t.id, status: "in_progress" })}><PlayCircle className="h-3 w-3 mr-1"/>Inizia</Button>}
                    {t.status !== "done" && <Button size="sm" onClick={() => setTaskStatus.mutate({ id: t.id, status: "done" })}><CheckCircle2 className="h-3 w-3 mr-1"/>Fatto</Button>}
                    {t.status !== "skipped" && t.status !== "done" && <Button size="sm" variant="ghost" onClick={() => setTaskStatus.mutate({ id: t.id, status: "skipped" })}><Ban className="h-3 w-3"/></Button>}
                  </div>
                </div>
              ))}
            </div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Stato camere</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {rooms.map((r: any) => {
              const hk = HK_LABELS[r.housekeeping_status] ?? HK_LABELS.clean;
              return (
                <div key={r.id} className="flex items-center justify-between rounded-md border border-border/50 p-3">
                  <div>
                    <div className="font-semibold">Camera {r.name}</div>
                    <div className="text-xs text-muted-foreground">{r.floors?.name ?? `Piano ${r.floors?.level ?? "?"}`} · {OCC_LABELS[r.occupancy_status] ?? r.occupancy_status}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={hk.cls}>{hk.label}</Badge>
                    <Select value={r.housekeeping_status} onValueChange={(v) => setStatus.mutate({ id: r.id, status: v })}>
                      <SelectTrigger className="w-32 h-8"><SelectValue/></SelectTrigger>
                      <SelectContent>
                        {Object.entries(HK_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: any; tone?: string }) {
  const cls = tone === "amber" ? "text-amber-500" : tone === "sky" ? "text-sky-500" : tone === "emerald" ? "text-emerald-500" : tone === "red" ? "text-red-500" : "text-foreground";
  return (
    <div className="rounded-lg border border-border/50 bg-card/40 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold ${cls}`}>{value ?? "—"}</div>
    </div>
  );
}