import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicHeader, PublicFooter } from "@/components/features/PublicHeader";
import manualeMd from "@/../docs/MANUALE_OPERATIVO.md?raw";
import { Download, BookOpen } from "lucide-react";

export const Route = createFileRoute("/manual")({
  head: () => ({
    meta: [
      { title: "Manuale Operativo — HotelOps" },
      { name: "description", content: "Manuale operativo completo della piattaforma HotelOps, aggiornato a ogni iterazione." },
      { property: "og:title", content: "Manuale Operativo — HotelOps" },
      { property: "og:description", content: "Documento vivo con changelog, fasi e dettagli operativi." },
    ],
  }),
  component: ManualPage,
});

function ManualPage() {
  function download() {
    const blob = new Blob([manualeMd], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "HotelOps-Manuale-Operativo.md";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      <main className="container mx-auto px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
              <BookOpen className="h-3 w-3" /> Documento vivo · aggiornato ad ogni iterazione
            </p>
            <h1 className="font-display text-3xl font-bold md:text-4xl">Manuale Operativo</h1>
            <p className="mt-2 text-muted-foreground">Tutto il funzionamento della piattaforma, fase per fase.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={download} className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-accent">
              <Download className="h-4 w-4" /> Scarica .md
            </button>
            <Link to="/brochure" className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
              Brochure PDF
            </Link>
          </div>
        </div>
        <article className="prose prose-sm md:prose-base mt-8 max-w-none rounded-xl border border-border bg-card p-6">
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground/90">{manualeMd}</pre>
        </article>
      </main>
      <PublicFooter />
    </div>
  );
}