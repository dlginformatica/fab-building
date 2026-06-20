import { Link } from "@tanstack/react-router";
import { AlertTriangle, Clock, CheckCircle2, Lock } from "lucide-react";
import { useMySubscription, useIsSuperAdmin } from "@/lib/use-subscription";

export function SubscriptionBanner() {
  const { data } = useMySubscription();
  const { data: isSuper } = useIsSuperAdmin();
  if (!data || isSuper) return null;
  const { effectiveStatus, effectiveTier, trialDaysLeft, plan } = data;

  if (effectiveStatus === "trial") {
    const urgent = trialDaysLeft <= 7;
    return (
      <div className={`flex items-center justify-between gap-3 border-b px-6 py-2 text-xs ${
        urgent ? "border-amber-500/50 bg-amber-500/10 text-amber-200" : "border-primary/30 bg-primary/10 text-primary"
      }`}>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4" />
          <strong>Prova gratuita Large attiva</strong>
          <span className="opacity-80">— {trialDaysLeft} giorni rimanenti. Dopo passerai in sola lettura.</span>
        </div>
        <Link to="/app/billing" className="rounded-md bg-foreground/10 px-3 py-1 hover:bg-foreground/20">Gestisci abbonamento</Link>
      </div>
    );
  }
  if (effectiveStatus === "active") {
    return (
      <div className="flex items-center justify-between gap-3 border-b border-emerald-500/30 bg-emerald-500/10 px-6 py-2 text-xs text-emerald-200">
        <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />Piano <strong>{plan?.name ?? effectiveTier}</strong> attivo</div>
        <Link to="/app/billing" className="opacity-80 hover:opacity-100">Dettagli</Link>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between gap-3 border-b border-destructive/50 bg-destructive/15 px-6 py-2 text-xs text-destructive-foreground">
      <div className="flex items-center gap-2">
        <Lock className="h-4 w-4" />
        <strong>Abbonamento scaduto</strong>
        <span className="opacity-80">— l'applicazione è in sola lettura. Contatta il super admin per rinnovare.</span>
      </div>
      <Link to="/app/billing" className="rounded-md bg-foreground/10 px-3 py-1 hover:bg-foreground/20">Vai a Abbonamento</Link>
    </div>
  );
}

export function ReadOnlyHint() {
  const { data } = useMySubscription();
  const { data: isSuper } = useIsSuperAdmin();
  if (isSuper) return null;
  if (data?.effectiveStatus === "trial" || data?.effectiveStatus === "active") return null;
  return (
    <div className="mb-4 flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground">
      <AlertTriangle className="h-4 w-4" />Sola lettura: per modificare i dati rinnova l'abbonamento.
    </div>
  );
}