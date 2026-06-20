// Generatore PDF lato client per il Manuale Utente HotelOps.
// - Copertina con titolo, sottotitolo, versione e data
// - Indice (TOC) con numeri pagina cliccabili
// - Contenuto markdown impaginato (titoli, paragrafi, liste, immagini, tabelle)
// - Numerazione pagine "Pag. X / Y" nel footer
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { marked, type Tokens } from "marked";
import { BUILD_VERSION } from "@/lib/build-version";

type Heading = { level: number; text: string; page: number };

const PAGE = { w: 210, h: 297 }; // A4 mm
const M = { top: 22, bottom: 18, left: 18, right: 18 };
const CONTENT_W = PAGE.w - M.left - M.right;
const FOOTER_Y = PAGE.h - 10;

const COLORS = {
  primary: [15, 58, 74] as [number, number, number],
  accent: [8, 145, 178] as [number, number, number],
  muted: [100, 116, 139] as [number, number, number],
  text: [15, 23, 42] as [number, number, number],
  rule: [203, 213, 225] as [number, number, number],
};

export type ManualPdfOptions = {
  title: string;
  subtitle?: string;
  version?: string;
  filenameBase?: string; // es. "hotelops_manuale_utente"
  markdown: string;
};

export async function generateManualPdf(opts: ManualPdfOptions): Promise<{ filename: string; blob: Blob }> {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const today = new Date();
  const dateLabel = today.toLocaleDateString("it-IT", { year: "numeric", month: "long", day: "2-digit" });
  const dateStamp = today.toISOString().slice(0, 10);
  const version = opts.version ?? `v${dateStamp}`;

  // --- COPERTINA ---
  drawCover(doc, opts.title, opts.subtitle ?? "Documento vivo", version, dateLabel);

  // --- INDICE (placeholder pagina) ---
  doc.addPage();
  const tocPage = doc.getNumberOfPages();

  // --- CONTENUTO ---
  doc.addPage();
  const headings: Heading[] = [];
  const cursor = { y: M.top };
  setBodyFont(doc);

  const tokens = marked.lexer(opts.markdown);
  for (const tok of tokens) {
    await renderToken(doc, tok as Tokens.Generic, cursor, headings);
  }

  // --- TOC: torno alla pagina indice e disegno la lista ---
  drawToc(doc, tocPage, headings);

  // --- FOOTER con numerazione su tutte le pagine tranne copertina ---
  const total = doc.getNumberOfPages();
  for (let p = 2; p <= total; p++) {
    doc.setPage(p);
    drawFooter(doc, p, total, opts.title);
  }

  const filenameBase = opts.filenameBase ?? "hotelops_manuale";
  const filename = `${filenameBase}_${version}_${dateStamp}.pdf`;
  const blob = doc.output("blob");
  return { filename, blob };
}

export async function downloadManualPdf(opts: ManualPdfOptions) {
  const { filename, blob } = await generateManualPdf(opts);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

// ---------- helpers ----------

function setBodyFont(doc: jsPDF) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(...COLORS.text);
}

function ensureSpace(doc: jsPDF, cursor: { y: number }, needed: number) {
  if (cursor.y + needed > PAGE.h - M.bottom) {
    doc.addPage();
    cursor.y = M.top;
    setBodyFont(doc);
  }
}

function drawCover(doc: jsPDF, title: string, subtitle: string, version: string, date: string) {
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, PAGE.w, PAGE.h, "F");
  doc.setFillColor(...COLORS.accent);
  doc.rect(0, PAGE.h - 90, PAGE.w, 90, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("HOTELOPS", M.left, 35);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(34);
  const lines = doc.splitTextToSize(title, CONTENT_W);
  doc.text(lines, M.left, 110);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(14);
  doc.text(subtitle, M.left, 110 + lines.length * 12 + 4);

  doc.setFontSize(11);
  doc.text(`Versione ${version}`, M.left, PAGE.h - 50);
  doc.text(`Data: ${date}`, M.left, PAGE.h - 42);
  doc.text("Building & Facility Management per strutture alberghiere", M.left, PAGE.h - 20);
}

function drawFooter(doc: jsPDF, page: number, total: number, title: string) {
  doc.setDrawColor(...COLORS.rule);
  doc.setLineWidth(0.2);
  doc.line(M.left, FOOTER_Y - 4, PAGE.w - M.right, FOOTER_Y - 4);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...COLORS.muted);
  doc.text(`HotelOps · ${title} · build ${BUILD_VERSION}`, M.left, FOOTER_Y);
  const label = `Pag. ${page} / ${total}`;
  const w = doc.getTextWidth(label);
  doc.text(label, PAGE.w - M.right - w, FOOTER_Y);
}

