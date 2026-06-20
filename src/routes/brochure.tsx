import { createFileRoute, Link } from "@tanstack/react-router";
import { FEATURE_CATALOG, CATEGORY_LABEL, FEATURES_BY_CATEGORY, type FeatureCategory } from "@/lib/features-catalog";
import { FeatureIcon } from "@/components/features/FeatureIcon";
import { PublicHeader, PublicFooter } from "@/components/features/PublicHeader";
import { Printer, FileDown } from "lucide-react";

export const Route = createFileRoute("/brochure")({
  head: () => ({
    meta: [
      { title: "Brochure — HotelOps" },
      { name: "description", content: "Brochure completa di HotelOps: visione, funzionalità, benefici, architettura. Versione HTML stampabile e PDF." },
      { property: "og:title", content: "Brochure — HotelOps" },
      { property: "og:description", content: "Scarica la brochure di HotelOps in PDF." },
    ],
  }),
  component: BrochurePage,
});

function BrochurePage() {
  const order: FeatureCategory[] = ["operativa", "governance", "finanza", "intelligenza"];
  const today = new Date().toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" });

  function handlePrint() {
    window.print();
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="print:hidden"><PublicHeader /></div>

      {/* Toolbar */}
      <div className="print:hidden border-b border-border bg-muted/30">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-3 px-6 py-3">
          <div className="text-sm text-muted-foreground">
            Brochure HotelOps · {today} · {FEATURE_CATALOG.length} moduli documentati
          </div>
          <div className="flex gap-2">
            <button onClick={handlePrint} className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
              <FileDown className="h-4 w-4" /> Scarica PDF
            </button>
            <button onClick={handlePrint} className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-accent">
              <Printer className="h-4 w-4" /> Stampa
            </button>
          </div>
        </div>
      </div>

      <main className="brochure container mx-auto px-6 py-10 print:px-10 print:py-6 print:max-w-none">
        {/* COVER */}
        <section className="brochure-page flex min-h-[80vh] flex-col justify-between rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-background p-10 print:border-0 print:rounded-none print:bg-white">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-lg bg-primary text-primary-foreground font-display text-xl font-bold">H</div>
            <span className="font-display text-2xl font-semibold">HotelOps</span>
          </div>
          <div>
            <p className="text-sm uppercase tracking-widest text-primary">Building &amp; Facility Management per hotel</p>
            <h1 className="font-display text-5xl font-bold tracking-tight md:text-6xl mt-4">Tutto il facility del tuo hotel in un'unica plancia</h1>
            <p className="mt-6 max-w-2xl text-lg text-muted-foreground">Asset, ticket, SLA, fornitori, manutenzione, bollette, ESG, report. Multi-tenant, multi-struttura, con AI dove serve.</p>
          </div>
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4 text-sm">
            <div><div className="text-3xl font-bold text-primary">{FEATURE_CATALOG.length}</div><div className="text-muted-foreground">moduli</div></div>
            <div><div className="text-3xl font-bold text-primary">6</div><div className="text-muted-foreground">ruoli applicativi</div></div>
            <div><div className="text-3xl font-bold text-primary">∞</div><div className="text-muted-foreground">strutture</div></div>
            <div><div className="text-3xl font-bold text-primary">SDI</div><div className="text-muted-foreground">fatturazione IT</div></div>
          </div>
          <div className="text-xs text-muted-foreground">Documento generato il {today} · Versione vivente, aggiornata ad ogni iterazione di sviluppo.</div>
        </section>

        {/* INDEX */}
        <section className="brochure-page mt-8 print:mt-12 print:break-before-page">
          <h2 className="font-display text-3xl font-bold">Indice</h2>
          <ol className="mt-6 space-y-2 text-sm">
            <li className="flex justify-between border-b border-dashed border-border py-1"><span>Visione e architettura</span><span className="text-muted-foreground">3</span></li>
            {order.map((cat, i) => (
              <li key={cat} className="flex justify-between border-b border-dashed border-border py-1">
                <span>{i + 1}. {CATEGORY_LABEL[cat]}</span>
                <span className="text-muted-foreground">{4 + i * 2}</span>
              </li>
            ))}
            <li className="flex justify-between border-b border-dashed border-border py-1"><span>Sicurezza, privacy e conformità</span><span className="text-muted-foreground">{4 + order.length * 2}</span></li>
            <li className="flex justify-between border-b border-dashed border-border py-1"><span>Contatti e prossimi passi</span><span className="text-muted-foreground">{5 + order.length * 2}</span></li>
          </ol>
        </section>

        {/* VISIONE */}
        <section className="brochure-page mt-8 print:mt-12 print:break-before-page">
          <h2 className="font-display text-3xl font-bold">Visione e architettura</h2>
          <p className="mt-3 text-muted-foreground">HotelOps unifica tutto il facility management di un hotel — o di una catena — in una piattaforma multi-tenant, multi-struttura, con flussi operativi pensati per chi vive davvero il backoffice e la sala macchine.</p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              { t: "Multi-tenant nativo", d: "Ogni organizzazione è isolata a livello DB con Row-Level Security. Più strutture per organizzazione." },
              { t: "Mobile-first", d: "QR code, PWA installabile, modalità offline con outbox e sincronizzazione." },
              { t: "AI dove serve", d: "OCR bollette, classificazione ticket, suggerimenti SLA, TTS speaker." },
              { t: "Conformità IT", d: "Fatturazione elettronica SDI, audit log completo, ruoli granulari." },
              { t: "Aperto", d: "Export PDF/CSV/XLSX/XML, webhook, integrazioni a sistemi esterni." },
              { t: "Documenti vivi", d: "Requisiti, manuale e brochure aggiornati ad ogni iterazione di sviluppo." },
            ].map((b) => (
              <div key={b.t} className="rounded-lg border border-border p-4">
                <div className="font-semibold">{b.t}</div>
                <div className="text-sm text-muted-foreground mt-1">{b.d}</div>
              </div>
            ))}
          </div>
        </section>

        {/* FEATURE SECTIONS */}
        {order.map((cat) => (
          <section key={cat} className="brochure-page mt-8 print:mt-12 print:break-before-page">
            <p className="text-xs uppercase tracking-widest text-primary">{CATEGORY_LABEL[cat]}</p>
            <h2 className="font-display text-3xl font-bold mt-1">{CATEGORY_LABEL[cat]}</h2>
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              {(FEATURES_BY_CATEGORY[cat] ?? []).map((f) => (
                <article key={f.slug} className="rounded-xl border border-border bg-card p-5 print:break-inside-avoid">
                  <div className="flex items-start gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary">
                      <FeatureIcon name={f.icon} className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-display text-lg font-semibold">{f.title}</h3>
                      <p className="text-sm text-muted-foreground">{f.tagline}</p>
                    </div>
                  </div>
                  <ul className="mt-3 space-y-1 text-sm">
                    {f.bullets.slice(0, 4).map((b) => <li key={b}>· {b}</li>)}
                  </ul>
                  <div className="mt-3 text-xs text-muted-foreground">
                    Benefici: {f.benefits.join(" · ")}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                    {f.rfRefs.map((r) => <span key={r} className="rounded bg-muted/40 px-1.5 py-0.5">{r}</span>)}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}

        {/* SICUREZZA */}
        <section className="brochure-page mt-8 print:mt-12 print:break-before-page">
          <h2 className="font-display text-3xl font-bold">Sicurezza, privacy e conformità</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 text-sm">
            <div className="rounded-lg border border-border p-4">
              <div className="font-semibold">Isolamento multi-tenant</div>
              <p className="mt-1 text-muted-foreground">Row-Level Security su tutte le tabelle pubbliche, organizzazioni isolate, super_admin con visibilità globale solo per supporto.</p>
            </div>
            <div className="rounded-lg border border-border p-4">
              <div className="font-semibold">Permessi granulari</div>
              <p className="mt-1 text-muted-foreground">Ruoli applicativi + deleghe per modulo/struttura con dipendenze obbligatorie auto-espanse a livello DB.</p>
            </div>
            <div className="rounded-lg border border-border p-4">
              <div className="font-semibold">Audit completo</div>
              <p className="mt-1 text-muted-foreground">Tutte le modifiche a permessi, deleghe, dati critici (fatture, contratti, cassa) sono tracciate con diff before/after.</p>
            </div>
            <div className="rounded-lg border border-border p-4">
              <div className="font-semibold">Conformità IT</div>
              <p className="mt-1 text-muted-foreground">Fatturazione elettronica SDI, GDPR-ready, log accessi negati con motivazione e alert admin.</p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="brochure-page mt-8 print:mt-12 print:break-before-page rounded-2xl border border-primary/40 bg-primary/5 p-10 text-center">
          <h2 className="font-display text-3xl font-bold">Pronto a metterlo in mano al tuo team?</h2>
          <p className="mt-3 max-w-2xl mx-auto text-muted-foreground">Registrati, crea la tua organizzazione, configura la prima struttura con l'onboarding guidato in 5 minuti.</p>
          <div className="mt-6 flex justify-center gap-3 print:hidden">
            <Link to="/auth" className="rounded-md bg-primary px-6 py-3 font-medium text-primary-foreground">Inizia ora</Link>
            <Link to="/features" className="rounded-md border border-border bg-card px-6 py-3 font-medium">Esplora le funzioni</Link>
          </div>
          <div className="mt-8 text-xs text-muted-foreground">HotelOps · Building &amp; Facility Management · {today}</div>
        </section>
      </main>

      <div className="print:hidden"><PublicFooter /></div>

      <style>{`
        @media print {
          @page { size: A4; margin: 14mm; }
          html, body { background: white !important; }
          .brochure-page { break-inside: avoid; }
          a { color: inherit; text-decoration: none; }
        }
      `}</style>
    </div>
  );
}