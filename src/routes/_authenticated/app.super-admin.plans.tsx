import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AlertTriangle, Save, Crown, Building2, Users, Calendar, RefreshCw, ListChecks, Lock, CheckCircle2, XCircle, Timer } from "lucide-react";
import { usePlans, type PlanRow, type Tier } from "@/lib/use-subscription";

export const Route = createFileRoute("/_authenticated/app/super-admin/plans")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: isSuper } = await (supabase as any).rpc("has_role", { _user_id: data.user.id, _role: "super_admin" });
    if (!isSuper) throw redirect({ to: "/app" });
  },
  component: Page,
});

const MODULE_GROUPS: Array<{ label: string; modules: Array<{ key: string; name: string }> }> = [
  { label: "Operativo", modules: [
    { key: "tickets", name: "Ticket" }, { key: "messages", name: "Messaggi" },
    { key: "smart_inbox", name: "Smart Inbox" }, { key: "overview", name: "Overview" },
    { key: "alerts", name: "Alert & Scadenze" }, { key: "guest_issues", name: "Segnalazioni ospiti" },
    { key: "notifications", name: "Notifiche" },
  ]},
  { label: "Strutture & Asset", modules: [
    { key: "rooms", name: "Strutture & camere" }, { key: "housekeeping", name: "Housekeeping" },
    { key: "assets", name: "Asset & impianti" }, { key: "maintenance", name: "Manutenzione" },
    { key: "inventory", name: "Magazzino" },
  ]},
  { label: "Fornitori & Acquisti", modules: [
    { key: "suppliers", name: "Fornitori" }, { key: "contracts", name: "Contratti" },
    { key: "work_orders", name: "Ordini di Lavoro" }, { key: "purchase_orders", name: "Ordini d'Acquisto" },
  ]},
  { label: "Economato & Analytics", modules: [
    { key: "utilities", name: "Utenze" }, { key: "invoices", name: "Fatture & bollette" },
    { key: "cashbook", name: "Prima nota" }, { key: "sustainability", name: "Sostenibilità / ESG" },
    { key: "reports", name: "Report" }, { key: "statistics", name: "Statistiche & cost analytics" },
    { key: "scheduled_exports", name: "Export schedulati" },
  ]},
  { label: "SLA & Penali", modules: [
    { key: "sla", name: "SLA" }, { key: "sla_settings", name: "Preferenze SLA" },
    { key: "penalties", name: "Penali" },
  ]},
  { label: "Governance", modules: [
    { key: "users", name: "Utenti & ruoli" }, { key: "permissions", name: "Permessi granulari" },
    { key: "delegations", name: "Deleghe" }, { key: "audit", name: "Audit log" },
    { key: "organization", name: "Multi-tenant / workflow" }, { key: "integrations", name: "Integrazioni" },
    { key: "docs", name: "Documenti" }, { key: "settings", name: "Impostazioni" },
  ]},
];

function Page() {
  const { data: plans } = usePlans();
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2"><Crown className="h-6 w-6 text-amber-400" />Configurazione piani</h1>
          <p className="text-sm text-muted-foreground">Imposta prezzi, limiti e moduli inclusi per Small/Medium/Large. Le dipendenze tra moduli vengono verificate al salvataggio.</p>
        </div>
      </div>
      <Tabs defaultValue="small">
        <TabsList className="grid w-full grid-cols-3 max-w-xl">
          {(plans ?? []).map((p) => (
            <TabsTrigger key={p.tier} value={p.tier}>{p.name} · €{p.price_monthly_eur}/mese</TabsTrigger>
          ))}
        </TabsList>
        {(plans ?? []).map((p) => (
          <TabsContent key={p.tier} value={p.tier} className="mt-6">
            <PlanEditor plan={p} />
          </TabsContent>
        ))}
      </Tabs>
      <OrgSubscriptionsAdmin />
      <SyncJobsPanel />
    </div>
  );
}