function drawToc(doc: jsPDF, tocPage: number, headings: Heading[]) {
  doc.setPage(tocPage);
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, PAGE.w, PAGE.h, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...COLORS.primary);
  doc.text("Indice", M.left, M.top + 6);

  doc.setDrawColor(...COLORS.rule);
  doc.line(M.left, M.top + 10, PAGE.w - M.right, M.top + 10);

  let y = M.top + 22;
  setBodyFont(doc);
  for (const h of headings) {
    if (h.level > 2) continue;
    if (y > PAGE.h - M.bottom - 8) {
      // overflow indice: ignoriamo voci eccedenti per non rompere il layout
      break;
    }
    const indent = (h.level - 1) * 6;
    const label = h.text.replace(/^\d+\.\s*/, "");
    const num = `${h.page}`;
    const numW = doc.getTextWidth(num);
    const maxLabel = CONTENT_W - indent - numW - 4;
    const text = clip(doc, label, maxLabel);
    doc.setFont("helvetica", h.level === 1 ? "bold" : "normal");
    doc.setTextColor(...COLORS.text);
    doc.textWithLink(text, M.left + indent, y, { pageNumber: h.page });
    // dots
    const dotsStart = M.left + indent + doc.getTextWidth(text) + 1.5;
    const dotsEnd = PAGE.w - M.right - numW - 1.5;
    if (dotsEnd > dotsStart) {
      doc.setTextColor(...COLORS.muted);
      const dots = ".".repeat(Math.max(0, Math.floor((dotsEnd - dotsStart) / 1.4)));
      doc.text(dots, dotsStart, y);
    }
    doc.setTextColor(...COLORS.text);
    doc.text(num, PAGE.w - M.right - numW, y);
    y += 6.5;
  }
}

function clip(doc: jsPDF, text: string, maxW: number) {
  if (doc.getTextWidth(text) <= maxW) return text;
  let t = text;
  while (t.length > 3 && doc.getTextWidth(t + "…") > maxW) t = t.slice(0, -1);
  return t + "…";
}

async function renderToken(doc: jsPDF, tok: Tokens.Generic, cursor: { y: number }, headings: Heading[]) {
  switch (tok.type) {
    case "heading":
      return renderHeading(doc, tok as Tokens.Heading, cursor, headings);
    case "paragraph":
      return renderParagraph(doc, (tok as Tokens.Paragraph).text, cursor);
    case "list":
      return renderList(doc, tok as Tokens.List, cursor);
    case "blockquote":
      return renderBlockquote(doc, (tok as Tokens.Blockquote).text, cursor);
    case "table":
      return renderTable(doc, tok as Tokens.Table, cursor);
    case "hr":
      ensureSpace(doc, cursor, 6);
      doc.setDrawColor(...COLORS.rule);
      doc.line(M.left, cursor.y, PAGE.w - M.right, cursor.y);
      cursor.y += 4;
      return;
    case "code":
      return renderCode(doc, (tok as Tokens.Code).text, cursor);
    case "space":
      cursor.y += 2;
      return;
    case "html": {
      // intercetta <img> e tag base, ignora il resto
      const html = (tok as Tokens.HTML).text ?? "";
      const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (imgMatch) await renderImage(doc, imgMatch[1], cursor);
      return;
    }
    default:
      // tipi non gestiti: ignoro
      return;
  }
}

async function renderHeading(doc: jsPDF, t: Tokens.Heading, cursor: { y: number }, headings: Heading[]) {
  const sizes: Record<number, number> = { 1: 20, 2: 15, 3: 12.5, 4: 11.5, 5: 11, 6: 10.5 };
  const size = sizes[t.depth] ?? 11;
  const needs = size * 0.55 + 6;
  // h1/h2: spinta a nuova pagina se già a metà
  if (t.depth <= 2 && cursor.y > M.top + 8) {
    if (t.depth === 1) {
      doc.addPage();
      cursor.y = M.top;
    } else {
      ensureSpace(doc, cursor, 30);
    }
  } else {
    ensureSpace(doc, cursor, needs + 4);
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(size);
  doc.setTextColor(...(t.depth <= 2 ? COLORS.primary : COLORS.text));
  const lines = doc.splitTextToSize(stripInline(t.text), CONTENT_W);
  doc.text(lines, M.left, cursor.y + size * 0.35);
  if (t.depth <= 2) {
    headings.push({ level: t.depth, text: stripInline(t.text), page: doc.getNumberOfPages() });
    if (t.depth === 2) {
      doc.setDrawColor(...COLORS.accent);
      doc.setLineWidth(0.6);
      const yLine = cursor.y + size * 0.5 + 1.5;
      doc.line(M.left, yLine, M.left + 18, yLine);
    }
  }
  cursor.y += size * 0.5 + 3 + (lines.length - 1) * size * 0.45;
  setBodyFont(doc);
}

async function renderParagraph(doc: jsPDF, raw: string, cursor: { y: number }) {
  // intercetta sintassi immagine markdown: ![alt](src)
  const imgRe = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = imgRe.exec(raw))) {
    const before = raw.slice(last, m.index).trim();
    if (before) renderTextBlock(doc, before, cursor);
    await renderImage(doc, m[2], cursor, m[1]);
    last = m.index + m[0].length;
  }
  const tail = raw.slice(last).trim();
  if (tail) renderTextBlock(doc, tail, cursor);
}

