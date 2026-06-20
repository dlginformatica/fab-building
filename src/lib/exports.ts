// Helper unificati per export CSV/PDF e condivisione.
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { BUILD_VERSION } from "@/lib/build-version";

export type Column<T> = { header: string; key: keyof T | string; format?: (row: T) => string | number };

function escCsv(v: any) { return `"${String(v ?? "").replace(/"/g, '""')}"`; }

export function exportCSV<T extends Record<string, any>>(filename: string, rows: T[], cols: Column<T>[]) {
  const head = cols.map((c) => c.header).join(",");
  const body = rows.map((r) => cols.map((c) => escCsv(c.format ? c.format(r) : (r as any)[c.key])).join(",")).join("\n");
  const footer = `\n\n# HotelOps · build ${BUILD_VERSION} · esportato ${new Date().toISOString()}\n`;
  const blob = new Blob([head + "\n" + body + footer], { type: "text/csv;charset=utf-8" });
  triggerDownload(blob, filename.endsWith(".csv") ? filename : `${filename}.csv`);
}

export function exportPDF<T extends Record<string, any>>(filename: string, title: string, rows: T[], cols: Column<T>[], subtitle?: string) {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14); doc.text(`HotelOps · ${title}`, 14, 16);
  doc.setFontSize(9);
  doc.text(`${subtitle ?? ""} · ${rows.length} righe · ${new Date().toLocaleString("it-IT")}`, 14, 22);
  autoTable(doc, {
    startY: 26,
    head: [cols.map((c) => c.header)],
    body: rows.map((r) => cols.map((c) => String(c.format ? c.format(r) : (r as any)[c.key] ?? ""))),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [15, 58, 74] },
  });
  // Build badge nel footer di ogni pagina
  const total = doc.getNumberOfPages();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.text(`HotelOps · build ${BUILD_VERSION}`, 14, pageH - 6);
    const right = `Pag. ${p} / ${total}`;
    doc.text(right, pageW - 14 - doc.getTextWidth(right), pageH - 6);
    doc.setTextColor(0);
  }
  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}

export async function shareLink(url: string, title = "HotelOps") {
  try {
    if (navigator.share) { await navigator.share({ title, url }); return; }
    await navigator.clipboard.writeText(url);
    toast.success("Link copiato negli appunti");
  } catch {
    toast.error("Condivisione non disponibile");
  }
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}