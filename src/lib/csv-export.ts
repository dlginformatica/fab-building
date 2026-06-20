/** Esporta un array di oggetti in CSV scaricabile. */
import * as XLSX from "xlsx";
import { downloadBlob } from "@/lib/backup";
import { BUILD_VERSION } from "@/lib/build-version";

export function exportRowsAsCsv(rows: any[], filename: string) {
  const footer = `\n\n# HotelOps · build ${BUILD_VERSION} · esportato ${new Date().toISOString()}\n`;
  if (!rows?.length) { downloadBlob(new Blob([footer], { type: "text/csv" }), filename); return; }
  const ws = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws);
  downloadBlob(new Blob([csv + footer], { type: "text/csv;charset=utf-8" }), filename);
}

/** Apre una finestra di stampa con HTML del report — l'utente sceglie "Salva come PDF". */
export function printableHtmlAsPdf(title: string, columns: string[], rows: any[][]) {
  const w = window.open("", "_blank", "width=1000,height=700");
  if (!w) return;
  const head = `<thead><tr>${columns.map((c) => `<th>${c}</th>`).join("")}</tr></thead>`;
  const esc = (s: any) => (s ?? "").toString().replace(/[<>&]/g, (c: string) => ({ "<":"&lt;", ">":"&gt;", "&":"&amp;" } as Record<string,string>)[c]);
  const body = `<tbody>${rows.map((r) => `<tr>${r.map((c: any) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody>`;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
    <style>body{font-family:system-ui,sans-serif;margin:24px;color:#0f172a}h1{font-size:18px;margin:0 0 8px}p{color:#475569;font-size:12px}
    table{width:100%;border-collapse:collapse;font-size:11px;margin-top:12px}th,td{border:1px solid #cbd5e1;padding:6px;text-align:left;vertical-align:top}
    thead{background:#f1f5f9}@media print{button{display:none}}</style></head>
    <body><h1>${title}</h1><p>Generato il ${new Date().toLocaleString("it-IT")} — HotelOps</p>
    <button onclick="window.print()" style="margin:8px 0;padding:6px 12px">Stampa / Salva PDF</button>
    <table>${head}${body}</table>
    <footer style="position:fixed;bottom:8px;left:24px;right:24px;display:flex;justify-content:space-between;font-size:10px;color:#64748b;border-top:1px solid #cbd5e1;padding-top:4px">
      <span>HotelOps · ${title}</span><span>build ${BUILD_VERSION}</span>
    </footer>
    </body></html>`);
  w.document.close();
}