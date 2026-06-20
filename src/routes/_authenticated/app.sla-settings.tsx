import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveStructure } from "@/lib/structure-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Bell, Save } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/sla-settings")({ component: Page });

type S = {
  warning_threshold_minutes: number;
  reminder_interval_minutes: number;
  channel_in_app: boolean;
  channel_email: boolean;
  channel_push: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
};

const DEFAULTS: S = {
  warning_threshold_minutes: 30,
  reminder_interval_minutes: 60,
  channel_in_app: true,
  channel_email: false,
  channel_push: false,
  quiet_hours_start: null,
  quiet_hours_end: null,
};

function Page() {
  const { activeStructureId } = useActiveStructure();
  const qc = useQueryClient();
  const [form, setForm] = useState<S>(DEFAULTS);

  const { data: existing } = useQuery({
    queryKey: ["sla_user_settings", activeStructureId],
    queryFn: async () => {
      const u = (await supabase.auth.getUser()).data.user;
      if (!u) return null;
      const { data } = await (supabase as any).from("sla_user_settings").select("*").eq("user_id", u.id).eq("structure_id", activeStructureId ?? null).maybeSingle();
      return data ?? null;
    },
  });

  useEffect(() => { if (existing) setForm({ ...DEFAULTS, ...existing }); }, [existing]);

  // Anteprima impatto: quante notifiche ipotetiche con la nuova soglia
  const { data: impact } = useQuery({
    queryKey: ["sla_impact", activeStructureId, form.warning_threshold_minutes],
    enabled: !!activeStructureId,
    queryFn: async () => {
      const { data: openTickets } = await (supabase as any).from("tickets")
        .select("id,priority,resolve_due_at,ack_due_at,ack_at,resolved_at,status")
        .eq("structure_id", activeStructureId)
        .not("status", "in", "(chiuso,annullato)")
        .limit(500);
      const now = Date.now();
      const T = form.warning_threshold_minutes * 60_000;
      let warning = 0, violated = 0;
      for (const t of openTickets ?? []) {
        const due = t.resolve_due_at ? new Date(t.resolve_due_at).getTime() : null;
        if (!due || t.resolved_at) continue;
        if (due < now) violated++;
        else if (due - now <= T) warning++;
      }
      return { warning, violated, total: openTickets?.length ?? 0 };
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const u = (await supabase.auth.getUser()).data.user;
      if (!u) throw new Error("Non autenticato");
      const { error } = await (supabase as any).from("sla_user_settings").upsert({
        user_id: u.id, structure_id: activeStructureId, ...form,
      }, { onConflict: "user_id,structure_id" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Preferenze SLA salvate"); qc.invalidateQueries({ queryKey: ["sla_user_settings"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 p-6 max-w-3xl">
      <header>
        <h1 className="font-display text-2xl font-semibold flex items-center gap-2"><Bell className="h-6 w-6" />Preferenze SLA</h1>
        <p className="text-sm text-muted-foreground">Configura soglie di pre-allerta, intervalli di reminder e canali di notifica per la tua utenza in questa struttura.</p>
      </header>

      <Card>
        <CardHeader><CardTitle>Soglie temporali</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Pre-allerta (minuti prima della scadenza)</Label>
            <Input type="number" min={5} max={720} value={form.warning_threshold_minutes}
              onChange={(e) => setForm({ ...form, warning_threshold_minutes: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Reminder ripetuto ogni (minuti)</Label>
            <Input type="number" min={15} max={1440} value={form.reminder_interval_minutes}
              onChange={(e) => setForm({ ...form, reminder_interval_minutes: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Inizio orario silenzioso</Label>
            <Input type="time" value={form.quiet_hours_start ?? ""} onChange={(e) => setForm({ ...form, quiet_hours_start: e.target.value || null })} />
          </div>
          <div>
            <Label>Fine orario silenzioso</Label>
            <Input type="time" value={form.quiet_hours_end ?? ""} onChange={(e) => setForm({ ...form, quiet_hours_end: e.target.value || null })} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Canali di notifica</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {[
            { k: "channel_in_app", label: "Smart Inbox (in-app)" },
            { k: "channel_email", label: "Email" },
            { k: "channel_push", label: "Push browser / mobile" },
          ].map((c) => (
            <div key={c.k} className="flex items-center justify-between">
              <Label>{c.label}</Label>
              <Switch checked={(form as any)[c.k]} onCheckedChange={(v) => setForm({ ...form, [c.k]: v } as S)} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Anteprima impatto</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-4 text-sm">
          <Badge variant="outline">Ticket aperti: {impact?.total ?? 0}</Badge>
          <Badge variant="outline" className="bg-amber-500/15 text-amber-600">Pre-allerta generati ora: {impact?.warning ?? 0}</Badge>
          <Badge variant="outline" className="bg-red-500/15 text-red-600">Violazioni attive: {impact?.violated ?? 0}</Badge>
          <p className="w-full text-xs text-muted-foreground">Stima basata sulla soglia di {form.warning_threshold_minutes} minuti applicata ai ticket aperti correnti.</p>
        </CardContent>
      </Card>

      <Button onClick={() => save.mutate()} disabled={save.isPending}><Save className="h-4 w-4 mr-2" />Salva preferenze</Button>
    </div>
  );
}