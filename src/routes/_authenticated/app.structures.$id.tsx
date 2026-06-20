import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Trash2, MapPin, Upload, Pencil, LayoutGrid } from "lucide-react";
import { toast } from "sonner";

// Map is client-only (leaflet touches window). Lazy + Suspense + typeof window guard.
const StructureMap = lazy(() => import("@/components/structures/StructureMap"));
// Room detail dialog uses no SSR-incompatible deps but we keep it lazy for parity.
const RoomDetailDialog = lazy(() => import("@/components/structures/RoomDetailDialog"));

export const Route = createFileRoute("/_authenticated/app/structures/$id")({ component: Page });

type Structure = {
  id: string; name: string; code: string | null; address: string | null; postal_code: string | null;
  city: string | null; province: string | null; country: string | null; rooms_count: number | null;
  timezone: string | null; vat_number: string | null; fiscal_code: string | null;
  regime_fiscale: string | null; notes: string | null; lat: number | null; lng: number | null;
};

function Page() {
  const { id } = Route.useParams();
  const { data: s, isLoading } = useQuery({
    queryKey: ["structure", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("structures").select("*").eq("id", id).single();
      if (error) throw error;
      return data as Structure;
    },
  });

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Caricamento…</div>;
  if (!s) return <div className="p-6 text-sm text-muted-foreground">Struttura non trovata.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/app/structures" className="text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="inline h-4 w-4" /> Strutture
        </Link>
      </div>
      <div>
        <h1 className="font-display text-2xl font-bold">{s.name}</h1>
        <p className="text-sm text-muted-foreground">{s.code ?? "—"} · {s.city ?? "—"}</p>
      </div>
      <Tabs defaultValue="anag" className="space-y-4">
        <TabsList>
          <TabsTrigger value="anag">Anagrafica</TabsTrigger>
          <TabsTrigger value="rooms">Camere &amp; Piani</TabsTrigger>
          <TabsTrigger value="types">Tipologie</TabsTrigger>
          <TabsTrigger value="photos">Foto</TabsTrigger>
          <TabsTrigger value="map">Mappa</TabsTrigger>
        </TabsList>
        <TabsContent value="anag"><Anagrafica s={s} /></TabsContent>
        <TabsContent value="rooms"><RoomsTab structureId={id} /></TabsContent>
        <TabsContent value="types"><RoomTypesTab structureId={id} /></TabsContent>
        <TabsContent value="photos"><PhotosTab structureId={id} /></TabsContent>
        <TabsContent value="map"><MapTab s={s} /></TabsContent>
      </Tabs>
    </div>
  );
}

