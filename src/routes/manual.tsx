import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicHeader, PublicFooter } from "@/components/features/PublicHeader";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useMemo, useState } from "react";
import utenteMd from "@/../docs/MANUALE_UTENTE.md?raw";
import manualeMd from "@/../docs/MANUALE_OPERATIVO.md?raw";
import { Download, BookOpen, List } from "lucide-react";

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
  const [tab, setTab] = useState<"utente" | "tecnico">("utente");
  const currentMd = tab === "utente" ? utenteMd : manualeMd;
  const currentName = tab === "utente" ? "HotelOps-Manuale-Utente.md" : "HotelOps-Manuale-Operativo.md";

  // TOC dal manuale utente (## headings)
  const toc = useMemo(() => {
    const lines = utenteMd.split("\n");
    return lines
      .filter((l) => /^##\s+/.test(l) && !/^##\s+Indice/i.test(l))
      .map((l) => {
        const text = l.replace(/^##\s+/, "").trim();
        const id = text
          .toLowerCase()
          .replace(/[^\w\s-]/g, "")
          .replace(/\s+/g, "-");
        return { text, id };
      });
  }, []);

  function download() {
    const blob = new Blob([currentMd], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = currentName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function slugify(text: string) {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-");
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
            <h1 className="font-display text-3xl font-bold md:text-4xl">Manuale HotelOps</h1>
            <p className="mt-2 text-muted-foreground">
              Guida completa all'uso della piattaforma. Due viste: <strong>Manuale Utente</strong> (procedure, FAQ, immagini) e <strong>Manuale Operativo</strong> (changelog tecnico).
            </p>
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

        <div className="mt-6 inline-flex rounded-lg border border-border bg-card p-1 text-sm">
          <button
            onClick={() => setTab("utente")}
            className={`rounded-md px-3 py-1.5 ${tab === "utente" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            Manuale Utente
          </button>
          <button
            onClick={() => setTab("tecnico")}
            className={`rounded-md px-3 py-1.5 ${tab === "tecnico" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            Manuale Operativo (tecnico)
          </button>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr]">
          {tab === "utente" ? (
            <aside className="lg:sticky lg:top-6 lg:self-start rounded-xl border border-border bg-card p-4 text-sm">
              <p className="mb-3 flex items-center gap-2 font-medium">
                <List className="h-4 w-4" /> Capitoli
              </p>
              <nav className="space-y-1.5">
                {toc.map((t) => (
                  <a key={t.id} href={`#${t.id}`} className="block text-muted-foreground hover:text-foreground">
                    {t.text}
                  </a>
                ))}
              </nav>
            </aside>
          ) : (
            <div />
          )}
          <article className="rounded-xl border border-border bg-card p-6 md:p-8">
            {tab === "utente" ? (
              <div className="prose prose-sm md:prose-base prose-invert max-w-none prose-headings:font-display prose-headings:scroll-mt-24 prose-img:rounded-lg prose-img:border prose-img:border-border prose-a:text-primary prose-table:text-sm">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h2: ({ children, ...props }) => {
                      const text = String(children);
                      return (
                        <h2 id={slugify(text)} {...props}>
                          {children}
                        </h2>
                      );
                    },
                  }}
                >
                  {utenteMd}
                </ReactMarkdown>
              </div>
            ) : (
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground/90">{manualeMd}</pre>
            )}
          </article>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}