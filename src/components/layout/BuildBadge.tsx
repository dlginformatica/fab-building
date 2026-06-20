import { BUILD_VERSION } from "@/lib/build-version";

/**
 * Badge fisso in basso a destra con il numero di build (yyyy.mm.dd.hh.mm).
 * Visibile su tutte le schermate, in qualsiasi route.
 */
export function BuildBadge() {
  return (
    <div
      className="pointer-events-none fixed bottom-1 right-2 z-[9999] select-none rounded bg-background/70 px-1.5 py-0.5 font-mono text-[10px] leading-none text-muted-foreground shadow-sm backdrop-blur"
      title={`Build ${BUILD_VERSION}`}
      aria-label={`Build ${BUILD_VERSION}`}
    >
      build {BUILD_VERSION}
    </div>
  );
}
