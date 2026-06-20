import { createFileRoute, Link } from "@tanstack/react-router";
import { FEATURES_BY_CATEGORY, CATEGORY_LABEL, type FeatureCategory } from "@/lib/features-catalog";
import { FeatureIcon } from "@/components/features/FeatureIcon";
import { PublicHeader, PublicFooter } from "@/components/features/PublicHeader";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/features/")({
  head: () => ({
    meta: [
      { title: "Funzionalità — HotelOps" },
      { name: "description", content: "Tutte le funzionalità di HotelOps: asset, ticket, SLA, fornitori, bollette, ESG, report. Per ogni modulo una scheda dettagliata con schermate reali." },
      { property: "og:title", content: "Funzionalità — HotelOps" },
      { property: "og:description", content: "Esplora ogni modulo HotelOps con descrizione, benefici, flusso operativo e schermate." },
    ],
  }),
  component: FeaturesIndex,
});

function FeaturesIndex() {
  const order: FeatureCategory[] = ["operativa", "governance", "finanza", "intelligenza"];
  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      <main className="container mx-auto px-6 py-12">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-3 inline-block rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">Catalogo funzionalità</p>
          <h1 className="font-display text-4xl font-bold tracking-tight md:text-5xl">Tutto il facility del tuo hotel, modulo per modulo</h1>
          <p className="mt-4 text-muted-foreground">Ogni funzione ha una pagina dedicata con descrizione, benefici, flusso operativo e schermate reali dell'app.</p>
        </div>
        <div className="mt-12 space-y-12">
          {order.map((cat) => (
            <section key={cat}>
              <h2 className="font-display text-xl font-semibold mb-4">{CATEGORY_LABEL[cat]}</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {(FEATURES_BY_CATEGORY[cat] ?? []).map((f) => (
                  <Link
                    key={f.slug}
                    to="/features/$slug"
                    params={{ slug: f.slug }}
                    className="group rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-accent/30"
                  >
                    <div className="mb-3 inline-grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary">
                      <FeatureIcon name={f.icon} className="h-5 w-5" />
                    </div>
                    <h3 className="font-display text-lg font-semibold">{f.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{f.tagline}</p>
                    <div className="mt-3 inline-flex items-center text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                      Scopri di più <ArrowRight className="ml-1 h-3 w-3" />
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}