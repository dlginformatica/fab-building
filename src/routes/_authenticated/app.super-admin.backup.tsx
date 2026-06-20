import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIsSuperAdmin } from "@/lib/use-subscription";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Crown, Database, Download } from "lucide-react";
import { toast } from "sonner";
import { BackupPanel } from "@/components/backup/BackupPanel";
import { ImportWizard } from "@/components/backup/ImportWizard";
import { exportOrgSnapshot, downloadBlob } from "@/lib/backup";

export const Route = createFileRoute("/_authenticated/app/super-admin/backup")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: isSuper } = await (supabase as any).rpc("has_role", { _user_id: data.user.id, _role: "super_admin" });
    if (!isSuper) throw redirect({ to: "/app" });
  },
  component: Page,
});

function Page() {
  const { data: isSuper, isLoading } = useIsSuperAdmin();
  const [selectedOrg, setSelectedOrg] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");

  const { data: orgs } = useQuery({
    enabled: !!isSuper,
    queryKey: ["all-orgs"],
    queryFn: async () => (await supabase.from("organizations").select("id,name").order("name")).data ?? [],
  });
  const { data: structures } = useQuery({
    enabled: !!selectedOrg,
    queryKey: ["sa-structs", selectedOrg],
    queryFn: async () => (await supabase.from("structures").select("id,name").eq("organization_id", selectedOrg).order("name")).data ?? [],
  });
  const currentOrg = (orgs ?? []).find((o) => o.id === selectedOrg);

  async function exportAllOrgs() {
    if (!orgs?.length) return;
    setBusy(true);
    try {
      const out: Record<string, any> = { meta: { app: "HotelOps", created_at: new Date().toISOString(), orgs: orgs.length }, organizations: {} };
      for (let i = 0; i < orgs.length; i++) {
        const o = orgs[i];
        setProgress(`${i+1}/${orgs.length} · ${o.name}`);
        out.organizations[o.id] = await exportOrgSnapshot(o.id);
      }
      downloadBlob(new Blob([JSON.stringify(out, null, 2)], { type: "application/json" }), `hotelops_global_backup_${new Date().toISOString().slice(0,10)}.json`);
      toast.success("Backup globale completato");
    } catch (e: any) { toast.error(e?.message ?? String(e)); }
    finally { setBusy(false); setProgress(""); }
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Verifica permessi…</p>;
  if (!isSuper) return <p className="text-sm text-destructive">Accesso riservato al super_admin.</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold flex items-center gap-2"><Crown className="h-5 w-5" /> Backup globale & per organizzazione</h1>
        <p className="text-sm text-muted-foreground">Esporta uno snapshot di una qualsiasi organizzazione o dell'intera istanza, importa dati, esegui restore.</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="font-display text-base flex items-center gap-2"><Database className="h-4 w-4" /> Backup globale (tutte le organizzazioni)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{orgs?.length ?? 0} organizzazioni rilevate. Il file JSON contiene lo snapshot di ognuna.</p>
          <Button disabled={busy || !orgs?.length} onClick={exportAllOrgs}><Download className="mr-2 h-4 w-4" /> Scarica backup completo (JSON)</Button>
          {busy && <p className="text-xs text-muted-foreground">{progress}</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="font-display text-base">Operazioni su singola organizzazione</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1 max-w-md"><Label>Organizzazione</Label>
            <Select value={selectedOrg} onValueChange={setSelectedOrg}>
              <SelectTrigger><SelectValue placeholder="Seleziona…" /></SelectTrigger>
              <SelectContent>{(orgs ?? []).map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      {currentOrg && (
        <>
          <BackupPanel orgId={currentOrg.id} orgName={currentOrg.name} />
          <ImportWizard structures={structures ?? []} />
        </>
      )}
    </div>
  );
}