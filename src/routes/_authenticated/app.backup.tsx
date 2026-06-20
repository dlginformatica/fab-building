import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMySubscription } from "@/lib/use-subscription";
import { BackupPanel } from "@/components/backup/BackupPanel";
import { ImportWizard } from "@/components/backup/ImportWizard";

export const Route = createFileRoute("/_authenticated/app/backup")({ component: Page });

function Page() {
  const { data: sub } = useMySubscription();
  const orgId = sub?.orgId ?? null;
  const { data: org } = useQuery({
    enabled: !!orgId,
    queryKey: ["org-info", orgId],
    queryFn: async () => (await supabase.from("organizations").select("id,name").eq("id", orgId!).maybeSingle()).data,
  });
  const { data: structures } = useQuery({
    enabled: !!orgId,
    queryKey: ["org-structures-bk", orgId],
    queryFn: async () => (await supabase.from("structures").select("id,name").eq("organization_id", orgId!).order("name")).data ?? [],
  });
  if (!orgId || !org) return <p className="text-sm text-muted-foreground">Caricamento…</p>;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Backup, Restore & Import</h1>
        <p className="text-sm text-muted-foreground">Salva un backup completo della tua organizzazione, ripristinalo o importa dati massivi da CSV/TXT con wizard guidato.</p>
      </div>
      <BackupPanel orgId={org.id} orgName={org.name} />
      <ImportWizard structures={structures ?? []} />
    </div>
  );
}