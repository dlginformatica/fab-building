import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wrench, Ticket as TicketIcon, History, MapPin, ScanLine } from "lucide-react";
import { fmtDateTime, fmtDate } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/a/$qr")({ component: Page });

function Page() {
  const { qr } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: asset, isLoading, isError } = useQuery({
    queryKey: ["asset-qr", qr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assets")
        .select("*, asset_categories(name,color), rooms(name), structures(name)")
        .eq("qr_token", qr).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: tickets = [] } = useQuery({
    queryKey: ["asset-tickets", asset?.id], enabled: !!asset?.id,
    queryFn: async () => (await supabase.from("tickets").select("id,title,status,priority,created_at,resolved_at").eq("asset_id", asset!.id).order("created_at",{ascending:false}).limit(20)).data ?? [],
  });

  const { data: scans = [] } = useQuery({
    queryKey: ["asset-scans", asset?.id], enabled: !!asset?.id,
    queryFn: async () => (await (supabase as any).from("asset_scans").select("created_at, scanned_by, user_agent").eq("asset_id", asset!.id).order("created_at",{ascending:false}).limit(10)).data ?? [],
  });

  const logScan = useMutation({
    mutationFn: async () => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user || !asset) return;
      await (supabase as any).from("asset_scans").insert({
        asset_id: asset.id, structure_id: asset.structure_id,
        scanned_by: user.id, user_agent: navigator.userAgent.slice(0,200),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey:["asset-scans"] }),
  });

  useEffect(() => { if (asset?.id) logScan.mutate(); }, [asset?.id]); // eslint-disable-line

  if (isLoading) return <div className="p-10 text-center text-sm text-muted-foreground">Caricamento…</div>;
  if (isError || !asset) return (
    <div className="p-10 text-center space-y-3">
      <ScanLine className="h-10 w-10 mx-auto text-muted-foreground"/>
      <h2 className="font-display text-xl">QR non riconosciuto</h2>
      <p className="text-sm text-muted-foreground">Il codice <code className="font-mono">{qr}</code> non corrisponde a nessun asset accessibile.</p>
      <Button asChild variant="outline"><Link to="/app/assets">Torna agli asset</Link></Button>
    </div>
  );

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="rounded-md border border-primary/30 bg-primary/5 p-3 flex items-center gap-2 text-sm">
        <ScanLine className="h-4 w-4 text-primary"/>QR scansionato · accesso mobile a questo asset
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-baseline gap-2 flex-wrap">
            <CardTitle className="font-display text-2xl">{asset.name}</CardTitle>
            <Badge variant="outline">{asset.code}</Badge>
            <Badge variant="outline" className="text-xs">{asset.status}</Badge>
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
            <Wrench className="h-3 w-3"/>{asset.asset_categories?.name ?? "—"}
            {asset.rooms?.name && <><span>·</span><MapPin className="h-3 w-3"/>{asset.rooms.name}</>}
            {asset.structures?.name && <><span>·</span>{asset.structures.name}</>}
          </div>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          {asset.photo_url && <img src={asset.photo_url} alt={asset.name} className="w-full rounded-md border border-border object-cover mb-3"/>}
          <Field k="Marca" v={asset.brand}/><Field k="Modello" v={asset.model}/><Field k="Seriale" v={asset.serial_number}/>
          <Field k="Installazione" v={fmtDate(asset.install_date)}/><Field k="Garanzia fino al" v={fmtDate(asset.warranty_until)}/>
          {asset.notes && <Field k="Note" v={asset.notes}/>}
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <Button size="lg" onClick={() => { toast.success("Apertura ticket prepopolato"); navigate({ to: "/app/tickets", search: { asset: asset.id } as never }); }}>
          <TicketIcon className="mr-2 h-4 w-4"/>Apri ticket per questo asset
        </Button>
        <Button size="lg" variant="outline" asChild>
          <Link to="/app/assets/$id" params={{ id: asset.id }}><Wrench className="mr-2 h-4 w-4"/>Scheda completa</Link>
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><History className="h-4 w-4"/>Ultimi interventi ({tickets.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          {tickets.length === 0 ? <div className="px-4 py-8 text-center text-sm text-muted-foreground">Nessun intervento registrato.</div> :
          <ul className="divide-y divide-border">
            {tickets.map((t:any)=>(
              <li key={t.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">{t.title}</div>
                  <div className="text-xs text-muted-foreground">{fmtDateTime(t.created_at)} · {t.priority}</div>
                </div>
                <Badge variant="outline" className="text-xs">{t.status.replace("_"," ")}</Badge>
              </li>
            ))}
          </ul>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-xs text-muted-foreground flex items-center gap-2"><ScanLine className="h-3 w-3"/>Ultime scansioni</CardTitle></CardHeader>
        <CardContent className="text-xs space-y-1">
          {(scans as any[]).length === 0 ? <div className="text-muted-foreground">Nessuna.</div> :
            (scans as any[]).map((s:any,i:number)=>(<div key={i}>· {fmtDateTime(s.created_at)} <span className="text-muted-foreground">({(s.user_agent||"").slice(0,40)})</span></div>))}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="grid grid-cols-3 gap-2 border-b border-border/40 py-1"><div className="text-muted-foreground">{k}</div><div className="col-span-2">{v ?? "—"}</div></div>;
}