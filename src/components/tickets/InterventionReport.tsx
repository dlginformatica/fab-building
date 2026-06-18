import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { fmtDateTime } from "@/lib/format";

export function InterventionReport({ ticketId }: { ticketId: string }) {
  const qc = useQueryClient();
  const [summary, setSummary] = useState("");
  const [hours, setHours] = useState("");
  const [materials, setMaterials] = useState("");

  const { data: reports = [] } = useQuery({
    queryKey: ["ticket-reports", ticketId],
    queryFn: async () => (await supabase.from("ticket_reports").select("*, profiles:author_id(full_name,email)").eq("ticket_id", ticketId).order("created_at", { ascending:false })).data ?? [],
  });

  const save = useMutation({
    mutationFn: async () => {
      const user = (await supabase.auth.getUser()).data.user;
      const mats = materials.split("\n").map(s=>s.trim()).filter(Boolean).map(line=>{
        const m = line.match(/^(.*?)(?:\s+x\s*(\d+(?:[.,]\d+)?))?$/i);
        return { item: m?.[1]?.trim() ?? line, qty: m?.[2] ? Number(m[2].replace(",", ".")) : 1 };
      });
      const { error } = await supabase.from("ticket_reports").insert({
        ticket_id: ticketId, author_id: user?.id ?? null, summary,
        materials_used: mats, hours_worked: hours ? Number(hours.replace(",", ".")) : null,
        signed_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => { setSummary(""); setHours(""); setMaterials(""); toast.success("Rapportino salvato"); qc.invalidateQueries({queryKey:["ticket-reports",ticketId]}); },
    onError: (e:Error)=>toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader><CardTitle className="font-display text-base">Rapportino di intervento</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {reports.length > 0 && (
          <div className="space-y-2">
            {reports.map((r:any)=>(
              <div key={r.id} className="rounded-md border bg-card/60 p-3 text-sm">
                <div className="text-xs text-muted-foreground">{r.profiles?.full_name ?? r.profiles?.email ?? "—"} · {fmtDateTime(r.created_at)} · {r.hours_worked ?? "—"}h</div>
                <div className="whitespace-pre-wrap mt-1">{r.summary}</div>
                {Array.isArray(r.materials_used) && r.materials_used.length>0 && (
                  <ul className="mt-2 text-xs list-disc pl-5">
                    {r.materials_used.map((m:any,i:number)=><li key={i}>{m.item} × {m.qty}</li>)}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="space-y-2 border-t pt-3">
          <div className="space-y-1"><Label>Riepilogo intervento</Label><Textarea rows={3} value={summary} onChange={e=>setSummary(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label>Ore lavorate</Label><Input value={hours} onChange={e=>setHours(e.target.value)} placeholder="1.5" /></div>
            <div className="space-y-1"><Label>Materiali (uno per riga, "voce x qty")</Label><Textarea rows={2} value={materials} onChange={e=>setMaterials(e.target.value)} placeholder={"Cartuccia miscelatore x 1\nGuarnizione x 2"} /></div>
          </div>
          <Button onClick={()=>save.mutate()} disabled={!summary.trim()||save.isPending}>Firma e salva</Button>
        </div>
      </CardContent>
    </Card>
  );
}