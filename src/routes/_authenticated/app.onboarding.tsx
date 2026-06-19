import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveStructure } from "@/lib/structure-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Building2, Layers, BedDouble, Wrench, Bell, CheckCircle2, Sparkles, Rocket } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/onboarding")({ component: Page });

type Preset = {
  id: "piccolo" | "boutique" | "bb";
  label: string;
  description: string;
  rooms: string;
  floors: number;
  roomsPerFloor: number;
  icon: string;
};

const PRESETS: Preset[] = [
  { id: "bb", label: "B&B / Affittacamere", description: "Fino a 8 camere, gestione familiare", rooms: "≤ 8 camere", floors: 1, roomsPerFloor: 6, icon: "🏡" },
  { id: "piccolo", label: "Hotel piccolo", description: "10-25 camere, staff ridotto", rooms: "10-25 camere", floors: 3, roomsPerFloor: 8, icon: "🏨" },
  { id: "boutique", label: "Boutique / Resort", description: "25-50 camere, reparti dedicati", rooms: "25-50 camere", floors: 4, roomsPerFloor: 12, icon: "🏛️" },
];

function Page() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { activeStructureId, setActiveStructureId } = useActiveStructure();
  const [step, setStep] = useState(1);

  // Step 1: struttura
  const [structureName, setStructureName] = useState("");
  const [structureCity, setStructureCity] = useState("");

  // Step 2: preset
  const [preset, setPreset] = useState<Preset>(PRESETS[1]);

  // Step 3: dimensioni
  const [floors, setFloors] = useState(preset.floors);
  const [roomsPerFloor, setRoomsPerFloor] = useState(preset.roomsPerFloor);
  useEffect(() => { setFloors(preset.floors); setRoomsPerFloor(preset.roomsPerFloor); }, [preset.id]);

  // Carica struttura attiva (se già esiste)
  const { data: structure } = useQuery({
    queryKey: ["onboarding_structure", activeStructureId],
    queryFn: async () => {
      if (!activeStructureId) return null;
      const { data, error } = await (supabase as any).from("structures").select("*").eq("id", activeStructureId).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!activeStructureId,
  });

  useEffect(() => {
    if (structure) {
      setStructureName(structure.name ?? "");
      setStructureCity(structure.city ?? "");
    }
  }, [structure?.id]);

  const createStructure = useMutation({
    mutationFn: async () => {
      if (!structureName.trim()) throw new Error("Inserisci il nome della struttura");
      if (activeStructureId) {
        const { error } = await (supabase as any).from("structures")
          .update({ name: structureName.trim(), city: structureCity.trim() || null })
          .eq("id", activeStructureId);
        if (error) throw error;
        return activeStructureId;
      }
      const { data, error } = await (supabase as any).from("structures")
        .insert({ name: structureName.trim(), city: structureCity.trim() || null, country: "IT" })
        .select("id").single();
      if (error) throw error;
      setActiveStructureId(data.id);
      return data.id as string;
    },
  });

  const seed = useMutation({
    mutationFn: async () => {
      const sid = activeStructureId || (await createStructure.mutateAsync());
      const { data, error } = await (supabase as any).rpc("seed_structure_preset", {
        _structure: sid,
        _preset: preset.id,
        _floors_count: floors,
        _rooms_per_floor: roomsPerFloor,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      toast.success(`Setup completato: ${data?.rooms ?? 0} camere, ${data?.floors ?? 0} piani`);
      qc.invalidateQueries();
      setStep(5);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const totalSteps = 5;
  const progress = (step / totalSteps) * 100;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h1 className="font-display text-2xl font-semibold">Benvenuto in HotelOps</h1>
        </div>
        <p className="text-sm text-muted-foreground">5 step, ~5 minuti. Al termine la tua struttura è pronta per ricevere ticket, gestire manutenzione e fornitori.</p>
        <Progress value={progress} className="h-2" />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Step {step} di {totalSteps}</span>
          {structure?.onboarded_at && <Badge variant="outline">Già configurato il {new Date(structure.onboarded_at).toLocaleDateString("it-IT")}</Badge>}
        </div>
      </header>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5"/>1. La tua struttura</CardTitle>
            <CardDescription>Dacci il nome e la città. Potrai aggiungere indirizzo e dati fiscali in seguito.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1"><Label>Nome struttura *</Label><Input placeholder="Hotel Bellavista" value={structureName} onChange={(e)=>setStructureName(e.target.value)} /></div>
            <div className="space-y-1"><Label>Città</Label><Input placeholder="Milano" value={structureCity} onChange={(e)=>setStructureCity(e.target.value)} /></div>
            <div className="flex justify-end">
              <Button disabled={!structureName.trim() || createStructure.isPending}
                onClick={async () => { await createStructure.mutateAsync(); setStep(2); }}>
                Avanti →
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5"/>2. Che tipo di struttura?</CardTitle>
            <CardDescription>Scegli il preset più simile. Configureremo piani, camere, SLA e categorie asset in linea.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              {PRESETS.map((p) => (
                <button key={p.id} onClick={() => setPreset(p)}
                  className={`rounded-lg border p-4 text-left transition ${preset.id === p.id ? "border-primary bg-primary/5 ring-2 ring-primary/40" : "hover:border-foreground/30"}`}>
                  <div className="text-3xl">{p.icon}</div>
                  <div className="mt-2 font-semibold">{p.label}</div>
                  <div className="text-xs text-muted-foreground">{p.description}</div>
                  <Badge variant="outline" className="mt-2">{p.rooms}</Badge>
                </button>
              ))}
            </div>
            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setStep(1)}>← Indietro</Button>
              <Button onClick={() => setStep(3)}>Avanti →</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Layers className="h-5 w-5"/>3. Piani e camere</CardTitle>
            <CardDescription>Definisci quanti piani e quante camere per piano. Le camere verranno numerate automaticamente (101, 102, … 201, 202…).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1"><Label>Numero piani (incluso piano terra)</Label>
                <Input type="number" min={1} max={20} value={floors} onChange={(e)=>setFloors(parseInt(e.target.value||"1"))} /></div>
              <div className="space-y-1"><Label>Camere per piano</Label>
                <Input type="number" min={1} max={100} value={roomsPerFloor} onChange={(e)=>setRoomsPerFloor(parseInt(e.target.value||"1"))} /></div>
            </div>
            <div className="rounded-md bg-muted/40 p-3 text-sm">
              Anteprima: <b>{floors} piani</b> · <b>{floors * roomsPerFloor} camere totali</b>
            </div>
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(2)}>← Indietro</Button>
              <Button onClick={() => setStep(4)}>Avanti →</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Wrench className="h-5 w-5"/>4. Riepilogo e generazione</CardTitle>
            <CardDescription>Stiamo per creare automaticamente tutto quello che serve. Potrai sempre modificare in seguito.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500"/><span><b>Struttura:</b> {structureName}{structureCity?` · ${structureCity}`:""}</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500"/><span><b>Preset:</b> {preset.label}</span></li>
              <li className="flex items-start gap-2"><Layers className="mt-0.5 h-4 w-4 text-primary"/><span><b>{floors} piani</b> · <b>{floors*roomsPerFloor} camere</b> numerate automaticamente</span></li>
              <li className="flex items-start gap-2"><Wrench className="mt-0.5 h-4 w-4 text-primary"/><span><b>11 categorie asset</b> standard: caldaia, climatizzazione, idraulico, elettrico, ascensori, TV/Wi-Fi, mini-bar, lavanderia, cucina, antincendio, generico</span></li>
              <li className="flex items-start gap-2"><Bell className="mt-0.5 h-4 w-4 text-primary"/><span><b>4 regole SLA</b> di default (critica 15'/2h, alta 1h/8h, media 4h/24h, bassa 8h/72h)</span></li>
            </ul>
            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setStep(3)}>← Indietro</Button>
              <Button size="lg" disabled={seed.isPending} onClick={() => seed.mutate()}>
                <Rocket className="mr-2 h-4 w-4"/>{seed.isPending ? "Configurazione in corso…" : "Genera setup"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 5 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-600"><CheckCircle2 className="h-5 w-5"/>Tutto pronto!</CardTitle>
            <CardDescription>La tua struttura è operativa. Ecco i prossimi passi consigliati:</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <NextStep to="/app/assets" icon={<Wrench/>} title="Censisci i primi asset" desc="Caldaia, ascensori, climatizzatori. Stampa il QR e attaccalo all'impianto." />
              <NextStep to="/app/suppliers" icon={<BedDouble/>} title="Aggiungi i fornitori" desc="Manutentori esterni, ditte di pulizia, fornitori di servizi." />
              <NextStep to="/app/tickets" icon={<Bell/>} title="Apri il primo ticket" desc="Prova il flusso completo: apertura → assegnazione → chiusura con foto." />
              <NextStep to="/app/structure-kpi" icon={<Sparkles/>} title="Guarda i KPI" desc="Dashboard con SLA, ticket aperti, contratti in scadenza." />
            </div>
            <div className="flex justify-end">
              <Button onClick={() => navigate({ to: "/app/structure-kpi" })}>Vai alla dashboard</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function NextStep({ to, icon, title, desc }: { to: string; icon: React.ReactNode; title: string; desc: string }) {
  const navigate = useNavigate();
  return (
    <button onClick={() => navigate({ to })} className="rounded-lg border p-3 text-left transition hover:border-primary hover:bg-primary/5">
      <div className="flex items-center gap-2 font-semibold">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-primary/10 text-primary [&_svg]:h-4 [&_svg]:w-4">{icon}</span>
        {title}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
    </button>
  );
}