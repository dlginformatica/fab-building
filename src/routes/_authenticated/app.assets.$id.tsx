import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Ticket as TicketIcon } from "lucide-react";
import { fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/app/assets/$id")({ component: Page });

function Page() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data: a } = useQuery({
    queryKey: ["asset", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("assets").select("*, asset_categories(name,color), rooms(name)").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });
  if (!a) return <div className="text-sm text-muted-foreground">Caricamento…</div>;
  const scanUrl = (typeof window !== "undefined" ? window.location.origin : "") + "/app/a/" + (a.qr_token ?? a.id);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(scanUrl)}`;
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
          <CardHeader><CardTitle className="font-display text-base">QR code</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-center">
            <img src={qrUrl} alt="QR" className="mx-auto rounded-md bg-white p-2" />
            <p className="text-xs text-muted-foreground">Stampa e applica all'impianto. Lo scan apre la scheda mobile con storico interventi.</p>
            <code className="block text-[10px] text-muted-foreground break-all">{scanUrl}</code>
            <Button className="w-full" onClick={() => navigate({ to: "/app/tickets", search: { asset: a.id } as never })}><TicketIcon className="mr-1 h-4 w-4" />Apri ticket per questo asset</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="grid grid-cols-3 gap-2 border-b border-border/40 py-1"><div className="text-muted-foreground">{k}</div><div className="col-span-2">{v ?? "—"}</div></div>;
}