function renderTextBlock(doc: jsPDF, text: string, cursor: { y: number }) {
  setBodyFont(doc);
  const clean = stripInline(text);
  const lines = doc.splitTextToSize(clean, CONTENT_W) as string[];
  for (const line of lines) {
    ensureSpace(doc, cursor, 5);
    doc.text(line, M.left, cursor.y);
    cursor.y += 5;
  }
  cursor.y += 1.5;
}

function renderList(doc: jsPDF, t: Tokens.List, cursor: { y: number }) {
  setBodyFont(doc);
  let i = 1;
  for (const item of t.items) {
    const bullet = t.ordered ? `${i}.` : "•";
    const text = stripInline(item.text);
    const lines = doc.splitTextToSize(text, CONTENT_W - 6) as string[];
    for (let k = 0; k < lines.length; k++) {
      ensureSpace(doc, cursor, 5);
      if (k === 0) doc.text(bullet, M.left, cursor.y);
      doc.text(lines[k], M.left + 6, cursor.y);
      cursor.y += 5;
    }
    i++;
  }
  cursor.y += 2;
}

function renderBlockquote(doc: jsPDF, text: string, cursor: { y: number }) {
  setBodyFont(doc);
  const clean = stripInline(text);
  const lines = doc.splitTextToSize(clean, CONTENT_W - 8) as string[];
  const h = lines.length * 5 + 2;
  ensureSpace(doc, cursor, h);
  doc.setDrawColor(...COLORS.accent);
  doc.setLineWidth(1.2);
  doc.line(M.left, cursor.y - 3, M.left, cursor.y + h - 5);
  doc.setTextColor(...COLORS.muted);
  for (const line of lines) {
    doc.text(line, M.left + 4, cursor.y);
    cursor.y += 5;
  }
  doc.setTextColor(...COLORS.text);
  cursor.y += 2;
}

function renderCode(doc: jsPDF, code: string, cursor: { y: number }) {
  doc.setFont("courier", "normal");
  doc.setFontSize(9);
  const lines = doc.splitTextToSize(code, CONTENT_W - 4) as string[];
  const h = lines.length * 4.2 + 4;
  ensureSpace(doc, cursor, h);
  doc.setFillColor(241, 245, 249);
  doc.rect(M.left, cursor.y - 3, CONTENT_W, h, "F");
  for (const line of lines) {
    doc.text(line, M.left + 2, cursor.y);
    cursor.y += 4.2;
  }
  cursor.y += 2;
  setBodyFont(doc);
}

function renderTable(doc: jsPDF, t: Tokens.Table, cursor: { y: number }) {
  const head = [t.header.map((h: any) => stripInline(h.text))];
  const body = t.rows.map((row: any[]) => row.map((c) => stripInline(c.text)));
  autoTable(doc, {
    startY: cursor.y,
    head,
    body,
    margin: { left: M.left, right: M.right },
    styles: { fontSize: 9, cellPadding: 2, textColor: COLORS.text },
    headStyles: { fillColor: COLORS.primary, textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didDrawPage: () => {
      // niente: footer aggiunto a fine generazione
    },
  });
  // @ts-expect-error jsPDF augmented by autoTable
  cursor.y = (doc.lastAutoTable?.finalY ?? cursor.y) + 4;
}

async function renderImage(doc: jsPDF, src: string, cursor: { y: number }, alt?: string) {
  try {
    const { dataUrl, w, h } = await loadImage(src);
    const ratio = h / w;
    const drawW = Math.min(CONTENT_W, 160);
    const drawH = drawW * ratio;
    ensureSpace(doc, cursor, drawH + (alt ? 6 : 2));
    const fmt = dataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
    doc.addImage(dataUrl, fmt, M.left, cursor.y, drawW, drawH);
    cursor.y += drawH + 2;
    if (alt) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8.5);
      doc.setTextColor(...COLORS.muted);
      doc.text(alt, M.left, cursor.y);
      cursor.y += 5;
      setBodyFont(doc);
    }
  } catch {
    setBodyFont(doc);
    doc.setTextColor(...COLORS.muted);
    ensureSpace(doc, cursor, 5);
    doc.text(`[immagine non disponibile: ${alt || src}]`, M.left, cursor.y);
    cursor.y += 5;
    setBodyFont(doc);
  }
}

const imageCache = new Map<string, { dataUrl: string; w: number; h: number }>();

async function loadImage(src: string): Promise<{ dataUrl: string; w: number; h: number }> {
  if (imageCache.has(src)) return imageCache.get(src)!;
  const url = src.startsWith("http") ? src : src.startsWith("/") ? src : `/${src}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} -> ${res.status}`);
  const blob = await res.blob();
  const dataUrl: string = await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(blob);
  });
  const dims: { w: number; h: number } = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth || 1200, h: img.naturalHeight || 700 });
    img.onerror = () => reject(new Error("image decode failed"));
    img.src = dataUrl;
  });
  const out = { dataUrl, ...dims };
  imageCache.set(src, out);
  return out;
}

function stripInline(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/&nbsp;/g, " ")
    .replace(/\r/g, "");
}