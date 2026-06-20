import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMySubscription, useIsSuperAdmin } from "@/lib/use-subscription";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CalendarClock, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { exportOrgSnapshot, uploadSnapshotAndRecord, BACKUP_BUCKET } from "@/lib/backup";

export const Route = createFileRoute("/_authenticated/app/backup-schedules")({ component: Page });

const WEEKDAYS = ["Domenica","Lunedì","Martedì","Mercoledì","Giovedì","Venerdì","Sabato"];

function computeNext(now: Date, frequency: string, hour: number, weekday: number | null, dom: number | null): Date {
  const d = new Date(now); d.setUTCHours(hour, 0, 0, 0);
  if (d <= now) d.setUTCDate(d.getUTCDate() + 1);
  if (frequency === "weekly" && weekday !== null) {
    while (d.getUTCDay() !== weekday) d.setUTCDate(d.getUTCDate() + 1);
  } else if (frequency === "monthly" && dom !== null) {
    d.setUTCDate(dom);
    if (d <= now) d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return d;
}

function Page() {
  const qc = useQueryClient();
  const { data: sub } = useMySubscription();
  const { data: isSuper } = useIsSuperAdmin();
  const orgId = sub?.orgId ?? null;
  const { data: row } = useQuery({
    enabled: !!orgId,
    queryKey: ["backup_schedule", orgId],
    queryFn: async () => (await (supabase as any).from("backup_schedules").select("*").eq("org_id", orgId!).maybeSingle()).data,
  });
  const { data: dueOrgs } = useQuery({
    enabled: !!isSuper,
    queryKey: ["due_schedules"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("backup_schedules").select("org_id, frequency, next_run_at, last_run_at, enabled, organizations(name)").lte("next_run_at", new Date().toISOString()).eq("enabled", true).limit(50);
      return data ?? [];
    },
  });

  const [enabled, setEnabled] = useState<boolean>(true);
  const [frequency, setFrequency] = useState<string>("weekly");
  const [hour, setHour] = useState<number>(2);
  const [weekday, setWeekday] = useState<number>(1);
  const [dom, setDom] = useState<number>(1);
  const [retention, setRetention] = useState<number>(10);

  useEffect(() => {
    if (row) {
      setEnabled(row.enabled); setFrequency(row.frequency); setHour(row.hour_utc);
      setWeekday(row.weekday ?? 1); setDom(row.day_of_month ?? 1); setRetention(row.retention_count);
    }
  }, [row?.id]);

  async function save() {
    if (!orgId) return;
    const next = computeNext(new Date(), frequency, hour, frequency === "weekly" ? weekday : null, frequency === "monthly" ? dom : null);
    const payload: any = { org_id: orgId, enabled, frequency, hour_utc: hour, retention_count: retention, next_run_at: next.toISOString(), format: "json", weekday: frequency === "weekly" ? weekday : null, day_of_month: frequency === "monthly" ? dom : null };
    const { error } = await (supabase as any).from("backup_schedules").upsert(payload, { onConflict: "org_id" });
    if (error) toast.error(error.message); else { toast.success("Pianificazione salvata"); qc.invalidateQueries({ queryKey: ["backup_schedule", orgId] }); }
  }

  async function runNow() {
    if (!orgId) return;
    toast.info("Backup pianificato in esecuzione…");
    try {
      const snap = await exportOrgSnapshot(orgId);
      await uploadSnapshotAndRecord(orgId, snap, "scheduled");
      const { data: list } = await (supabase as any).from("backup_runs").select("id,storage_path").eq("org_id", orgId).eq("kind","scheduled").order("snapshot_taken_at", { ascending: false });
      const extras = (list ?? []).slice(retention);
      if (extras.length) {
        const paths = extras.map((x: any) => x.storage_path).filter(Boolean);
        if (paths.length) await supabase.storage.from(BACKUP_BUCKET).remove(paths);
        await (supabase as any).from("backup_runs").delete().in("id", extras.map((x: any) => x.id));
      }
      const next = computeNext(new Date(), frequency, hour, frequency === "weekly" ? weekday : null, frequency === "monthly" ? dom : null);
      await (supabase as any).from("backup_schedules").update({ last_run_at: new Date().toISOString(), next_run_at: next.toISOString() }).eq("org_id", orgId);
      toast.success("Backup pianificato completato"); qc.invalidateQueries();
    } catch (e: any) { toast.error(e?.message ?? String(e)); }
  }

  if (!orgId) return <p className="text-sm text-muted-foreground">Caricamento…</p>;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold flex items-center gap-2"><CalendarClock className="h-6 w-6" /> Pianificazione backup</h1>
        <p className="text-sm text-muted-foreground">Configura backup automatici della tua organizzazione con frequenza, ora e retention. La policy di retention elimina automaticamente i backup pianificati più vecchi.</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="font-display text-base">Pianificazione corrente</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3"><Switch checked={enabled} onCheckedChange={setEnabled} /><Label>Pianificazione attiva</Label></div>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="space-y-1"><Label>Frequenza</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Giornaliera</SelectItem>
                  <SelectItem value="weekly">Settimanale</SelectItem>
                  <SelectItem value="monthly">Mensile</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Ora (UTC)</Label>
              <Input type="number" min={0} max={23} value={hour} onChange={(e) => setHour(Number(e.target.value))} />
            </div>
            {frequency === "weekly" && (
              <div className="space-y-1"><Label>Giorno settimana</Label>
                <Select value={String(weekday)} onValueChange={(v) => setWeekday(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{WEEKDAYS.map((w, i) => <SelectItem key={i} value={String(i)}>{w}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {frequency === "monthly" && (
              <div className="space-y-1"><Label>Giorno del mese (1-28)</Label>
                <Input type="number" min={1} max={28} value={dom} onChange={(e) => setDom(Number(e.target.value))} />
              </div>
            )}
            <div className="space-y-1"><Label>Retention (backup conservati)</Label>
              <Input type="number" min={1} max={365} value={retention} onChange={(e) => setRetention(Number(e.target.value))} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={save}>Salva pianificazione</Button>
            <Button variant="outline" onClick={runNow}><PlayCircle className="mr-2 h-4 w-4" /> Esegui adesso</Button>
          </div>
          {row?.next_run_at && <p className="text-xs text-muted-foreground">Prossima esecuzione prevista: {new Date(row.next_run_at).toLocaleString("it-IT")} · Ultima: {row.last_run_at ? new Date(row.last_run_at).toLocaleString("it-IT") : "mai"}</p>}
        </CardContent>
      </Card>

      {isSuper && (
        <Card>
          <CardHeader><CardTitle className="font-display text-base">Pianificazioni scadute (super admin)</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground"><tr><th className="px-3 py-2">Organizzazione</th><th className="px-3 py-2">Frequenza</th><th className="px-3 py-2">Prossima</th><th className="px-3 py-2">Ultima</th></tr></thead>
              <tbody>
                {(dueOrgs ?? []).map((o: any) => (
                  <tr key={o.org_id} className="border-b border-border/60">
                    <td className="px-3 py-2 text-xs">{o.organizations?.name ?? o.org_id?.slice(0,8)}</td>
                    <td className="px-3 py-2 text-xs">{o.frequency}</td>
                    <td className="px-3 py-2 text-xs">{new Date(o.next_run_at).toLocaleString("it-IT")}</td>
                    <td className="px-3 py-2 text-xs">{o.last_run_at ? new Date(o.last_run_at).toLocaleString("it-IT") : "mai"}</td>
                  </tr>
                ))}
                {!dueOrgs?.length && <tr><td colSpan={4} className="px-3 py-6 text-center text-xs text-muted-foreground">Nessuna pianificazione scaduta.</td></tr>}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}