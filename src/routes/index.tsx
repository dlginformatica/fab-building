import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen, FileDown, Sparkles } from "lucide-react";
import { FEATURE_CATALOG, FEATURES_BY_CATEGORY, CATEGORY_LABEL, type FeatureCategory } from "@/lib/features-catalog";
import { FeatureIcon } from "@/components/features/FeatureIcon";
import { PublicHeader, PublicFooter } from "@/components/features/PublicHeader";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "HotelOps — Building & Facility Management" },
      { name: "description", content: "Piattaforma multi-tenant di gestione facility per hotel: asset, ticket, SLA, fornitori, manutenzione, bollette, ESG e report. Con AI e fatturazione SDI." },
      { property: "og:title", content: "HotelOps" },
      { property: "og:description", content: "Asset, ticket, SLA, fornitori, bollette, ESG, report. Multi-tenant con AI." },
    ],
  }),
  component: Index,
});

function Index() {
  const order: FeatureCategory[] = ["operativa", "governance", "finanza", "intelligenza"];
  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      <main className="container mx-auto px-6 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-4 inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3" /> Multi-tenant · AI · SDI · PWA offline
          </p>
          <h1 className="font-display text-5xl font-bold tracking-tight md:text-6xl">
            Tutto il facility del tuo hotel <span className="text-primary">in un'unica plancia</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            Asset, ticket, SLA, fornitori, manutenzione preventiva, bollette con OCR, ESG e report direzionali. Ruoli granulari, deleghe sicure, audit completo.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/auth" className="rounded-md bg-primary px-6 py-3 font-medium text-primary-foreground hover:opacity-90">Entra nell'app</Link>
            <Link to="/manual" className="inline-flex items-center gap-2 rounded-md border border-border px-6 py-3 hover:bg-accent">
              <BookOpen className="h-4 w-4" /> Leggi il manuale
            </Link>
            <Link to="/brochure" className="inline-flex items-center gap-2 rounded-md border border-border px-6 py-3 hover:bg-accent">
              <FileDown className="h-4 w-4" /> Brochure PDF
            </Link>
            <Link to="/features" className="inline-flex items-center gap-2 rounded-md border border-border px-6 py-3 hover:bg-accent">
              Esplora le {FEATURE_CATALOG.length} funzioni <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="mx-auto mt-20 max-w-6xl space-y-14">
          {order.map((cat) => (
            <section key={cat}>
              <div className="mb-4 flex items-baseline justify-between">
                <h2 className="font-display text-xl font-semibold">{CATEGORY_LABEL[cat]}</h2>
                <Link to="/features" className="text-xs text-muted-foreground hover:text-foreground">Tutte le funzioni →</Link>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {(FEATURES_BY_CATEGORY[cat] ?? []).map((f) => (
                  <Link
                    key={f.slug}
                    to="/features/$slug"
                    params={{ slug: f.slug }}
                    className="group rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/40 hover:bg-accent/30"
                  >
                    <div className="mb-3 inline-grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary">
                      <FeatureIcon name={f.icon} className="h-5 w-5" />
                    </div>
                    <h3 className="font-display text-lg font-semibold">{f.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{f.tagline}</p>
                    <div className="mt-3 inline-flex items-center text-xs font-medium text-primary opacity-70 group-hover:opacity-100">
                      Scopri di più <ArrowRight className="ml-1 h-3 w-3" />
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>

        <section className="mx-auto mt-24 max-w-4xl rounded-2xl border border-primary/30 bg-primary/5 p-8 text-center">
          <h2 className="font-display text-2xl font-bold">Tutta la documentazione, viva</h2>
          <p className="mt-2 text-muted-foreground">Requisiti, manuale operativo e brochure aggiornati ad ogni iterazione di sviluppo.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link to="/manual" className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"><BookOpen className="h-4 w-4" /> Manuale</Link>
            <Link to="/brochure" className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm"><FileDown className="h-4 w-4" /> Brochure PDF</Link>
            <Link to="/features" className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm">Funzioni</Link>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}