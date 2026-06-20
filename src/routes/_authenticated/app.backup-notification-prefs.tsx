import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Bell, Mail, MonitorSmartphone, Save, Plus, X, DatabaseBackup } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/backup-notification-prefs")({ component: Page });

type Prefs = {
  organization_id: string;
  email_enabled: boolean;
  in_app_enabled: boolean;
  notify_on_start: boolean;
  notify_on_success: boolean;
  notify_on_failure: boolean;
  notify_on_integrity_issue: boolean;
  recipients: string[];
  frequency: "immediate" | "hourly_digest" | "daily_digest";
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  notes: string | null;
};

const DEFAULTS: Omit<Prefs, "organization_id"> = {
  email_enabled: true,
  in_app_enabled: true,
  notify_on_start: false,
  notify_on_success: true,
  notify_on_failure: true,
  notify_on_integrity_issue: true,
  recipients: [],
  frequency: "immediate",
  quiet_hours_start: null,
  quiet_hours_end: null,
  notes: null,
};

function Page() {
  const qc = useQueryClient();

  const { data: orgId } = useQuery({
    queryKey: ["current_org_for_backup_prefs"],
    queryFn: async () => {
      const u = (await supabase.auth.getUser()).data.user;
      if (!u) return null;
      const { data } = await supabase.from("profiles").select("organization_id").eq("id", u.id).maybeSingle();
      return (data?.organization_id as string | null) ?? null;
    },
  });

  const { data: row, isLoading } = useQuery({
    queryKey: ["org_backup_notify_prefs", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("org_backup_notify_prefs")
        .select("*")
        .eq("organization_id", orgId!)
        .maybeSingle();
      if (error) throw error;
      return data as Prefs | null;
    },
  });

  const [form, setForm] = useState<Prefs | null>(null);
  const [newRecipient, setNewRecipient] = useState("");

  useEffect(() => {
    if (!orgId) return;
    setForm(row ? { ...row } : { organization_id: orgId, ...DEFAULTS });
  }, [orgId, row]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form) throw new Error("nessun dato");
      const u = (await supabase.auth.getUser()).data.user;
      const payload = { ...form, updated_by: u?.id ?? null };
      const { error } = await supabase
        .from("org_backup_notify_prefs")
        .upsert(payload, { onConflict: "organization_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Preferenze salvate");
      qc.invalidateQueries({ queryKey: ["org_backup_notify_prefs"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Errore nel salvataggio"),
  });

  function set<K extends keyof Prefs>(k: K, v: Prefs[K]) {
    setForm((f) => (f ? { ...f, [k]: v } : f));
  }

  function addRecipient() {
    const v = newRecipient.trim().toLowerCase();
    if (!v || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      toast.error("Email non valida");
      return;
    }
    if (form?.recipients.includes(v)) {
      toast.error("Email già in elenco");
      return;
    }
    set("recipients", [...(form?.recipients ?? []), v]);
    setNewRecipient("");
  }

  if (!orgId) {
    return <div className="text-sm text-muted-foreground">Nessuna organizzazione associata al tuo profilo.</div>;
  }
  if (isLoading || !form) {
    return <div className="text-sm text-muted-foreground">Caricamento preferenze…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Bell className="h-5 w-5" /> Notifiche backup &amp; restore
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configura come l'organizzazione viene avvisata su backup pianificati, manuali e operazioni di restore
            (avvio, completamento, errori, problemi di integrità).
          </p>
        </div>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          <Save className="h-4 w-4 mr-2" /> {save.isPending ? "Salvataggio…" : "Salva"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><MonitorSmartphone className="h-4 w-4" /> Canali</CardTitle>
          <CardDescription>Abilita o disabilita ciascun canale di consegna.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="flex items-center justify-between rounded border border-border p-3">
            <div>
              <Label className="flex items-center gap-2"><Mail className="h-4 w-4" /> Email</Label>
              <p className="text-xs text-muted-foreground">Invia notifiche ai destinatari configurati sotto.</p>
            </div>
            <Switch checked={form.email_enabled} onCheckedChange={(v) => set("email_enabled", v)} />
          </div>
          <div className="flex items-center justify-between rounded border border-border p-3">
            <div>
              <Label className="flex items-center gap-2"><Bell className="h-4 w-4" /> In-app</Label>
              <p className="text-xs text-muted-foreground">Mostra avvisi nel centro notifiche di owner e admin.</p>
            </div>
            <Switch checked={form.in_app_enabled} onCheckedChange={(v) => set("in_app_enabled", v)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><DatabaseBackup className="h-4 w-4" /> Eventi da notificare</CardTitle>
          <CardDescription>Seleziona quali eventi del ciclo backup/restore generano notifiche.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {[
            ["notify_on_start", "Avvio backup/restore", "Notifica quando parte un'operazione."],
            ["notify_on_success", "Completamento", "Notifica al termine con dimensione e durata."],
            ["notify_on_failure", "Errore", "Notifica in caso di fallimento o timeout."],
            ["notify_on_integrity_issue", "Integrità non valida", "Notifica se un backup non risulta verificato (hash mismatch / file mancante)."],
          ].map(([k, label, desc]) => (
            <div key={k} className="flex items-start justify-between rounded border border-border p-3">
              <div className="pr-3">
                <Label>{label}</Label>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
              <Switch
                checked={Boolean((form as any)[k])}
                onCheckedChange={(v) => set(k as keyof Prefs, v as any)}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Destinatari email</CardTitle>
          <CardDescription>Lista degli indirizzi a cui inviare le notifiche email (oltre agli owner/admin).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {form.recipients.length === 0 && (
              <span className="text-xs text-muted-foreground">Nessun destinatario aggiuntivo.</span>
            )}
            {form.recipients.map((r) => (
              <Badge key={r} variant="secondary" className="gap-1">
                {r}
                <button
                  type="button"
                  className="ml-1 rounded p-0.5 hover:bg-muted"
                  onClick={() => set("recipients", form.recipients.filter((x) => x !== r))}
                  aria-label={`Rimuovi ${r}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="nome@dominio.it"
              value={newRecipient}
              onChange={(e) => setNewRecipient(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addRecipient(); } }}
            />
            <Button type="button" variant="outline" onClick={addRecipient}>
              <Plus className="h-4 w-4 mr-1" /> Aggiungi
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Frequenza &amp; fascia oraria</CardTitle>
          <CardDescription>Scegli se inviare ogni evento subito o aggregarli in un digest.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Frequenza</Label>
            <Select value={form.frequency} onValueChange={(v: any) => set("frequency", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="immediate">Immediata</SelectItem>
                <SelectItem value="hourly_digest">Digest orario</SelectItem>
                <SelectItem value="daily_digest">Digest giornaliero</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Inizio silenzio (opzionale)</Label>
            <Input
              type="time"
              value={form.quiet_hours_start ?? ""}
              onChange={(e) => set("quiet_hours_start", e.target.value || null)}
            />
          </div>
          <div className="space-y-2">
            <Label>Fine silenzio (opzionale)</Label>
            <Input
              type="time"
              value={form.quiet_hours_end ?? ""}
              onChange={(e) => set("quiet_hours_end", e.target.value || null)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Note</CardTitle>
          <CardDescription>Annotazioni interne sulla policy di notifica.</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            rows={3}
            value={form.notes ?? ""}
            onChange={(e) => set("notes", e.target.value || null)}
            placeholder="Es. notificare anche il referente IT esterno nei weekend…"
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          <Save className="h-4 w-4 mr-2" /> {save.isPending ? "Salvataggio…" : "Salva preferenze"}
        </Button>
      </div>
    </div>
  );
}