// ============ Anagrafica ============
function Anagrafica({ s }: { s: Structure }) {
  const qc = useQueryClient();
  const [f, setF] = useState<Structure>(s);
  useEffect(() => setF(s), [s]);
  const mut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("structures").update({
        name: f.name, code: f.code, address: f.address, postal_code: f.postal_code, city: f.city,
        province: f.province, country: f.country, rooms_count: f.rooms_count, timezone: f.timezone,
        vat_number: f.vat_number, fiscal_code: f.fiscal_code, regime_fiscale: f.regime_fiscale,
        notes: f.notes,
      } as any).eq("id", s.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Anagrafica aggiornata");
      qc.invalidateQueries({ queryKey: ["structure", s.id] });
      qc.invalidateQueries({ queryKey: ["structures"] });
      qc.invalidateQueries({ queryKey: ["structures-list"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const F = (k: keyof Structure, label: string, type = "text") => (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input type={type} value={(f[k] ?? "") as string | number}
        onChange={(e) => setF({ ...f, [k]: type === "number" ? (e.target.value ? Number(e.target.value) : null) : e.target.value })} />
    </div>
  );
  return (
    <Card>
      <CardHeader><CardTitle>Anagrafica</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          {F("name", "Nome *")}
          {F("code", "Codice")}
          {F("address", "Indirizzo")}
          {F("postal_code", "CAP")}
          {F("city", "Città")}
          {F("province", "Provincia")}
          {F("country", "Paese")}
          {F("rooms_count", "N° camere", "number")}
          {F("timezone", "Timezone")}
          {F("vat_number", "Partita IVA")}
          {F("fiscal_code", "Codice fiscale")}
          {F("regime_fiscale", "Regime fiscale")}
        </div>
        <div className="space-y-1">
          <Label>Note</Label>
          <Textarea value={f.notes ?? ""} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </div>
        <Button disabled={!f.name || mut.isPending} onClick={() => mut.mutate()}>Salva modifiche</Button>
      </CardContent>
    </Card>
  );
}

// ============ Tipologie ============
const DEFAULT_TYPE_CATEGORIES = [
  "Standard", "Deluxe", "Junior Suite", "Suite", "Garden Suite", "Monolocale", "Bilocale",
];

type RoomTypeForm = { name: string; category: string; beds: string; capacity: string; base_price: string; description: string };
const emptyTypeForm: RoomTypeForm = { name: "", category: "", beds: "", capacity: "", base_price: "", description: "" };

function RoomTypesTab({ structureId }: { structureId: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["room_types", structureId],
    queryFn: async () => {
      const { data, error } = await supabase.from("room_types" as any).select("*").eq("structure_id", structureId).order("name");
      if (error) throw error;
      return data as any[];
    },
  });

  const categories = Array.from(new Set([
    ...DEFAULT_TYPE_CATEGORIES,
    ...((data ?? []).map((t: any) => t.category).filter(Boolean) as string[]),
  ]));

  const [editing, setEditing] = useState<{ id: string | null; form: RoomTypeForm } | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const payload: any = {
        structure_id: structureId,
        name: editing.form.name,
        category: editing.form.category || null,
        description: editing.form.description || null,
        beds: editing.form.beds ? Number(editing.form.beds) : null,
        capacity: editing.form.capacity ? Number(editing.form.capacity) : null,
        base_price: editing.form.base_price ? Number(editing.form.base_price) : null,
      };
      if (editing.id) {
        const { error } = await supabase.from("room_types" as any).update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("room_types" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Tipologia salvata");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["room_types", structureId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("room_types" as any).delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Eliminata"); qc.invalidateQueries({ queryKey: ["room_types", structureId] }); qc.invalidateQueries({ queryKey: ["rooms", structureId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Tipologie camere</CardTitle>
        <Button size="sm" onClick={() => setEditing({ id: null, form: { ...emptyTypeForm } })}>
          <Plus className="h-4 w-4 mr-1" />Nuova tipologia
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="divide-y border rounded">
          {(data ?? []).map((t) => (
            <div key={t.id} className="flex items-center justify-between p-3 text-sm">
              <div className="min-w-0">
                <div className="font-medium">{t.name} {t.category && <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-accent text-accent-foreground">{t.category}</span>}</div>
                <div className="text-xs text-muted-foreground">{t.beds ?? "—"} letti · cap. {t.capacity ?? "—"} · {t.base_price ? `€ ${Number(t.base_price).toFixed(2)}` : "—"}</div>
                {t.description && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.description}</div>}
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => setEditing({ id: t.id, form: {
                  name: t.name ?? "", category: t.category ?? "", beds: t.beds?.toString() ?? "",
                  capacity: t.capacity?.toString() ?? "", base_price: t.base_price?.toString() ?? "",
                  description: t.description ?? "",
                } })}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => del.mutate(t.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
          {(!data || data.length === 0) && <div className="p-6 text-center text-sm text-muted-foreground">Nessuna tipologia.</div>}
        </div>
      </CardContent>

      <Dialog open={!!editing} onOpenChange={(v) => { if (!v) setEditing(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Modifica tipologia" : "Nuova tipologia"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="space-y-1"><Label>Nome *</Label>
                <Input value={editing.form.name} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, name: e.target.value } })} placeholder="Doppia" />
              </div>
              <div className="space-y-1"><Label>Categoria</Label>
                <Input list="room-type-categories" value={editing.form.category}
                  onChange={(e) => setEditing({ ...editing, form: { ...editing.form, category: e.target.value } })}
                  placeholder="Standard / Deluxe / Suite…" />
                <datalist id="room-type-categories">
                  {categories.map(c => <option key={c} value={c} />)}
                </datalist>
                <p className="text-xs text-muted-foreground">Scegli un valore o digitane uno nuovo: l'elenco si arricchisce automaticamente.</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1"><Label>Letti</Label><Input type="number" value={editing.form.beds} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, beds: e.target.value } })} /></div>
                <div className="space-y-1"><Label>Capienza</Label><Input type="number" value={editing.form.capacity} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, capacity: e.target.value } })} /></div>
                <div className="space-y-1"><Label>Prezzo base €</Label><Input type="number" value={editing.form.base_price} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, base_price: e.target.value } })} /></div>
              </div>
              <div className="space-y-1"><Label>Descrizione</Label>
                <Textarea value={editing.form.description} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, description: e.target.value } })} rows={3} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setEditing(null)}>Annulla</Button>
                <Button onClick={() => save.mutate()} disabled={!editing.form.name || save.isPending}>Salva</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ============ Piani & Camere ============