function PlanEditor({ plan }: { plan: PlanRow }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: plan.name, description: plan.description ?? "",
    price_monthly_eur: plan.price_monthly_eur, price_yearly_eur: plan.price_yearly_eur ?? 0,
    max_users: plan.max_users, max_structures: plan.max_structures,
    trial_days: plan.trial_days, modules: [...plan.modules],
    features_highlight: (plan.features_highlight ?? []).join("\n"),
  });
  useEffect(() => {
    setForm({
      name: plan.name, description: plan.description ?? "",
      price_monthly_eur: plan.price_monthly_eur, price_yearly_eur: plan.price_yearly_eur ?? 0,
      max_users: plan.max_users, max_structures: plan.max_structures,
      trial_days: plan.trial_days, modules: [...plan.modules],
      features_highlight: (plan.features_highlight ?? []).join("\n"),
    });
  }, [plan.id]);

  const { data: missing } = useQuery<Array<{ module: string; missing_dependency: string }>>({
    queryKey: ["validate-modules", form.modules.sort().join(",")],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("plan_validate_modules", { _modules: form.modules });
      if (error) throw error;
      return data ?? [];
    },
  });
  const hasMissing = (missing?.length ?? 0) > 0;

  const toggle = (key: string, on: boolean) => {
    setForm((f) => ({ ...f, modules: on ? Array.from(new Set([...f.modules, key])) : f.modules.filter((m) => m !== key) }));
  };
  const addMissing = () => {
    if (!missing) return;
    const add = missing.map((m) => m.missing_dependency);
    setForm((f) => ({ ...f, modules: Array.from(new Set([...f.modules, ...add])) }));
  };

  const save = useMutation({
    mutationFn: async () => {
      if (hasMissing) throw new Error("Risolvi le dipendenze mancanti prima di salvare.");
      const { error } = await (supabase as any).from("subscription_plans").update({
        name: form.name, description: form.description || null,
        price_monthly_eur: form.price_monthly_eur, price_yearly_eur: form.price_yearly_eur || null,
        max_users: form.max_users, max_structures: form.max_structures,
        trial_days: form.trial_days, modules: form.modules,
        features_highlight: form.features_highlight.split("\n").map((x) => x.trim()).filter(Boolean),
      }).eq("id", plan.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Piano salvato");
      qc.invalidateQueries({ queryKey: ["subscription_plans"] });
      qc.invalidateQueries({ queryKey: ["my-subscription"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
      <Card>
        <CardHeader><CardTitle className="font-display text-base">Parametri piano {plan.tier.toUpperCase()}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1"><Label>Nome commerciale</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="space-y-1"><Label>Descrizione</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Prezzo mensile (€)</Label><Input type="number" min={0} value={form.price_monthly_eur} onChange={(e) => setForm({ ...form, price_monthly_eur: parseFloat(e.target.value || "0") })} /></div>
            <div className="space-y-1"><Label>Prezzo annuale (€)</Label><Input type="number" min={0} value={form.price_yearly_eur} onChange={(e) => setForm({ ...form, price_yearly_eur: parseFloat(e.target.value || "0") })} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1"><Label className="text-xs flex items-center gap-1"><Users className="h-3 w-3" />Max utenti</Label><Input type="number" min={1} value={form.max_users} onChange={(e) => setForm({ ...form, max_users: parseInt(e.target.value || "1", 10) })} /></div>
            <div className="space-y-1"><Label className="text-xs flex items-center gap-1"><Building2 className="h-3 w-3" />Max strutture</Label><Input type="number" min={1} value={form.max_structures} onChange={(e) => setForm({ ...form, max_structures: parseInt(e.target.value || "1", 10) })} /></div>
            <div className="space-y-1"><Label className="text-xs flex items-center gap-1"><Calendar className="h-3 w-3" />Giorni trial</Label><Input type="number" min={0} value={form.trial_days} onChange={(e) => setForm({ ...form, trial_days: parseInt(e.target.value || "0", 10) })} /></div>
          </div>
          <div className="space-y-1">
            <Label>Bullet di marketing (uno per riga)</Label>
            <Textarea rows={4} value={form.features_highlight} onChange={(e) => setForm({ ...form, features_highlight: e.target.value })} />
          </div>
          <Button className="w-full" disabled={save.isPending || hasMissing} onClick={() => save.mutate()}>
            <Save className="mr-2 h-4 w-4" />Salva piano
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {hasMissing && (
          <Card className="border-amber-500/50 bg-amber-500/5">
            <CardContent className="space-y-2 p-4">
              <div className="flex items-center gap-2 text-amber-300"><AlertTriangle className="h-4 w-4" /><strong>Dipendenze mancanti</strong></div>
              <ul className="text-xs text-amber-200/90">
                {missing!.map((m, i) => (<li key={i}><code>{m.module}</code> richiede <code>{m.missing_dependency}</code></li>))}
              </ul>
              <Button size="sm" variant="outline" onClick={addMissing}>Aggiungi automaticamente le dipendenze</Button>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader><CardTitle className="font-display text-base">Moduli inclusi ({form.modules.length})</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {MODULE_GROUPS.map((g) => (
              <div key={g.label}>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{g.label}</div>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                  {g.modules.map((m) => {
                    const on = form.modules.includes(m.key);
                    const isMissingDep = (missing ?? []).some((x) => x.missing_dependency === m.key);
                    return (
                      <label key={m.key} className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm cursor-pointer ${
                        on ? "border-primary/50 bg-primary/5" : "border-border hover:border-border/80"
                      } ${isMissingDep ? "ring-1 ring-amber-500/60" : ""}`}>
                        <Checkbox checked={on} onCheckedChange={(v) => toggle(m.key, !!v)} />
                        <span className="flex-1">{m.name}</span>
                        <code className="text-[10px] text-muted-foreground">{m.key}</code>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function OrgSubscriptionsAdmin() {
  const qc = useQueryClient();
  const { data: subs } = useQuery({
    queryKey: ["all-org-subs"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("org_subscriptions")
        .select("*, organizations!inner(name)").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const force = useMutation({
    mutationFn: async (payload: { org_id: string; tier?: Tier; status?: string; extend_days?: number; note?: string }) => {
      const { error } = await (supabase as any).rpc("super_admin_force_subscription", {
        _org: payload.org_id,
        _tier: payload.tier ?? null,
        _status: payload.status ?? null,
        _extend_days: payload.extend_days ?? null,
        _note: payload.note ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Abbonamento aggiornato"); qc.invalidateQueries({ queryKey: ["all-org-subs"] }); qc.invalidateQueries({ queryKey: ["my-subscription"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const syncNow = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase as any).rpc("subscriptions_sync_run", { _source: "manual", _parent: null });
      if (error) throw error;
      return data;
    },
    onSuccess: (job: any) => {
      if (job?.status === "skipped_locked") toast.warning("Un'altra sincronizzazione è in corso — saltata.");
      else if (job?.status === "failed") toast.error(`Sync fallita: ${job?.error_message ?? "errore sconosciuto"}`);
      else toast.success(`Sincronizzazione OK — ${job?.processed_count ?? 0} organizzazioni aggiornate`);
      qc.invalidateQueries({ queryKey: ["all-org-subs"] });
      qc.invalidateQueries({ queryKey: ["my-subscription"] });
      qc.invalidateQueries({ queryKey: ["sync-jobs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const setTrial = useMutation({
    mutationFn: async (payload: { org_id: string; days: number; note?: string }) => {
      const { error } = await (supabase as any).rpc("super_admin_set_trial_days", {
        _org: payload.org_id, _days: payload.days, _note: payload.note ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Durata trial aggiornata"); qc.invalidateQueries({ queryKey: ["all-org-subs"] }); qc.invalidateQueries({ queryKey: ["my-subscription"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle className="font-display text-base">Abbonamenti organizzazioni ({subs?.length ?? 0})</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Un job orario marca automaticamente come <code>readonly</code> i trial scaduti e gli abbonamenti con periodo concluso. Il super admin può forzare tier, stato e proroghe in qualsiasi momento.</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => syncNow.mutate()} disabled={syncNow.isPending}>Sincronizza ora</Button>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
            <tr><th className="px-4 py-2">Organizzazione</th><th className="px-4 py-2">Piano</th><th className="px-4 py-2">Stato</th>
              <th className="px-4 py-2">Trial fine</th><th className="px-4 py-2">Scadenza</th><th className="px-4 py-2 text-right">Azioni</th></tr>
          </thead>
          <tbody>
            {(subs ?? []).map((s: any) => (
              <tr key={s.id} className="border-b border-border/60 align-top">
                <td className="px-4 py-2">{s.organizations?.name ?? s.org_id}</td>
                <td className="px-4 py-2"><Badge variant="outline">{s.tier}</Badge></td>
                <td className="px-4 py-2"><Badge>{s.status}</Badge></td>
                <td className="px-4 py-2 text-xs">{s.trial_ends_at ? new Date(s.trial_ends_at).toLocaleDateString("it-IT") : "—"}</td>
                <td className="px-4 py-2 text-xs">{s.current_period_end ? new Date(s.current_period_end).toLocaleDateString("it-IT") : "—"}</td>
                <td className="px-4 py-2 text-right space-x-1">
                  <Button size="sm" variant="outline" onClick={() => force.mutate({ org_id: s.org_id, status: "active", extend_days: 30, note: "Attivazione manuale +30gg" })}>+30gg attivo</Button>
                  <Button size="sm" variant="outline" onClick={() => force.mutate({ org_id: s.org_id, status: "active", extend_days: 365, note: "Attivazione manuale +1 anno" })}>+1 anno</Button>
                  <Button size="sm" variant="outline" onClick={() => force.mutate({ org_id: s.org_id, status: "trial", extend_days: 30, note: "Estensione trial +30gg" })}>+30gg trial</Button>
                  <Button size="sm" variant="ghost" onClick={() => force.mutate({ org_id: s.org_id, status: "readonly", note: "Bloccato dal super admin" })}>Blocca</Button>
                  <select className="ml-2 rounded border bg-background px-2 py-1 text-xs" value={s.tier} onChange={(e) => force.mutate({ org_id: s.org_id, tier: e.target.value as Tier, note: "Cambio tier" })}>
                    <option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option>
                  </select>
                  <TrialDaysControl orgId={s.org_id} onSubmit={(d, n) => setTrial.mutate({ org_id: s.org_id, days: d, note: n })} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function TrialDaysControl({ orgId, onSubmit }: { orgId: string; onSubmit: (days: number, note?: string) => void }) {
  const [days, setDays] = useState<number>(30);
  const [note, setNote] = useState<string>("");
  return (
    <div className="mt-2 inline-flex items-center gap-1 rounded border border-border/60 bg-muted/20 px-2 py-1 align-middle" title={`Trial custom per org ${orgId.slice(0,8)}`}>
      <Timer className="h-3 w-3 text-muted-foreground" />
      <Input className="h-7 w-16 px-1 py-0 text-xs" type="number" min={0} max={3650} value={days} onChange={(e) => setDays(parseInt(e.target.value || "0", 10))} />
      <span className="text-[10px] text-muted-foreground">gg</span>
      <Input className="h-7 w-32 px-1 py-0 text-xs" placeholder="motivo (opz.)" value={note} onChange={(e) => setNote(e.target.value)} />
      <Button size="sm" variant="outline" className="h-7" onClick={() => onSubmit(days, note || undefined)}>Trial</Button>
    </div>
  );
}

function SyncJobsPanel() {
  const qc = useQueryClient();
  const { data: jobs } = useQuery({
    queryKey: ["sync-jobs"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("subscription_sync_jobs")
        .select("*").order("started_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 30_000,
  });
  const retry = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await (supabase as any).rpc("subscriptions_sync_retry", { _job: id });
      if (error) throw error;
      return data;
    },
    onSuccess: (job: any) => {
      if (job?.status === "success") toast.success(`Retry OK — ${job.processed_count} aggiornamenti`);
      else if (job?.status === "skipped_locked") toast.warning("Lock attivo — retry saltato");
      else toast.error(`Retry fallito: ${job?.error_message ?? "errore"}`);
      qc.invalidateQueries({ queryKey: ["sync-jobs"] });
      qc.invalidateQueries({ queryKey: ["all-org-subs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const icon = (s: string) => s === "success" ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
    : s === "failed" ? <XCircle className="h-4 w-4 text-destructive" />
    : s === "skipped_locked" ? <Lock className="h-4 w-4 text-amber-500" />
    : <RefreshCw className="h-4 w-4 animate-spin text-primary" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-base flex items-center gap-2"><ListChecks className="h-4 w-4" /> Coda & storico sincronizzazioni ({jobs?.length ?? 0})</CardTitle>
        <p className="text-xs text-muted-foreground">Le esecuzioni manuali e quelle del cron usano un <strong>lock cooperativo</strong>: se è già in corso un run, il successivo viene marcato <code>skipped_locked</code>. Dai job falliti puoi lanciare un retry.</p>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Stato</th><th className="px-4 py-2">Quando</th>
              <th className="px-4 py-2">Origine</th><th className="px-4 py-2">Aggiornati</th>
              <th className="px-4 py-2">Tentativi</th><th className="px-4 py-2">Errore</th>
              <th className="px-4 py-2 text-right">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {(jobs ?? []).map((j: any) => (
              <tr key={j.id} className="border-b border-border/60">
                <td className="px-4 py-2"><div className="flex items-center gap-2">{icon(j.status)}<span className="text-xs">{j.status}</span></div></td>
                <td className="px-4 py-2 text-xs">{new Date(j.started_at).toLocaleString("it-IT")}</td>
                <td className="px-4 py-2"><Badge variant="outline">{j.trigger_source}</Badge></td>
                <td className="px-4 py-2 tabular-nums">{j.processed_count}</td>
                <td className="px-4 py-2 tabular-nums">{j.attempts}</td>
                <td className="px-4 py-2 text-xs text-destructive max-w-[260px] truncate" title={j.error_message ?? ""}>{j.error_message ?? "—"}</td>
                <td className="px-4 py-2 text-right">
                  {(j.status === "failed" || j.status === "skipped_locked") && (
                    <Button size="sm" variant="outline" disabled={retry.isPending} onClick={() => retry.mutate(j.id)}>
                      <RefreshCw className="mr-1 h-3 w-3" /> Retry
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}