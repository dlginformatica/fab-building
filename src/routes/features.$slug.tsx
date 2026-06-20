import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { FEATURE_CATALOG, getFeature } from "@/lib/features-catalog";
import { FeatureIcon } from "@/components/features/FeatureIcon";
import { FeatureScreenshot } from "@/components/features/FeatureScreenshot";
import { PublicHeader, PublicFooter } from "@/components/features/PublicHeader";
import { ArrowLeft, ArrowRight, Check, Workflow } from "lucide-react";

export const Route = createFileRoute("/features/$slug")({
  loader: ({ params }) => {
    const feature = getFeature(params.slug);
    if (!feature) throw notFound();
    return { feature };
  },
  head: ({ loaderData }) => {
    const f = loaderData?.feature;
    if (!f) return { meta: [{ title: "Funzione non trovata — HotelOps" }] };
    return {
      meta: [
        { title: `${f.title} — HotelOps` },
        { name: "description", content: f.tagline },
        { property: "og:title", content: `${f.title} — HotelOps` },
        { property: "og:description", content: f.tagline },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="min-h-screen grid place-items-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-2xl font-bold">Funzione non trovata</h1>
        <p className="mt-2 text-sm text-muted-foreground">Il modulo richiesto non esiste o è stato rinominato.</p>
        <Link to="/features" className="mt-4 inline-flex items-center text-sm text-primary"><ArrowLeft className="mr-1 h-4 w-4"/>Torna al catalogo</Link>
      </div>
    </div>
  ),
  component: FeatureDetail,
});

function FeatureDetail() {
  const { feature: f } = Route.useLoaderData();
  const idx = FEATURE_CATALOG.findIndex((x) => x.slug === f.slug);
  const prev = idx > 0 ? FEATURE_CATALOG[idx - 1] : null;
  const next = idx < FEATURE_CATALOG.length - 1 ? FEATURE_CATALOG[idx + 1] : null;

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      <main className="container mx-auto px-6 py-10">
        <Link to="/features" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1 h-4 w-4" /> Tutte le funzioni
        </Link>

        <header className="mt-6 flex flex-wrap items-start gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-xl bg-primary/10 text-primary">
            <FeatureIcon name={f.icon} className="h-7 w-7" />
          </div>
          <div className="flex-1 min-w-[260px]">
            <h1 className="font-display text-3xl font-bold md:text-4xl">{f.title}</h1>
            <p className="mt-2 text-lg text-muted-foreground">{f.tagline}</p>
          </div>
          <Link
            to="/auth"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Provalo in app
          </Link>
        </header>

        <section className="mt-10 grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-8">
            <div>
              <h2 className="font-display text-xl font-semibold mb-3">Cosa fa</h2>
              <ul className="space-y-2">
                {f.bullets.map((b) => (
                  <li key={b} className="flex gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h2 className="font-display text-xl font-semibold mb-3">Schermate</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {f.screenshots.map((s) => (
                  <FeatureScreenshot key={s.src} src={s.src} caption={s.caption} />
                ))}
              </div>
            </div>

            <div>
              <h2 className="font-display text-xl font-semibold mb-3 flex items-center gap-2">
                <Workflow className="h-5 w-5 text-primary" /> Flusso operativo
              </h2>
              <ol className="space-y-2">
                {f.flow.map((step, i) => (
                  <li key={step} className="flex gap-3 text-sm">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{i + 1}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Benefici chiave</div>
              <ul className="mt-2 space-y-1.5 text-sm">
                {f.benefits.map((b) => <li key={b}>· {b}</li>)}
              </ul>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Moduli coinvolti</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {f.modules.map((m) => (
                  <span key={m} className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px]">{m}</span>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Requisiti funzionali</div>
              <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                {f.rfRefs.map((r) => <span key={r} className="rounded bg-muted/40 px-1.5 py-0.5">{r}</span>)}
              </div>
              <Link to="/manual" className="mt-3 inline-block text-xs text-primary underline">Leggi nel manuale →</Link>
            </div>
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-5">
              <div className="font-semibold">Pronto a provarlo?</div>
              <p className="mt-1 text-sm text-muted-foreground">Accedi alla piattaforma e apri <code className="rounded bg-muted px-1 py-0.5 text-xs">{f.appPath}</code>.</p>
              <Link to="/auth" className="mt-3 inline-flex items-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">Entra ora</Link>
            </div>
          </aside>
        </section>

        <nav className="mt-12 flex items-center justify-between border-t border-border pt-6">
          {prev ? (
            <Link to="/features/$slug" params={{ slug: prev.slug }} className="text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="mr-1 inline h-4 w-4" /> {prev.title}
            </Link>
          ) : <span />}
          {next ? (
            <Link to="/features/$slug" params={{ slug: next.slug }} className="text-sm text-muted-foreground hover:text-foreground">
              {next.title} <ArrowRight className="ml-1 inline h-4 w-4" />
            </Link>
          ) : <span />}
        </nav>
      </main>
      <PublicFooter />
    </div>
  );
}