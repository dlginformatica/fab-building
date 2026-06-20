// Footer condiviso per le email transazionali HotelOps.
// Mantiene visibile il numero di build (yyyy.mm.dd.hh.mm) per supporto e tracciabilità.
import { BUILD_VERSION } from "@/lib/build-version";

/** Stringa plain-text — utile per email text/plain o subject di debug. */
export function emailFooterText(): string {
  return `— HotelOps · build ${BUILD_VERSION}`;
}

/** Frammento HTML pronto da concatenare al body delle email. */
export function emailFooterHtml(): string {
  return `
  <div style="margin-top:24px;padding-top:12px;border-top:1px solid #e2e8f0;
              font-family:Inter,Arial,sans-serif;font-size:11px;color:#64748b;
              display:flex;justify-content:space-between;gap:8px">
    <span>HotelOps · Building & Facility Management</span>
    <span style="font-family:ui-monospace,Menlo,Consolas,monospace">build ${BUILD_VERSION}</span>
  </div>`;
}
