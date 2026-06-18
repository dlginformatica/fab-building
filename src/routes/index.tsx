import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Building2, Wrench, Bell, Volume2, ShieldCheck, FileText } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "HotelOps — Building & Facility Management" },
      { name: "description", content: "Piattaforma di gestione impianti, ticket, SLA e fornitori per strutture alberghiere." },
      { property: "og:title", content: "HotelOps" },
      { property: "og:description", content: "Gestione facility per alberghi." },
    ],
  }),
  component: Index,
});

function Index() {
  const features = [
    { icon: Building2, t: "Asset & Impianti", d: "Anagrafica, categorie, ubicazione, QR code stampabili." },
    { icon: Wrench, t: "Trouble Ticketing", d: "Apertura, kanban, assegnazione, commenti, foto." },
    { icon: Bell, t: "SLA Engine", d: "Tempi di presa in carico e risoluzione automatici." },
    { icon: Volume2, t: "TTS Speaker", d: "Annuncio vocale dei ticket critici e degli SLA in violazione." },
    { icon: ShieldCheck, t: "Multi-tenant & Ruoli", d: "Più strutture, ruoli granulari, RLS lato DB." },
    { icon: FileText, t: "Documenti vivi", d: "Requisiti e manuale aggiornati a ogni iterazione." },
  ];
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-primary text-primary-foreground font-display font-bold">H</div>
            <span className="font-display text-lg font-semibold">HotelOps</span>
          </div>
          <div className="flex gap-2">
            <Link to="/auth" className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">Accedi</Link>
            <Link to="/auth" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">Inizia</Link>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-6 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-4 inline-block rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">Building & Facility Management per hotel</p>
          <h1 className="font-display text-5xl font-bold tracking-tight md:text-6xl">
            Tutto il facility del tuo hotel <span className="text-primary">in un'unica plancia</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            Asset, ticket, SLA, fornitori, contratti, bollette. Con annuncio vocale dei guasti critici.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link to="/auth" className="rounded-md bg-primary px-6 py-3 font-medium text-primary-foreground hover:opacity-90">Entra nell'app</Link>
            <Link to="/docs" className="rounded-md border border-border px-6 py-3 hover:bg-accent">Leggi i documenti</Link>
          </div>
        </div>
        <div className="mx-auto mt-20 grid max-w-6xl gap-4 md:grid-cols-3">
          {features.map(({ icon: Icon, t, d }) => (
            <div key={t} className="rounded-xl border border-border bg-card p-6">
              <div className="mb-3 inline-grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
              <h3 className="font-display text-lg font-semibold">{t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </main>
      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        HotelOps — Building & Facility Management
      </footer>
    </div>
  );
}
