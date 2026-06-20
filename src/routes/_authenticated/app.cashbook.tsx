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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Wallet, Plus, ArrowUpRight, ArrowDownRight, Download, Trash2, FileDown } from "lucide-react";
import { exportPDF, type Column } from "@/lib/exports";

export const Route = createFileRoute("/_authenticated/app/cashbook")({ component: Page });

function Page() {
  const qc = useQueryClient();
  const { activeStructureId } = useActiveStructure();
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 8) + "01";
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ movement_date: today, kind: "entrata", category: "soggiorno", description: "", amount: "", payment_method: "contanti" });

  const { data: rows = [] } = useQuery({
    queryKey: ["cash", activeStructureId, from, to],
    queryFn: async () => {
      if (!activeStructureId) return [];
      const { data, error } = await (supabase as any).from("cash_movements").select("*")
        .eq("structure_id", activeStructureId).gte("movement_date", from).lte("movement_date", to)
        .order("movement_date", { ascending: false });
      if (error) throw error; return data ?? [];
    },
    enabled: !!activeStructureId,
  });

  const totals = useMemo(() => {
    const e = rows.filter((r: any) => r.kind === "entrata").reduce((s: number, r: any) => s + Number(r.amount), 0);
    const u = rows.filter((r: any) => r.kind === "uscita").reduce((s: number, r: any) => s + Number(r.amount), 0);
    return { e, u, saldo: e - u };
  }, [rows]);

  const add = useMutation({
    mutationFn: async () => {
      if (!activeStructureId) throw new Error("Nessuna struttura");
      if (!form.description.trim() || !form.amount) throw new Error("Compila descrizione e importo");
      const { error } = await (supabase as any).from("cash_movements").insert({
        structure_id: activeStructureId, movement_date: form.movement_date, kind: form.kind,
        category: form.category, description: form.description.trim(), amount: parseFloat(form.amount),
        payment_method: form.payment_method,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Movimento aggiunto"); setOpen(false); setForm({ ...form, description: "", amount: "" }); qc.invalidateQueries({ queryKey: ["cash"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await (supabase as any).from("cash_movements").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cash"] }),
  });

  const exportCsv = () => {
    const head = "Data,Tipo,Categoria,Descrizione,Importo,Metodo\n";
    const body = rows.map((r: any) => `${r.movement_date},${r.kind},${r.category},"${r.description.replace(/"/g, "''")}",${r.amount},${r.payment_method}`).join("\n");
    const blob = new Blob([head + body], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `prima-nota_${from}_${to}.csv`; a.click(); URL.revokeObjectURL(url);
  };
  const cols: Column<any>[] = [
    { header: "Data", key: "movement_date" }, { header: "Tipo", key: "kind" },
    { header: "Categoria", key: "category" }, { header: "Descrizione", key: "description" },
    { header: "Importo €", key: "amount", format: (r) => Number(r.amount).toFixed(2) },
    { header: "Metodo", key: "payment_method" },
  ];
  const exportPdf = () => exportPDF(`prima-nota_${from}_${to}`, "Prima Nota / Cassa", rows, cols, `Periodo ${from} → ${to} · Saldo € ${totals.saldo.toFixed(2)}`);

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold flex items-center gap-2"><Wallet className="h-6 w-6"/>Prima Nota / Cassa</h1>
          <p className="text-sm text-muted-foreground">Entrate e uscite quotidiane, esportabili in CSV per il commercialista.</p>
        </div>
        <div className="flex gap-2 items-end">
          <div><Label className="text-xs">Da</Label><Input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="w-40"/></div>
          <div><Label className="text-xs">A</Label><Input type="date" value={to} onChange={e=>setTo(e.target.value)} className="w-40"/></div>
          <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-2"/>CSV</Button>
          <Button variant="outline" onClick={exportPdf}><FileDown className="h-4 w-4 mr-2"/>PDF</Button>
          <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2"/>Nuovo</Button>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Entrate" value={totals.e} tone="emerald" icon={<ArrowUpRight/>}/>
        <Stat label="Uscite" value={totals.u} tone="red" icon={<ArrowDownRight/>}/>
        <Stat label="Saldo" value={totals.saldo} tone={totals.saldo >= 0 ? "emerald" : "red"} icon={<Wallet/>}/>
      </div>

      {open && (
        <Card>
          <CardHeader><CardTitle>Nuovo movimento</CardTitle></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <div><Label>Data</Label><Input type="date" value={form.movement_date} onChange={e=>setForm({...form, movement_date: e.target.value})}/></div>
            <div><Label>Tipo</Label>
              <Select value={form.kind} onValueChange={v=>setForm({...form, kind: v})}><SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent><SelectItem value="entrata">Entrata</SelectItem><SelectItem value="uscita">Uscita</SelectItem></SelectContent></Select></div>
            <div><Label>Categoria</Label>
              <Select value={form.category} onValueChange={v=>setForm({...form, category: v})}><SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="soggiorno">Soggiorno</SelectItem><SelectItem value="extra">Extra (bar, ristorante)</SelectItem>
                  <SelectItem value="utenze">Utenze</SelectItem><SelectItem value="fornitori">Fornitori</SelectItem>
                  <SelectItem value="manutenzione">Manutenzione</SelectItem><SelectItem value="stipendi">Stipendi</SelectItem>
                  <SelectItem value="tasse">Tasse</SelectItem><SelectItem value="altro">Altro</SelectItem>
                </SelectContent></Select></div>
            <div className="md:col-span-2"><Label>Descrizione</Label><Input value={form.description} onChange={e=>setForm({...form, description: e.target.value})}/></div>
            <div><Label>Importo €</Label><Input type="number" step="0.01" value={form.amount} onChange={e=>setForm({...form, amount: e.target.value})}/></div>
            <div><Label>Metodo</Label>
              <Select value={form.payment_method} onValueChange={v=>setForm({...form, payment_method: v})}><SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent><SelectItem value="contanti">Contanti</SelectItem><SelectItem value="pos">POS</SelectItem><SelectItem value="bonifico">Bonifico</SelectItem><SelectItem value="assegno">Assegno</SelectItem><SelectItem value="altro">Altro</SelectItem></SelectContent></Select></div>
            <div className="md:col-span-3 flex gap-2"><Button onClick={()=>add.mutate()} disabled={add.isPending}>Salva</Button><Button variant="ghost" onClick={()=>setOpen(false)}>Annulla</Button></div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Movimenti</CardTitle></CardHeader>
        <CardContent>
          {rows.length === 0 ? <p className="text-sm text-muted-foreground">Nessun movimento nel periodo.</p> :
            <div className="divide-y divide-border/40">
              {rows.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between py-2 text-sm">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-muted-foreground tabular-nums">{r.movement_date}</span>
                    <Badge variant="outline">{r.category}</Badge>
                    <span>{r.description}</span>
                    <Badge variant="outline" className="text-[10px]">{r.payment_method}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold tabular-nums ${r.kind === "entrata" ? "text-emerald-500" : "text-red-500"}`}>{r.kind === "entrata" ? "+" : "-"}€ {Number(r.amount).toFixed(2)}</span>
                    <Button size="sm" variant="ghost" onClick={()=>del.mutate(r.id)}><Trash2 className="h-3 w-3"/></Button>
                  </div>
                </div>
              ))}
            </div>}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, tone, icon }: { label: string; value: number; tone: string; icon: any }) {
  const cls = tone === "emerald" ? "text-emerald-500" : tone === "red" ? "text-red-500" : "text-foreground";
  return (
    <div className="rounded-lg border border-border/50 bg-card/40 p-4">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <span className={`[&_svg]:h-4 [&_svg]:w-4 ${cls}`}>{icon}</span>
      </div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${cls}`}>€ {value.toFixed(2)}</div>
    </div>
  );
}