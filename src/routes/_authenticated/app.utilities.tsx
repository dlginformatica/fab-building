import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveStructure } from "@/lib/structure-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Gauge } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/utilities")({ component: Page });

function Page() {
  const qc = useQueryClient();
  const { activeStructureId } = useActiveStructure();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name:"", type:"elettricita", pod_pdr:"", serial_number:"", unit:"kWh" });
  const [readingFor, setReadingFor] = useState<string | null>(null);
  const [readValue, setReadValue] = useState("");
  const { data: meters = [] } = useQuery({
    queryKey: ["meters", activeStructureId], enabled: !!activeStructureId,
    queryFn: async () => (await supabase.from("utility_meters").select("*, meter_readings(value,reading_date)").eq("structure_id", activeStructureId!).order("name")).data ?? [],
  });
  const mut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("utility_meters").insert({
        structure_id: activeStructureId!, name: form.name, type: form.type as any,
        pod_pdr: form.pod_pdr || null, serial_number: form.serial_number || null, unit: form.unit,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Contatore creato"); qc.invalidateQueries({queryKey:["meters"]}); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  const readMut = useMutation({
    mutationFn: async () => {
      if (!readingFor) return;
      const { error } = await supabase.from("meter_readings").insert({ meter_id: readingFor, value: parseFloat(readValue), reading_date: new Date().toISOString().slice(0,10) });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Lettura salvata"); setReadingFor(null); setReadValue(""); qc.invalidateQueries({queryKey:["meters"]}); },
    onError: (e: Error) => toast.error(e.message),
  });
  if (!activeStructureId) return <div className="p-10 text-center text-sm text-muted-foreground">Seleziona una struttura.</div>;
  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <div><h1 className="font-display text-2xl font-bold">Utenze & Contatori</h1><p className="text-sm text-muted-foreground">POD/PDR, letture periodiche, consumi.</p></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4"/>Nuovo contatore</Button></DialogTrigger>
          <DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Nuovo contatore</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1"><Label>Nome *</Label><Input value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})}/></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Tipo</Label>
                  <Select value={form.type} onValueChange={(v)=>setForm({...form,type:v})}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>{["elettricita","gas","acqua","gasolio","teleriscaldamento","altro"].map(x=><SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Unità</Label><Input value={form.unit} onChange={(e)=>setForm({...form,unit:e.target.value})}/></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>POD / PDR</Label><Input value={form.pod_pdr} onChange={(e)=>setForm({...form,pod_pdr:e.target.value})}/></div>
                <div className="space-y-1"><Label>Matricola</Label><Input value={form.serial_number} onChange={(e)=>setForm({...form,serial_number:e.target.value})}/></div>
              </div>
              <Button disabled={!form.name || mut.isPending} className="w-full" onClick={()=>mut.mutate()}>Crea</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {meters.map((m: any) => {
          const last = (m.meter_readings ?? []).sort((a:any,b:any)=>b.reading_date.localeCompare(a.reading_date))[0];
          return (
            <Card key={m.id}>
              <CardHeader><div className="flex items-start justify-between"><CardTitle className="font-display text-base flex items-center gap-2"><Gauge className="h-4 w-4"/>{m.name}</CardTitle><Badge variant="outline">{m.type}</Badge></div>
                <div className="text-xs text-muted-foreground">{m.pod_pdr ?? "—"}</div></CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-2">
                <div>Ultima lettura: <b className="text-foreground">{last ? `${last.value} ${m.unit} (${last.reading_date})` : "—"}</b></div>
                <Button size="sm" variant="outline" onClick={()=>setReadingFor(m.id)}>+ Lettura</Button>
              </CardContent>
            </Card>
          );
        })}
        {meters.length===0 && <Card className="md:col-span-2 lg:col-span-3"><CardContent className="p-10 text-center text-sm text-muted-foreground">Nessun contatore.</CardContent></Card>}
      </div>
      <Dialog open={!!readingFor} onOpenChange={(o)=>!o&&setReadingFor(null)}>
        <DialogContent><DialogHeader><DialogTitle>Nuova lettura</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Valore</Label><Input type="number" value={readValue} onChange={(e)=>setReadValue(e.target.value)}/></div>
            <Button disabled={!readValue||readMut.isPending} className="w-full" onClick={()=>readMut.mutate()}>Salva</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}