function RoomsTab({ structureId }: { structureId: string }) {
  const qc = useQueryClient();
  const [openRoom, setOpenRoom] = useState<any | null>(null);
  const { data: floors } = useQuery({
    queryKey: ["floors", structureId],
    queryFn: async () => {
      const { data, error } = await supabase.from("floors").select("*").eq("structure_id", structureId).order("level");
      if (error) throw error; return data ?? [];
    },
  });
  const { data: rooms } = useQuery({
    queryKey: ["rooms", structureId],
    queryFn: async () => {
      const { data, error } = await supabase.from("rooms").select("*").eq("structure_id", structureId).order("name");
      if (error) throw error; return data ?? [];
    },
  });
  const { data: types } = useQuery({
    queryKey: ["room_types", structureId],
    queryFn: async () => {
      const { data, error } = await supabase.from("room_types" as any).select("id,name").eq("structure_id", structureId);
      if (error) throw error; return (data ?? []) as any[];
    },
  });

  const [newFloor, setNewFloor] = useState({ name: "", level: "" });
  const [newRoom, setNewRoom] = useState({ name: "", floor_id: "", room_type_id: "" });

  const addFloor = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("floors").insert({ structure_id: structureId, name: newFloor.name, level: newFloor.level ? Number(newFloor.level) : 0 });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Piano creato"); setNewFloor({ name: "", level: "" }); qc.invalidateQueries({ queryKey: ["floors", structureId] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const delFloor = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("floors").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Piano eliminato"); qc.invalidateQueries({ queryKey: ["floors", structureId] }); qc.invalidateQueries({ queryKey: ["rooms", structureId] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const addRoom = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("rooms").insert({
        structure_id: structureId, name: newRoom.name,
        floor_id: newRoom.floor_id || null,
        room_type_id: newRoom.room_type_id || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Camera creata"); setNewRoom({ name: "", floor_id: "", room_type_id: "" }); qc.invalidateQueries({ queryKey: ["rooms", structureId] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const updRoom = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const { error } = await supabase.from("rooms").update(patch).eq("id", id); if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rooms", structureId] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const delRoom = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("rooms").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Camera eliminata"); qc.invalidateQueries({ queryKey: ["rooms", structureId] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const seedPreset = useMutation({
    mutationFn: async (cfg: { preset: string; floors: number; perFloor: number }) => {
      const { error } = await (supabase as any).rpc("seed_structure_preset", {
        _structure: structureId, _preset: cfg.preset, _floors_count: cfg.floors, _rooms_per_floor: cfg.perFloor,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Preset applicato"); qc.invalidateQueries({ queryKey: ["floors", structureId] }); qc.invalidateQueries({ queryKey: ["rooms", structureId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Piani</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input placeholder="Nome (es. Piano 1)" value={newFloor.name} onChange={(e) => setNewFloor({ ...newFloor, name: e.target.value })} />
            <Input placeholder="Livello" type="number" className="w-24" value={newFloor.level} onChange={(e) => setNewFloor({ ...newFloor, level: e.target.value })} />
            <Button disabled={!newFloor.name || addFloor.isPending} onClick={() => addFloor.mutate()}><Plus className="h-4 w-4" /></Button>
          </div>
          <div className="divide-y border rounded">
            {(floors ?? []).map((f: any) => (
              <div key={f.id} className="flex items-center justify-between p-3 text-sm">
                <span>{f.name} <span className="text-xs text-muted-foreground">· liv. {f.level}</span></span>
                <Button size="icon" variant="ghost" onClick={() => delFloor.mutate(f.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            {(!floors || floors.length === 0) && <div className="p-4 text-center text-sm text-muted-foreground">Nessun piano.</div>}
          </div>
          <div className="border-t pt-3 space-y-2">
            <div className="text-xs text-muted-foreground">Crea rapidamente con preset:</div>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" onClick={() => seedPreset.mutate({ preset: "small", floors: 2, perFloor: 5 })}>Piccolo (2×5)</Button>
              <Button size="sm" variant="outline" onClick={() => seedPreset.mutate({ preset: "medium", floors: 3, perFloor: 10 })}>Medio (3×10)</Button>
              <Button size="sm" variant="outline" onClick={() => seedPreset.mutate({ preset: "large", floors: 5, perFloor: 15 })}>Grande (5×15)</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Camere</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
            <Input placeholder="Nome (es. 101)" value={newRoom.name} onChange={(e) => setNewRoom({ ...newRoom, name: e.target.value })} />
            <Select value={newRoom.floor_id} onValueChange={(v) => setNewRoom({ ...newRoom, floor_id: v })}>
              <SelectTrigger><SelectValue placeholder="Piano" /></SelectTrigger>
              <SelectContent>{(floors ?? []).map((f: any) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={newRoom.room_type_id} onValueChange={(v) => setNewRoom({ ...newRoom, room_type_id: v })}>
              <SelectTrigger><SelectValue placeholder="Tipologia" /></SelectTrigger>
              <SelectContent>{(types ?? []).map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
            <Button disabled={!newRoom.name || addRoom.isPending} onClick={() => addRoom.mutate()}><Plus className="h-4 w-4" /></Button>
          </div>
          <div className="divide-y border rounded max-h-[420px] overflow-auto">
            {(rooms ?? []).map((r: any) => (
              <div key={r.id} className="flex items-center justify-between gap-2 p-2 text-sm">
                <span className="font-medium w-20">{r.name}</span>
                <Select value={r.floor_id ?? ""} onValueChange={(v) => updRoom.mutate({ id: r.id, patch: { floor_id: v || null } })}>
                  <SelectTrigger className="h-8"><SelectValue placeholder="Piano" /></SelectTrigger>
                  <SelectContent>{(floors ?? []).map((f: any) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={r.room_type_id ?? ""} onValueChange={(v) => updRoom.mutate({ id: r.id, patch: { room_type_id: v || null } })}>
                  <SelectTrigger className="h-8"><SelectValue placeholder="Tipologia" /></SelectTrigger>
                  <SelectContent>{(types ?? []).map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={r.housekeeping_status ?? "clean"} onValueChange={(v) => updRoom.mutate({ id: r.id, patch: { housekeeping_status: v } })}>
                  <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["clean","dirty","in_progress","inspected","out_of_order"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button size="icon" variant="ghost" title="Pianta & arredi" onClick={() => setOpenRoom(r)}><LayoutGrid className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => delRoom.mutate(r.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            {(!rooms || rooms.length === 0) && <div className="p-4 text-center text-sm text-muted-foreground">Nessuna camera.</div>}
          </div>
        </CardContent>
      </Card>
      {openRoom && typeof window !== "undefined" && (
        <Suspense fallback={null}>
          <RoomDetailDialog
            room={{ id: openRoom.id, name: openRoom.name, structure_id: structureId, plan_path: openRoom.plan_path ?? null }}
            open={!!openRoom}
            onOpenChange={(v) => { if (!v) setOpenRoom(null); }}
          />
        </Suspense>
      )}
    </div>
  );
}

// ============ Foto ============
function PhotosTab({ structureId }: { structureId: string }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: photos } = useQuery({
    queryKey: ["structure_photos", structureId],
    queryFn: async () => {
      const { data, error } = await supabase.from("structure_photos" as any).select("*").eq("structure_id", structureId).order("sort_order");
      if (error) throw error;
      return data as any[];
    },
  });

  // Resolve signed URLs
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!photos) return;
      const out: Record<string, string> = {};
      for (const p of photos) {
        const { data } = await supabase.storage.from("structure-photos").createSignedUrl(p.path, 3600);
        if (data?.signedUrl) out[p.id] = data.signedUrl;
      }
      if (!cancelled) setUrls(out);
    })();
    return () => { cancelled = true; };
  }, [photos]);

  const upload = useMutation({
    mutationFn: async (files: FileList) => {
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop() || "bin";
        const path = `${structureId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("structure-photos").upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        const { error: insErr } = await supabase.from("structure_photos" as any).insert({
          structure_id: structureId, path, caption: file.name, sort_order: 0,
        } as any);
        if (insErr) throw insErr;
      }
    },
    onSuccess: () => { toast.success("Foto caricate"); qc.invalidateQueries({ queryKey: ["structure_photos", structureId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (p: any) => {
      await supabase.storage.from("structure-photos").remove([p.path]);
      const { error } = await supabase.from("structure_photos" as any).delete().eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Foto eliminata"); qc.invalidateQueries({ queryKey: ["structure_photos", structureId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader><CardTitle>Galleria foto</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
            onChange={(e) => e.target.files && upload.mutate(e.target.files)} />
          <Button onClick={() => fileRef.current?.click()} disabled={upload.isPending}>
            <Upload className="h-4 w-4 mr-1" />Carica foto
          </Button>
        </div>
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          {(photos ?? []).map((p) => (
            <div key={p.id} className="relative group border rounded overflow-hidden">
              {urls[p.id] ? (
                <img src={urls[p.id]} alt={p.caption ?? ""} className="w-full h-40 object-cover" />
              ) : (
                <div className="w-full h-40 bg-muted animate-pulse" />
              )}
              <div className="p-2 text-xs truncate">{p.caption ?? "—"}</div>
              <Button size="icon" variant="destructive" className="absolute top-1 right-1 opacity-0 group-hover:opacity-100" onClick={() => del.mutate(p)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {(!photos || photos.length === 0) && <div className="col-span-full p-8 text-center text-sm text-muted-foreground">Nessuna foto.</div>}
        </div>
      </CardContent>
    </Card>
  );
}

// ============ Mappa ============
function MapTab({ s }: { s: Structure }) {
  const qc = useQueryClient();
  const [lat, setLat] = useState<number | null>(s.lat);
  const [lng, setLng] = useState<number | null>(s.lng);
  useEffect(() => { setLat(s.lat); setLng(s.lng); }, [s.lat, s.lng]);

  const save = useMutation({
    mutationFn: async (coords: { lat: number; lng: number }) => {
      const { error } = await supabase.from("structures").update({ lat: coords.lat, lng: coords.lng }).eq("id", s.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Coordinate salvate"); qc.invalidateQueries({ queryKey: ["structure", s.id] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const geocode = async () => {
    const q = [s.address, s.postal_code, s.city, s.province, s.country].filter(Boolean).join(", ");
    if (!q) { toast.error("Compila almeno l'indirizzo o la città"); return; }
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`, {
        headers: { "Accept-Language": "it" },
      });
      const arr = await res.json();
      if (!Array.isArray(arr) || arr.length === 0) { toast.error("Indirizzo non trovato"); return; }
      const la = Number(arr[0].lat), ln = Number(arr[0].lon);
      setLat(la); setLng(ln); save.mutate({ lat: la, lng: ln });
    } catch (e: any) { toast.error("Errore geocodifica: " + e.message); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><MapPin className="h-4 w-4" />Mappa</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1"><Label>Latitudine</Label>
            <Input type="number" step="any" value={lat ?? ""} onChange={(e) => setLat(e.target.value ? Number(e.target.value) : null)} className="w-44" />
          </div>
          <div className="space-y-1"><Label>Longitudine</Label>
            <Input type="number" step="any" value={lng ?? ""} onChange={(e) => setLng(e.target.value ? Number(e.target.value) : null)} className="w-44" />
          </div>
          <Button variant="outline" onClick={geocode}>Geocodifica da indirizzo</Button>
          <Button disabled={lat == null || lng == null || save.isPending} onClick={() => save.mutate({ lat: lat!, lng: lng! })}>Salva coordinate</Button>
        </div>
        <div className="h-[480px] w-full rounded overflow-hidden border">
          {typeof window === "undefined" ? (
            <div className="h-full w-full bg-muted" />
          ) : (
            <Suspense fallback={<div className="h-full w-full bg-muted animate-pulse" />}>
              <StructureMap
                lat={lat}
                lng={lng}
                onDragEnd={(la, ln) => { setLat(la); setLng(ln); save.mutate({ lat: la, lng: ln }); }}
              />
            </Suspense>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Trascina il segnaposto per modificare le coordinate. Tile: OpenStreetMap.</p>
      </CardContent>
    </Card>
  );
}