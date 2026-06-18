import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SpeakerPanel } from "@/components/tts/SpeakerPanel";

export const Route = createFileRoute("/_authenticated/app/settings")({ component: Page });

function Page() {
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Impostazioni</h1>
      <Card>
        <CardHeader><CardTitle className="font-display text-base">Speaker TTS</CardTitle></CardHeader>
        <CardContent><SpeakerPanel /></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="font-display text-base">Roadmap</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          <p>✅ Fase 0–1: fondamenta + Asset + Ticketing + TTS</p>
          <p>⏳ Fase 2: Fornitori & Contratti</p>
          <p>⏳ Fase 3: Manutenzione programmata & Magazzino</p>
          <p>⏳ Fase 4: Bollette & Fatture</p>
          <p>⏳ Fase 5: Messaggistica multi-agente (porting Penelope)</p>
          <p>⏳ Fase 6: Dashboard direzionale & Report</p>
        </CardContent>
      </Card>
    </div>
  );
}