import { useState } from "react";
import { ImageIcon } from "lucide-react";

/**
 * Mostra uno screenshot reale (da /public/screens/...) con fallback a un wireframe
 * stilizzato se l'immagine non è ancora stata catturata. In questo modo la pagina
 * resta presentabile mentre raccogliamo le immagini reali via browser headless.
 */
export function FeatureScreenshot({ src, caption }: { src: string; caption: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <figure className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="relative aspect-[16/10] w-full bg-gradient-to-br from-muted/40 to-background">
        {!failed ? (
          <img
            src={src}
            alt={caption}
            loading="lazy"
            className="h-full w-full object-cover"
            onError={() => setFailed(true)}
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center">
            <div className="w-[88%] space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
                <div className="h-2.5 w-2.5 rounded-full bg-warning/60" />
                <div className="h-2.5 w-2.5 rounded-full bg-success/60" />
                <div className="ml-3 h-2 w-40 rounded bg-muted-foreground/20" />
              </div>
              <div className="h-3 w-2/3 rounded bg-muted-foreground/25" />
              <div className="grid grid-cols-4 gap-2 pt-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-10 rounded bg-muted-foreground/15" />
                ))}
              </div>
              <div className="space-y-1.5 pt-3">
                <div className="h-2 w-full rounded bg-muted-foreground/15" />
                <div className="h-2 w-5/6 rounded bg-muted-foreground/15" />
                <div className="h-2 w-4/6 rounded bg-muted-foreground/15" />
              </div>
              <div className="flex items-center gap-1.5 pt-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                <ImageIcon className="h-3 w-3" /> anteprima · screenshot in arrivo
              </div>
            </div>
          </div>
        )}
      </div>
      <figcaption className="border-t border-border bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
        {caption}
      </figcaption>
    </figure>
  );
}