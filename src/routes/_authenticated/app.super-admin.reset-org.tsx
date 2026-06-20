import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Crown, AlertTriangle, Eraser } from "lucide-react";
import { toast } from "sonner";
import { exportOrgSnapshot, uploadSnapshotAndRecord, BACKUP_BUCKET } from "@/lib/backup";

export const Route = createFileRoute("/_authenticated/app/super-admin/reset-org")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: isSuper } = await (supabase as any).rpc("has_role", { _user_id: data.user.id, _role: "super_admin" });
    if (!isSuper) throw redirect({ to: "/app" });
  },
  component: Page,
});

function Page() {
  const qc = useQueryClient();
  const [orgId, setOrgId] = useState("");
  const [confirmName, setConfirmName] = useState("");
  const [note, setNote] = useState("");
  const [makeBackup, setMakeBackup] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");

  const { data: orgs } = useQuery({
    queryKey: ["all-orgs-reset"],
    queryFn: async () => (await supabase.from("organizations").select("id,name").order("name")).data ?? [],
  });
  const org = (orgs ?? []).find((o: any) => o.id === orgId);

  async function execute() {
    if (!org) return;
    if (confirmName !== org.name) { toast.error("La conferma non corrisponde al nome dell'organizzazione"); return; }
    if (!confirm(`ATTENZIONE: stai per CANCELLARE TUTTI i dati dell'organizzazione "${org.name}". L'operazione è IRREVERSIBILE. Procedere?`)) return;
    setBusy(true);
    try {
      if (makeBackup) {
        setProgress("Snapshot pre-reset…");
        const snap = await exportOrgSnapshot(org.id, (t, i, n) => setProgress(`${i}/${n} · ${t}`));
        setProgress("Upload snapshot di sicurezza…");
        await uploadSnapshotAndRecord(org.id, snap, "pre_reset");
      }
      setProgress("Esecuzione reset…");
      const { data, error } = await (supabase as any).rpc("super_admin_reset_org", { _org: org.id, _confirm: confirmName, _note: note || null });
      if (error) throw error;
      const paths: string[] = (data?.storage_paths ?? []) as string[];
      if (paths.length) { try { await supabase.storage.from(BACKUP_BUCKET).remove(paths); } catch {} }
      toast.success(`Reset completato: ${data?.structures_deleted ?? 0} strutture rimosse`);
      qc.invalidateQueries();
      setOrgId(""); setConfirmName(""); setNote("");
    } catch (e: any) { toast.error(`Reset fallito: ${e?.message ?? e}`); }
    finally { setBusy(false); setProgress(""); }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold flex items-center gap-2"><Crown className="h-6 w-6 text-amber-400" /> Reset dati organizzazione</h1>
        <p className="text-sm text-muted-foreground">Funzione riservata al super admin. Azzera tutti i dati operativi, le strutture, i ruoli, gli audit e gli archivi backup di un'organizzazione. Restano solo l'organizzazione, l'owner e l'abbonamento.</p>
      </div>
      <Card className="border-destructive/40">
        <CardHeader><CardTitle className="font-display text-base flex items-center gap-2 text-destructive"><AlertTriangle className="h-4 w-4" /> Operazione irreversibile</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1"><Label>Organizzazione</Label>
              <Select value={orgId} onValueChange={setOrgId}>
                <SelectTrigger><SelectValue placeholder="Seleziona…" /></SelectTrigger>
                <SelectContent>{(orgs ?? []).map((o: any) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Conferma: digita il nome esatto</Label>
              <Input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} placeholder={org?.name ?? ""} />
            </div>
          </div>
          <div className="space-y-1"><Label>Motivazione (audit)</Label>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Es. Reset richiesto dal cliente in fase di test" />
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={makeBackup} onChange={(e) => setMakeBackup(e.target.checked)} /> Salva un backup di sicurezza nel cloud prima del reset</label>
          <Button variant="destructive" disabled={!org || !confirmName || busy} onClick={execute}>
            <Eraser className="mr-2 h-4 w-4" /> Esegui reset di {org?.name ?? "—"}
          </Button>
          {busy && <p className="text-xs text-muted-foreground">{progress}</p>}
        </CardContent>
      </Card>
    </div>
  );
}