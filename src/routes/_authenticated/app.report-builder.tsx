import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveStructure } from "@/lib/structure-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Save, FileDown, FileSpreadsheet, Play, Trash2, Calendar } from "lucide-react";
import QRCode from "qrcode";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/app/report-builder")({ component: Page });

type Source = { table: string; label: string; cols: string[]; date?: string };
const SOURCES: Source[] = [
  { table: "tickets", label: "Ticket", date: "created_at", cols: ["ticket_number","title","priority","status","created_at","resolved_at","ack_due_at","resolve_due_at"] },
  { table: "assets", label: "Asset", date: "created_at", cols: ["code","name","status","brand","model","serial_number","purchase_date","warranty_until"] },
  { table: "work_orders", label: "Ordini di Lavoro", date: "created_at", cols: ["wo_number","title","status","planned_at","completed_at","cost","hours"] },
  { table: "invoices", label: "Fatture", date: "issue_date", cols: ["invoice_number","supplier_name","utility_type","amount_total","status","issue_date","due_date"] },
  { table: "suppliers", label: "Fornitori", date: "created_at", cols: ["name","vat","email","phone","rating","status"] },
  { table: "contracts", label: "Contratti", date: "start_date", cols: ["name","supplier_name","start_date","end_date","amount","status"] },
  { table: "inventory_items", label: "Magazzino", date: "created_at", cols: ["code","name","quantity","unit","min_quantity","unit_cost"] },
  { table: "sla_violations", label: "Violazioni SLA", date: "created_at", cols: ["kind","delay_minutes","penalty_eur","status","created_at"] },
];

