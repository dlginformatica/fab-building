import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveStructure } from "@/lib/structure-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Leaf, Zap, Droplet, Flame } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/sustainability")({ component: Page });

// Benchmark indicativi per camera/anno per piccola struttura italiana
const BENCHMARK: Record<string, { unit: string; perRoomYear: number; label: string; icon: any; color: string }> = {
  elettrica: { unit: "kWh", perRoomYear: 3200, label: "Energia elettrica", icon: Zap, color: "text-amber-500" },
  gas: { unit: "Smc", perRoomYear: 380, label: "Gas naturale", icon: Flame, color: "text-orange-500" },
  acqua: { unit: "mc", perRoomYear: 130, label: "Acqua", icon: Droplet, color: "text-sky-500" },
};

function Page() {
  const { activeStructureId } = useActiveStructure();

  const { data: structure } = useQuery({
    queryKey: ["sus_struct", activeStructureId], enabled: !!activeStructureId,
    queryFn: async () => (await (supabase as any).from("structures").select("id,name,rooms_count").eq("id", activeStructureId).maybeSingle()).data,
  });

  const { data: readings = [] } = useQuery({
    queryKey: ["sus_readings", activeStructureId], enabled: !!activeStructureId,
    queryFn: async () => {
      const yearAgo = new Date(); yearAgo.setFullYear(yearAgo.getFullYear() - 1);
      const { data, error } = await (supabase as any).from("meter_readings")
        .select("reading_date,value,utility_meters(utility_type,unit)")
        .gte("reading_date", yearAgo.toISOString().slice(0, 10))
        .order("reading_date");
      if (error) { console.warn("[sustainability] meter_readings:", error.message); return []; }
      return data ?? [];
    },
  });

  const summary = useMemo(() => {
    const byType: Record<string, { total: number; count: number; unit: string }> = {};
    for (const r of readings) {
      const t = r.utility_meters?.utility_type ?? "altro";
      const u = r.utility_meters?.unit ?? "";
      byType[t] = byType[t] ?? { total: 0, count: 0, unit: u };
      byType[t].total += Number(r.value || 0);
      byType[t].count += 1;
    }
    return byType;
  }, [readings]);

  const rooms = Math.max(1, structure?.rooms_count ?? 10);

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="font-display text-2xl font-semibold flex items-center gap-2"><Leaf className="h-6 w-6 text-emerald-500"/>Consumi & Sostenibilità</h1>
        <p className="text-sm text-muted-foreground">Confronto consumi con benchmark di settore. Dati ultimi 12 mesi.</p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        {Object.entries(BENCHMARK).map(([key, b]) => {
          const s = summary[key];
          const perRoom = s ? s.total / rooms : 0;
          const ratio = perRoom / b.perRoomYear;
          const Icon = b.icon;
          return (
            <Card key={key}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2"><Icon className={`h-5 w-5 ${b.color}`}/>{b.label}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-3xl font-semibold tabular-nums">{perRoom.toFixed(0)} <span className="text-sm text-muted-foreground">{b.unit}/camera/anno</span></div>
                <div className="text-xs text-muted-foreground">Benchmark: {b.perRoomYear} {b.unit}/camera/anno</div>
                {s ? (
                  <Badge variant="outline" className={ratio < 0.85 ? "bg-emerald-500/15 text-emerald-500" : ratio > 1.15 ? "bg-red-500/15 text-red-500" : "bg-amber-500/15 text-amber-500"}>
                    {ratio < 0.85 ? "✓ Sotto media" : ratio > 1.15 ? "⚠ Sopra media" : "≈ In media"} ({(ratio * 100).toFixed(0)}%)
                  </Badge>
                ) : <Badge variant="outline">Nessun dato</Badge>}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader><CardTitle>Suggerimenti ESG</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>🌱 Sostituisci le caldaie autonome con un sistema centralizzato a condensazione: -15% gas.</p>
          <p>💡 LED + sensori presenza in corridoi: -25% elettrica.</p>
          <p>🚿 Soffioni a basso flusso: -30% acqua calda, -20% gas ACS.</p>
          <p>♻️ Programma asciugamani "stesso ospite" + cambio lenzuola ogni 3 giorni: -40% acqua lavanderia.</p>
        </CardContent>
      </Card>
    </div>
  );
}