import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Clock, Lock } from "lucide-react";
import { usePlans, useMySubscription } from "@/lib/use-subscription";

export const Route = createFileRoute("/_authenticated/app/billing")({ component: Page });

function Page() {
  const { data: plans } = usePlans();
  const { data: sub } = useMySubscription();
  const effectiveTier = sub?.effectiveTier;
  const status = sub?.effectiveStatus;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Abbonamento & piano</h1>
        <p className="text-sm text-muted-foreground">Stato attuale del tuo abbonamento HotelOps e confronto piani.</p>
      </div>

      <Card className="border-primary/30">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {status === "trial" && <Clock className="h-4 w-4 text-primary" />}
              {status === "active" && <Check className="h-4 w-4 text-emerald-500" />}
              {status === "readonly" && <Lock className="h-4 w-4 text-destructive" />}
              Stato attuale
            </div>
            <div className="font-display text-2xl font-bold">
              {status === "trial" && `Prova gratuita — ${sub?.trialDaysLeft} giorni rimasti`}
              {status === "active" && `Piano ${sub?.plan?.name} attivo`}
              {status === "readonly" && "Sola lettura — abbonamento scaduto"}
            </div>
            {sub?.plan && <div className="text-xs text-muted-foreground">€{sub.plan.price_monthly_eur}/mese · max {sub.plan.max_users} utenti · max {sub.plan.max_structures} strutture</div>}
          </div>
          <div className="text-right text-xs text-muted-foreground">
            {sub?.sub?.current_period_end && <>Scadenza: <strong>{new Date(sub.sub.current_period_end).toLocaleDateString("it-IT")}</strong><br /></>}
            {sub?.sub?.trial_ends_at && status === "trial" && <>Fine trial: <strong>{new Date(sub.sub.trial_ends_at).toLocaleDateString("it-IT")}</strong></>}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {(plans ?? []).map((p) => {
          const isCurrent = effectiveTier === p.tier;
          return (
            <Card key={p.id} className={isCurrent ? "border-primary ring-2 ring-primary/40" : ""}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="font-display flex items-center gap-2">
                    {p.tier === "large" && <Crown className="h-4 w-4 text-amber-400" />}{p.name}
                  </CardTitle>
                  {isCurrent && <Badge>Attivo</Badge>}
                </div>
                <div className="mt-2 font-display text-3xl font-bold">€{p.price_monthly_eur}<span className="text-sm font-normal text-muted-foreground">/mese</span></div>
                {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-xs text-muted-foreground">{p.max_users >= 9999 ? "Utenti illimitati" : `Fino a ${p.max_users} utenti`} · {p.max_structures >= 9999 ? "strutture illimitate" : `${p.max_structures} strutture`}</div>
                <ul className="space-y-1.5 text-sm">
                  {(p.features_highlight ?? []).map((f, i) => (
                    <li key={i} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 text-emerald-500 shrink-0" />{f}</li>
                  ))}
                </ul>
                <div className="text-[11px] text-muted-foreground">{p.modules.length} moduli inclusi</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader><CardTitle className="font-display text-base">Come effettuare il pagamento</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>Al momento la gestione dei pagamenti è <strong>manuale</strong>. Per attivare o cambiare il piano:</p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>Contatta il super admin (info@dlginformatica.it) indicando l'organizzazione e il piano desiderato.</li>
            <li>Riceverai gli estremi per il pagamento (bonifico/fattura).</li>
            <li>Una volta verificato il pagamento, il super admin attiva il piano e l'app esce automaticamente dalla sola lettura.</li>
          </ol>
          <p className="pt-2">Nella prossima fase verrà attivato il checkout automatico via Stripe direttamente da questa pagina.</p>
        </CardContent>
      </Card>
    </div>
  );
}