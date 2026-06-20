import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Bell, Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/notification-prefs")({ component: Page });

const CHANNELS = [
  { id: "in_app", label: "In-app" },
  { id: "email", label: "Email" },
  { id: "push", label: "Push" },
];
const FREQS = [
  { id: "immediate", label: "Immediata" },
  { id: "hourly", label: "Digest orario" },
  { id: "daily", label: "Digest giornaliero" },
];
const CATEGORIES = [
  { id: "access_denied_missing_dep", label: "Accesso negato (dipendenze mancanti)" },
  { id: "sla_violation", label: "Violazioni SLA" },
  { id: "contract_expiry", label: "Contratti in scadenza" },
  { id: "invoice_due", label: "Fatture in scadenza" },
  { id: "supplier_doc_expiry", label: "Documenti fornitore in scadenza" },
];

function Page() {
  const qc = useQueryClient();
  const { data: org } = useQuery({
    queryKey: ["current_org"],
    queryFn: async () => {
      const u = (await supabase.auth.getUser()).data.user;
      if (!u) return null;
      const { data } = await supabase.from("profiles").select("organization_id").eq("id", u.id).maybeSingle();
      return data?.organization_id ?? null;
    },
  });

  const { data: prefs } = useQuery({
    queryKey: ["org_notification_prefs", org],
    enabled: !!org,
    queryFn: async () => ((await (supabase as any).from("org_notification_prefs").select("*").eq("org_id", org).maybeSingle()).data),
  });

  const [channels, setChannels] = useState<string[]>(["in_app"]);
  const [frequency, setFrequency] = useState("immediate");
  const [categories, setCategories] = useState<string[]>(["access_denied_missing_dep"]);
  const [qs, setQs] = useState<string>("");
  const [qe, setQe] = useState<string>("");

  useEffect(() => {
    if (!prefs) return;
    setChannels(prefs.channels ?? ["in_app"]);
    setFrequency(prefs.frequency ?? "immediate");
    setCategories(prefs.categories ?? ["access_denied_missing_dep"]);
    setQs(prefs.quiet_hours_start ?? "");
    setQe(prefs.quiet_hours_end ?? "");
  }, [prefs]);

  const toggle = (arr: string[], v: string, set: (a: string[]) => void) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const save = useMutation({
    mutationFn: async () => {
      if (!org) throw new Error("Nessuna organizzazione attiva");
      const u = (await supabase.auth.getUser()).data.user;
      const payload: any = {
        org_id: org, channels, frequency, categories,
        quiet_hours_start: qs || null, quiet_hours_end: qe || null,
        updated_by: u?.id,
      };
      const { error } = await (supabase as any).from("org_notification_prefs")
        .upsert(payload, { onConflict: "org_id" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Preferenze aggiornate"); qc.invalidateQueries({ queryKey: ["org_notification_prefs"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-display text-2xl font-bold flex items-center gap-2"><Bell className="h-6 w-6" />Preferenze notifiche organizzazione</h1>
        <p className="text-sm text-muted-foreground">Controlla canali, frequenza e categorie degli avvisi inviati agli amministratori dell'organizzazione.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="font-display text-base">Canali</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {CHANNELS.map((c) => (
            <Badge key={c.id} variant={channels.includes(c.id) ? "default" : "outline"} className="cursor-pointer" onClick={() => toggle(channels, c.id, setChannels)}>{c.label}</Badge>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="font-display text-base">Frequenza</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {FREQS.map((f) => (
            <Badge key={f.id} variant={frequency === f.id ? "default" : "outline"} className="cursor-pointer" onClick={() => setFrequency(f.id)}>{f.label}</Badge>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="font-display text-base">Categorie</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <Badge key={c.id} variant={categories.includes(c.id) ? "default" : "outline"} className="cursor-pointer" onClick={() => toggle(categories, c.id, setCategories)}>{c.label}</Badge>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="font-display text-base">Fascia di silenzio (opzionale)</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 max-w-sm">
          <div><Label>Da</Label><Input type="time" value={qs} onChange={(e) => setQs(e.target.value)} /></div>
          <div><Label>A</Label><Input type="time" value={qe} onChange={(e) => setQe(e.target.value)} /></div>
        </CardContent>
      </Card>

      <Button onClick={() => save.mutate()} disabled={save.isPending}><Save className="mr-1 h-4 w-4" />Salva preferenze</Button>
    </div>
  );
}
