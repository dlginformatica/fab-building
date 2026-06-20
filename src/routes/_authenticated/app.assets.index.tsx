import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveStructure } from "@/lib/structure-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, QrCode } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/app/assets/")({ component: Page });

function Page() {
  const qc = useQueryClient();
  const { activeStructureId } = useActiveStructure();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const { data: categories } = useQuery({
    queryKey: ["asset_categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("asset_categories").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: assets } = useQuery({
    queryKey: ["assets", activeStructureId, search, categoryFilter],
    enabled: !!activeStructureId,
    queryFn: async () => {
      let q = supabase.from("assets").select("*, asset_categories(name,color,icon)").eq("structure_id", activeStructureId!).order("name");
      if (search) q = q.ilike("name", `%${search}%`);
      if (categoryFilter !== "all") q = q.eq("category_id", categoryFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  if (!activeStructureId) return <div className="p-10 text-center text-sm text-muted-foreground">Seleziona una struttura dalla topbar.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Asset & Impianti</h1>
          <p className="text-sm text-muted-foreground">Inventario degli impianti della struttura.</p>
        </div>
        <NewAssetDialog open={open} setOpen={setOpen} categories={categories ?? []} structureId={activeStructureId} onCreated={() => qc.invalidateQueries({ queryKey: ["assets"] })} />
      </div>
      <div className="flex flex-wrap gap-3">
        <Input placeholder="Cerca per nome…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[240px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte le categorie</SelectItem>
            {(categories ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {(assets ?? []).map((a) => (
          <Link key={a.id} to="/app/assets/$id" params={{ id: a.id }}>
            <Card className="h-full cursor-pointer hover:border-primary/60">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="font-display text-base">{a.name}</CardTitle>
                    <div className="text-xs text-muted-foreground">{a.code} · {a.brand ?? ""} {a.model ?? ""}</div>
                  </div>
                  <Badge variant="outline" style={{ borderColor: a.asset_categories?.color ?? undefined, color: a.asset_categories?.color ?? undefined }}>
                    {a.asset_categories?.name ?? "—"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Stato: <b className="text-foreground">{a.status}</b></span>
                <QrCode className="h-4 w-4" />
              </CardContent>
            </Card>
          </Link>
        ))}
        {(!assets || assets.length === 0) && (
          <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">Nessun asset.</CardContent></Card>
        )}
      </div>
    </div>
  );
}

function NewAssetDialog({ open, setOpen, categories, structureId, onCreated }: {
  open: boolean; setOpen: (b: boolean) => void;
  categories: Array<{ id: string; name: string }>;
  structureId: string;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({ code: "", name: "", category_id: "", brand: "", model: "", serial_number: "", notes: "" });
  const [file, setFile] = useState<File | null>(null);
  const mut = useMutation({
    mutationFn: async () => {
      let photo_url: string | null = null;
      if (file) {
        const path = `${structureId}/${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage.from("assets").upload(path, file);
        if (upErr) throw upErr;
        const { data } = supabase.storage.from("assets").getPublicUrl(path);
        photo_url = data.publicUrl;
      }
      const { error } = await supabase.from("assets").insert({
        structure_id: structureId,
        code: form.code, name: form.name,
        category_id: form.category_id || null,
        brand: form.brand || null, model: form.model || null, serial_number: form.serial_number || null,
        notes: form.notes || null, photo_url,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Asset creato");
      onCreated();
      setOpen(false);
      setForm({ code: "", name: "", category_id: "", brand: "", model: "", serial_number: "", notes: "" });
      setFile(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" />Nuovo asset</Button></DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Nuovo asset</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Codice *</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
            <div className="space-y-1"><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          </div>
          <div className="space-y-1">
            <Label>Categoria</Label>
            <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
              <SelectTrigger><SelectValue placeholder="Seleziona…" /></SelectTrigger>
              <SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Marca</Label><Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} /></div>
            <div className="space-y-1"><Label>Modello</Label><Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /></div>
          </div>
          <div className="space-y-1"><Label>Seriale</Label><Input value={form.serial_number} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} /></div>
          <div className="space-y-1"><Label>Foto</Label><Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
          <div className="space-y-1"><Label>Note</Label><Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <Button disabled={!form.code || !form.name || mut.isPending} onClick={() => mut.mutate()} className="w-full">Crea asset</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}