function Page() {
  const qc = useQueryClient();
  const { activeStructureId } = useActiveStructure();
  const [source, setSource] = useState<Source>(SOURCES[0]);
  const [cols, setCols] = useState<string[]>(SOURCES[0].cols);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [name, setName] = useState("");
  const [rows, setRows] = useState<any[] | null>(null);
  const [layout, setLayout] = useState({
    header: "HotelOps · Report direzionale",
    subheader: "",
    footer: "Documento riservato · generato automaticamente da HotelOps",
    signature: "",
    qr_url: "",
  });
  const [schedule, setSchedule] = useState("");

  const { data: templates } = useQuery({
    queryKey: ["report_templates"],
    queryFn: async () => ((await (supabase as any).from("report_templates").select("*").order("updated_at",{ascending:false})).data ?? []),
  });

  const run = useMutation({
    mutationFn: async () => {
      let q: any = (supabase as any).from(source.table).select(cols.join(","));
      if (activeStructureId && ["tickets","assets","work_orders","invoices","contracts","inventory_items","sla_violations"].includes(source.table))
        q = q.eq("structure_id", activeStructureId);
      if (source.date && from) q = q.gte(source.date, from);
      if (source.date && to) q = q.lte(source.date, to + (source.date.includes("date") ? "" : "T23:59:59"));
      const { data, error } = await q.limit(5000);
      if (error) throw error;
      setRows(data ?? []);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const save = useMutation({
    mutationFn: async () => {
      const user = (await supabase.auth.getUser()).data.user;
      const { error } = await (supabase as any).from("report_templates").insert({
        name, source: source.table, columns: cols, filters: { from, to },
        layout, schedule_cron: schedule || null,
        owner_id: user?.id, structure_id: activeStructureId,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Modello salvato"); qc.invalidateQueries({ queryKey: ["report_templates"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const loadTemplate = (t: any) => {
    const s = SOURCES.find(x => x.table === t.source) ?? SOURCES[0];
    setSource(s); setCols(t.columns ?? s.cols);
    setFrom(t.filters?.from ?? ""); setTo(t.filters?.to ?? "");
    setName(t.name); setRows(null);
    if (t.layout) setLayout({ ...layout, ...t.layout });
    if (t.schedule_cron) setSchedule(t.schedule_cron);
  };

  const delTpl = useMutation({
    mutationFn: async (id: string) => { const { error } = await (supabase as any).from("report_templates").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["report_templates"] }),
  });

  const exportPdf = async () => {
    if (!rows) return;
    const doc = new jsPDF({ orientation: cols.length > 5 ? "landscape" : "portrait" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    // QR (optional)
    let qrDataUrl = "";
    if (layout.qr_url) {
      try { qrDataUrl = await QRCode.toDataURL(layout.qr_url, { margin: 0, width: 120 }); } catch { /* ignore */ }
    }

    const drawHeaderFooter = (pageNum: number, pageCount: number) => {
      // Header
      doc.setFontSize(13); doc.setFont("helvetica", "bold");
      doc.text(layout.header || "Report", 14, 14);
      doc.setFontSize(9); doc.setFont("helvetica", "normal");
      doc.text(`${name || source.label} · Periodo: ${from || "—"} → ${to || "—"} · Righe: ${rows.length}`, 14, 20);
      if (layout.subheader) { doc.setFontSize(8); doc.text(layout.subheader, 14, 25); }
      doc.setDrawColor(180); doc.line(14, 27, pageW - 14, 27);
      // QR top-right
      if (qrDataUrl) doc.addImage(qrDataUrl, "PNG", pageW - 32, 8, 22, 22);
      // Footer
      doc.setDrawColor(180); doc.line(14, pageH - 18, pageW - 14, pageH - 18);
      doc.setFontSize(8);
      doc.text(layout.footer || "", 14, pageH - 12);
      doc.text(`Pagina ${pageNum} di ${pageCount} · ${new Date().toLocaleString("it-IT")}`, pageW - 14, pageH - 12, { align: "right" });
      if (layout.signature) {
        doc.setFontSize(8);
        doc.text(`Firma: ${layout.signature}`, 14, pageH - 6);
      }
    };

    autoTable(doc, {
      startY: 32,
      margin: { top: 32, bottom: 22 },
      head: [cols],
      body: rows.map((r) => cols.map((c) => String(r[c] ?? ""))),
      styles: { fontSize: 7 },
      didDrawPage: () => {
        const pc = (doc as any).internal.getNumberOfPages?.() ?? 1;
        drawHeaderFooter((doc as any).internal.getCurrentPageInfo?.().pageNumber ?? 1, pc);
      },
    });
    doc.save(`${(name || source.label).replace(/\s+/g, "_")}.pdf`);

    // Mark last_run on template if loaded by name
    if (name) {
      await (supabase as any).from("report_templates").update({ last_run_at: new Date().toISOString() }).eq("name", name);
    }
  };
  const exportCsv = () => {
    if (!rows) return;
    const esc = (v: any) => `"${String(v ?? "").replace(/"/g,'""')}"`;
    const csv = [cols.join(","), ...rows.map(r => cols.map(c => esc(r[c])).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${name || source.label}.csv`; a.click();
  };

  const preview = useMemo(() => (rows ?? []).slice(0, 50), [rows]);

  return (
    <div className="space-y-6">
      <div><h1 className="font-display text-2xl font-bold">Report Builder</h1>
        <p className="text-sm text-muted-foreground">Generatore universale: scegli sorgente, colonne, filtri ed esporta in PDF o CSV.</p></div>
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <Card>
          <CardHeader><CardTitle className="font-display text-base">Configurazione</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="space-y-1 md:col-span-2"><Label>Nome report</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Es. Ticket Q1 2026" /></div>
              <div className="space-y-1"><Label>Sorgente</Label>
                <Select value={source.table} onValueChange={(v) => { const s = SOURCES.find(x=>x.table===v)!; setSource(s); setCols(s.cols); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SOURCES.map(s => <SelectItem key={s.table} value={s.table}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Da</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
              <div className="space-y-1"><Label>A</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            </div>
            <div>
              <Label className="mb-2 block">Colonne</Label>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                {source.cols.map(c => (
                  <label key={c} className="flex items-center gap-2 rounded-md border border-border p-2 text-xs">
                    <Checkbox checked={cols.includes(c)} onCheckedChange={(v) => setCols(v ? [...new Set([...cols, c])] : cols.filter(x => x !== c))} />
                    <span className="font-mono">{c}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => run.mutate()} disabled={run.isPending || cols.length === 0}><Play className="mr-1 h-4 w-4" />Esegui</Button>
              <Button variant="outline" onClick={() => save.mutate()} disabled={!name || save.isPending}><Save className="mr-1 h-4 w-4" />Salva modello</Button>
              <Button variant="outline" onClick={exportPdf} disabled={!rows}><FileDown className="mr-1 h-4 w-4" />PDF</Button>
              <Button variant="outline" onClick={exportCsv} disabled={!rows}><FileSpreadsheet className="mr-1 h-4 w-4" />CSV</Button>
            </div>
            <div className="rounded-md border border-dashed border-border p-3">
              <div className="mb-2 text-sm font-medium">Layout PDF</div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1"><Label>Intestazione</Label><Input value={layout.header} onChange={(e) => setLayout({ ...layout, header: e.target.value })} /></div>
                <div className="space-y-1"><Label>Sotto-intestazione</Label><Input value={layout.subheader} onChange={(e) => setLayout({ ...layout, subheader: e.target.value })} /></div>
                <div className="space-y-1 md:col-span-2"><Label>Piè di pagina</Label><Textarea rows={2} value={layout.footer} onChange={(e) => setLayout({ ...layout, footer: e.target.value })} /></div>
                <div className="space-y-1"><Label>Firma (nome / ruolo)</Label><Input value={layout.signature} onChange={(e) => setLayout({ ...layout, signature: e.target.value })} placeholder="es. Mario Rossi · Direttore" /></div>
                <div className="space-y-1"><Label>QR (URL o testo)</Label><Input value={layout.qr_url} onChange={(e) => setLayout({ ...layout, qr_url: e.target.value })} placeholder="https://..." /></div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Label className="text-xs">Pianificazione (cron)</Label>
                <Input className="max-w-[220px]" value={schedule} onChange={(e) => setSchedule(e.target.value)} placeholder="0 8 * * 1  (lun ore 8)" />
                <span className="text-xs text-muted-foreground">Salva il modello per attivarla.</span>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="font-display text-base">Modelli salvati</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(templates ?? []).length === 0 && <div className="text-xs text-muted-foreground">Nessun modello.</div>}
            {(templates ?? []).map((t: any) => (
              <div key={t.id} className="flex items-center justify-between rounded-md border border-border p-2 text-xs">
                <button className="flex-1 text-left" onClick={() => loadTemplate(t)}>
                  <div className="font-medium">{t.name}</div><div className="text-muted-foreground">{t.source}</div>
                </button>
                <Button size="icon" variant="ghost" onClick={() => delTpl.mutate(t.id)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      {rows && (
        <Card>
          <CardHeader><CardTitle className="font-display text-base">Anteprima · {rows.length} righe</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-xs">
              <thead className="border-b border-border bg-muted/30"><tr>{cols.map(c => <th key={c} className="px-3 py-2 text-left font-medium">{c}</th>)}</tr></thead>
              <tbody>{preview.map((r, i) => (<tr key={i} className="border-b border-border/40">{cols.map(c => <td key={c} className="px-3 py-1.5 font-mono">{String(r[c] ?? "")}</td>)}</tr>))}</tbody>
            </table>
            {rows.length > 50 && <div className="p-3 text-center text-xs text-muted-foreground">Mostrando 50 di {rows.length}. Esporta per vedere tutto.</div>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}