import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Ticket as TicketIcon, RefreshCw, ShieldOff, ShieldCheck, History, Activity, Wrench } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { AssetDocuments } from "@/components/assets/AssetDocuments";
import { AssetMedia } from "@/components/assets/AssetMedia";

export const Route = createFileRoute("/_authenticated/app/assets/$id")({ component: Page });

function Page() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: a } = useQuery({
    queryKey: ["asset", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("assets").select("*, asset_categories(name,color), rooms(name)").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });
  const { data: qrAudit = [] } = useQuery({
    queryKey: ["asset_qr_audit", id],
    queryFn: async () => (await (supabase as any).from("asset_qr_audit").select("*").eq("asset_id", id).order("created_at",{ascending:false}).limit(20)).data ?? [],
  });
  const { data: history = [] } = useQuery({
    queryKey: ["asset_history", id],
    queryFn: async () => (await (supabase as any).from("asset_history").select("*").eq("asset_id", id).order("created_at",{ascending:false}).limit(100)).data ?? [],
  });
  const { data: maintLog = [] } = useQuery({
    queryKey: ["asset_maintenance_log", id],
    queryFn: async () => (await (supabase as any).rpc("asset_maintenance_log", { _asset: id })).data ?? [],
  });
  const { data: kpi } = useQuery({
    queryKey: ["asset_maintenance_kpi", id],
    queryFn: async () => (await (supabase as any).rpc("asset_maintenance_kpi", { _asset: id })).data?.[0] ?? null,
  });

  const rotateQr = useMutation({
    mutationFn: async () => {
      const newTok = crypto.randomUUID();
      const { error } = await supabase.from("assets").update({ qr_token: newTok, qr_revoked_at: null, qr_generated_at: new Date().toISOString() } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("QR rigenerato"); qc.invalidateQueries({ queryKey:["asset", id] }); qc.invalidateQueries({ queryKey:["asset_qr_audit", id] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const revokeQr = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("assets").update({ qr_revoked_at: new Date().toISOString() } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("QR revocato"); qc.invalidateQueries({ queryKey:["asset", id] }); qc.invalidateQueries({ queryKey:["asset_qr_audit", id] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const reactivateQr = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("assets").update({ qr_revoked_at: null } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("QR riattivato"); qc.invalidateQueries({ queryKey:["asset", id] }); qc.invalidateQueries({ queryKey:["asset_qr_audit", id] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!a) return <div className="text-sm text-muted-foreground">Caricamento…</div>;
  const scanUrl = (typeof window !== "undefined" ? window.location.origin : "") + "/app/a/" + (a.qr_token ?? a.id);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(scanUrl)}`;
  const revoked = !!(a as any).qr_revoked_at;
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild><Link to="/app/assets"><ArrowLeft className="mr-1 h-4 w-4" />Asset</Link></Button>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-display text-2xl">{a.name}</CardTitle>
            <div className="text-sm text-muted-foreground">Codice {a.code} · {a.asset_categories?.name ?? "—"}</div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {a.photo_url && <img src={a.photo_url} alt={a.name} className="w-full max-w-md rounded-md border border-border object-cover" />}
            <Field k="Marca" v={a.brand} /><Field k="Modello" v={a.model} /><Field k="Seriale" v={a.serial_number} />
            <Field k="Stanza" v={a.rooms?.name} /><Field k="Installazione" v={fmtDate(a.install_date)} /><Field k="Garanzia fino al" v={fmtDate(a.warranty_until)} />
            <Field k="Stato" v={a.status} /><Field k="Note" v={a.notes} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base flex items-center justify-between">QR code
              {revoked ? <Badge variant="outline" className="bg-destructive/15 text-destructive border-destructive/30">Revocato</Badge>
                       : <Badge variant="outline" className="bg-success/15 text-success border-success/30">Attivo</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-center">
            <img src={qrUrl} alt="QR" className={`mx-auto rounded-md bg-white p-2 ${revoked?"opacity-30 grayscale":""}`} />
            <p className="text-xs text-muted-foreground">Stampa e applica all'impianto. Lo scan apre la scheda mobile con storico interventi.</p>
            <code className="block text-[10px] text-muted-foreground break-all">{scanUrl}</code>
            <Button className="w-full" onClick={() => navigate({ to: "/app/tickets", search: { asset: a.id } as never })}><TicketIcon className="mr-1 h-4 w-4" />Apri ticket per questo asset</Button>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button size="sm" variant="outline" disabled={rotateQr.isPending} onClick={()=>rotateQr.mutate()}><RefreshCw className="h-3 w-3 mr-1"/>Rigenera</Button>
              {revoked
                ? <Button size="sm" variant="outline" disabled={reactivateQr.isPending} onClick={()=>reactivateQr.mutate()}><ShieldCheck className="h-3 w-3 mr-1"/>Riattiva</Button>
                : <Button size="sm" variant="outline" disabled={revokeQr.isPending} onClick={()=>revokeQr.mutate()}><ShieldOff className="h-3 w-3 mr-1"/>Revoca</Button>}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="font-display text-base flex items-center gap-2"><History className="h-4 w-4"/>Audit ciclo vita QR</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <tr><th className="px-3 py-2">Quando</th><th className="px-3 py-2">Azione</th><th className="px-3 py-2">Token precedente</th><th className="px-3 py-2">Token nuovo</th></tr>
            </thead>
            <tbody>
              {(qrAudit as any[]).map(e=>(
                <tr key={e.id} className="border-b border-border/60">
                  <td className="px-3 py-2 text-xs">{new Date(e.created_at).toLocaleString("it-IT")}</td>
                  <td className="px-3 py-2"><Badge variant="outline">{e.action}</Badge></td>
                  <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">{e.old_token ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-[10px]">{e.new_token ?? "—"}</td>
                </tr>
              ))}
              {qrAudit.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">Nessun evento.</td></tr>}
            </tbody>
          </table>
          </CardContent>
        </Card>

      <AssetMedia assetId={id} structureId={(a as any).structure_id ?? null} />
      <AssetDocuments assetId={id} structureId={(a as any).structure_id ?? null} />

      <Tabs defaultValue="storico" className="w-full">
        <TabsList>
          <TabsTrigger value="storico"><History className="h-4 w-4 mr-1"/>Storico modifiche</TabsTrigger>
          <TabsTrigger value="manutenzioni"><Wrench className="h-4 w-4 mr-1"/>Manutenzioni</TabsTrigger>
          <TabsTrigger value="kpi"><Activity className="h-4 w-4 mr-1"/>KPI affidabilità</TabsTrigger>
        </TabsList>
        <TabsContent value="storico">
          <Card>
            <CardHeader><CardTitle className="font-display text-base">Storico modifiche asset</CardTitle></CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <tr><th className="px-3 py-2">Data</th><th className="px-3 py-2">Campo</th><th className="px-3 py-2">Prima</th><th className="px-3 py-2">Dopo</th></tr>
                </thead>
                <tbody>
                  {(history as any[]).map(h => (
                    <tr key={h.id} className="border-b border-border/60">
                      <td className="px-3 py-2 text-xs">{new Date(h.created_at).toLocaleString("it-IT")}</td>
                      <td className="px-3 py-2"><Badge variant="outline">{h.field}</Badge></td>
                      <td className="px-3 py-2 text-xs text-muted-foreground truncate max-w-[200px]">{fmtVal(h.old_value)}</td>
                      <td className="px-3 py-2 text-xs truncate max-w-[200px]">{fmtVal(h.new_value)}</td>
                    </tr>
                  ))}
                  {history.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">Nessuna modifica registrata.</td></tr>}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="manutenzioni">
          <Card>
            <CardHeader><CardTitle className="font-display text-base">Timeline interventi</CardTitle></CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <tr><th className="px-3 py-2">Data</th><th className="px-3 py-2">Tipo</th><th className="px-3 py-2">Titolo</th><th className="px-3 py-2">Stato</th><th className="px-3 py-2">Chiuso</th><th className="px-3 py-2">Ore</th></tr>
                </thead>
                <tbody>
                  {(maintLog as any[]).map((m, i) => (
                    <tr key={i} className="border-b border-border/60">
                      <td className="px-3 py-2 text-xs">{m.occurred_at ? new Date(m.occurred_at).toLocaleString("it-IT") : "—"}</td>
                      <td className="px-3 py-2"><Badge variant={m.kind === "correttiva" ? "destructive" : "outline"}>{m.kind}</Badge></td>
                      <td className="px-3 py-2">{m.title}</td>
                      <td className="px-3 py-2 text-xs">{m.status}</td>
                      <td className="px-3 py-2 text-xs">{m.closed_at ? new Date(m.closed_at).toLocaleDateString("it-IT") : "—"}</td>
                      <td className="px-3 py-2 text-xs">{m.hours ?? "—"}</td>
                    </tr>
                  ))}
                  {maintLog.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Nessun intervento.</td></tr>}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="kpi">
          <div className="grid gap-4 md:grid-cols-3">
            <Kpi label="Guasti totali" value={kpi?.total_failures ?? 0} />
            <Kpi label="Interventi conclusi" value={kpi?.total_repairs ?? 0} />
            <Kpi label="MTBF (ore)" value={kpi?.mtbf_hours ?? "—"} hint="Mean Time Between Failures" />
            <Kpi label="MTTR (ore)" value={kpi?.mttr_hours ?? "—"} hint="Mean Time To Repair" />
            <Kpi label="Ultimo guasto" value={kpi?.last_failure_at ? new Date(kpi.last_failure_at).toLocaleDateString("it-IT") : "—"} />
            <Kpi label="Ultima riparazione" value={kpi?.last_repair_at ? new Date(kpi.last_repair_at).toLocaleDateString("it-IT") : "—"} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="grid grid-cols-3 gap-2 border-b border-border/40 py-1"><div className="text-muted-foreground">{k}</div><div className="col-span-2">{v ?? "—"}</div></div>;
}

function Kpi({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground tracking-wide">{label}</CardTitle></CardHeader>
      <CardContent>
        <div className="text-2xl font-display">{value}</div>
        {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function fmtVal(v: any): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v;
  return JSON.stringify(v);
}