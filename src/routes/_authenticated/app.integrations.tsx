import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveStructure } from "@/lib/structure-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plug, Building, ShoppingBag, MessageCircle, Receipt, Zap } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/app/integrations")({ component: Page });

type Catalog = { provider: string; kind: "pms" | "channel_manager" | "accounting" | "messaging" | "energy"; label: string; desc: string; icon: any; fields: Array<{ key: string; label: string; type?: string }> };
const CATALOG: Catalog[] = [
  { provider: "fatture_in_cloud", kind: "accounting", label: "Fatture in Cloud", desc: "Esporta XML SDI e sincronizza scadenze fornitori.", icon: Receipt,
    fields: [{ key: "company_id", label: "Company ID" }, { key: "api_token", label: "API Token", type: "password" }] },
  { provider: "octorate", kind: "channel_manager", label: "Octorate (Channel Manager)", desc: "OTA Booking, Expedia, Airbnb.", icon: ShoppingBag,
    fields: [{ key: "api_key", label: "API Key", type: "password" }, { key: "property_id", label: "Property ID" }] },
  { provider: "beddy", kind: "pms", label: "Beddy / PMS generico", desc: "Camere, check-in/out, occupazione.", icon: Building,
    fields: [{ key: "endpoint", label: "Endpoint URL" }, { key: "api_key", label: "API Key", type: "password" }] },
  { provider: "whatsapp_business", kind: "messaging", label: "WhatsApp Business", desc: "Invia notifiche e raccogli risposte da ospiti.", icon: MessageCircle,
    fields: [{ key: "phone_number_id", label: "Phone Number ID" }, { key: "access_token", label: "Access Token", type: "password" }] },
  { provider: "enel_x", kind: "energy", label: "Energia & utenze", desc: "Import letture e bollette automaticamente.", icon: Zap,
    fields: [{ key: "username", label: "Username" }, { key: "api_key", label: "API Key", type: "password" }] },
];

function Page() {
  const qc = useQueryClient();
  const { activeStructureId } = useActiveStructure();

  const { data: rows = [] } = useQuery({
    queryKey: ["integrations", activeStructureId],
    queryFn: async () => {
      if (!activeStructureId) return [];
      const { data, error } = await (supabase as any).from("integrations").select("*").eq("structure_id", activeStructureId);
      if (error) throw error; return data ?? [];
    },
    enabled: !!activeStructureId,
  });

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="font-display text-2xl font-semibold flex items-center gap-2"><Plug className="h-6 w-6"/>Integrazioni</h1>
        <p className="text-sm text-muted-foreground">Collega HotelOps al tuo PMS, channel manager, contabilità, WhatsApp, energia.</p>
      </header>
      <div className="grid gap-3 md:grid-cols-2">
        {CATALOG.map(c => {
          const existing = rows.find((r: any) => r.provider === c.provider);
          return <IntegrationCard key={c.provider} catalog={c} existing={existing} structureId={activeStructureId} onChange={() => qc.invalidateQueries({ queryKey: ["integrations"] })}/>;
        })}
      </div>
    </div>
  );
}

function IntegrationCard({ catalog, existing, structureId, onChange }: { catalog: Catalog; existing: any; structureId: string | null; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [cfg, setCfg] = useState<Record<string, string>>(existing?.config ?? {});
  const Icon = catalog.icon;

  const save = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!structureId) throw new Error("Nessuna struttura");
      const payload = { structure_id: structureId, provider: catalog.provider, kind: catalog.kind, enabled, config: cfg };
      const { error } = await (supabase as any).from("integrations").upsert(payload, { onConflict: "structure_id,provider" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Salvato"); onChange(); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-primary/10 text-primary"><Icon className="h-4 w-4"/></span>
            <div>
              <CardTitle className="text-base">{catalog.label}</CardTitle>
              <CardDescription>{catalog.desc}</CardDescription>
            </div>
          </div>
          {existing?.enabled ? <Badge variant="outline" className="bg-emerald-500/15 text-emerald-500">Attiva</Badge> :
            <Badge variant="outline">Non attiva</Badge>}
        </div>
      </CardHeader>
      <CardContent>
        {!open && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { setCfg(existing?.config ?? {}); setOpen(true); }}>Configura</Button>
            {existing && <div className="flex items-center gap-2 ml-auto"><Switch checked={!!existing.enabled} onCheckedChange={(v) => save.mutate(v)}/><span className="text-xs">{existing.enabled ? "On" : "Off"}</span></div>}
          </div>
        )}
        {open && (
          <div className="space-y-2">
            {catalog.fields.map(f => (
              <div key={f.key} className="space-y-1">
                <Label className="text-xs">{f.label}</Label>
                <Input type={f.type ?? "text"} value={cfg[f.key] ?? ""} onChange={(e) => setCfg({ ...cfg, [f.key]: e.target.value })}/>
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <Button size="sm" onClick={() => save.mutate(true)} disabled={save.isPending}>Salva e attiva</Button>
              <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Annulla</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}