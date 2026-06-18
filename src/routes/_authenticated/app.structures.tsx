import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useActiveStructure } from "@/lib/structure-context";

export const Route = createFileRoute("/_authenticated/app/structures")({ component: Page });

function Page() {
  const qc = useQueryClient();
  const { setActiveStructureId } = useActiveStructure();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", address: "", city: "", rooms_count: "" });

  const { data } = useQuery({
    queryKey: ["structures"],
    queryFn: async () => {
      const { data, error } = await supabase.from("structures").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const mut = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name, code: form.code || null, address: form.address || null, city: form.city || null,
        rooms_count: form.rooms_count ? parseInt(form.rooms_count, 10) : null,
      };
      const { data, error } = await supabase.from("structures").insert(payload).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (s) => {
      toast.success("Struttura creata");
      qc.invalidateQueries({ queryKey: ["structures"] });
      qc.invalidateQueries({ queryKey: ["structures-list"] });
      setActiveStructureId(s.id);
      setOpen(false);
      setForm({ name: "", code: "", address: "", city: "", rooms_count: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Strutture</h1>
          <p className="text-sm text-muted-foreground">Hotel e immobili gestiti.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" />Nuova struttura</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nuova struttura</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1"><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Codice</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="MAR01" /></div>
                <div className="space-y-1"><Label>N° camere</Label><Input type="number" value={form.rooms_count} onChange={(e) => setForm({ ...form, rooms_count: e.target.value })} /></div>
              </div>
              <div className="space-y-1"><Label>Indirizzo</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              <div className="space-y-1"><Label>Città</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
              <Button disabled={!form.name || mut.isPending} onClick={() => mut.mutate()} className="w-full">Crea struttura</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {(data ?? []).map((s) => (
          <Card key={s.id} className="cursor-pointer hover:border-primary/60" onClick={() => setActiveStructureId(s.id)}>
            <CardHeader>
              <CardTitle className="font-display">{s.name}</CardTitle>
              <div className="text-xs text-muted-foreground">{s.code} · {s.city ?? "—"}</div>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {s.address ?? "—"}<br />
              {s.rooms_count ? `${s.rooms_count} camere` : ""}
            </CardContent>
          </Card>
        ))}
        {(!data || data.length === 0) && (
          <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">Nessuna struttura. Creane una con il bottone in alto.</CardContent></Card>
        )}
      </div>
    </div>
  );
}