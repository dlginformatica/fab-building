import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Upload, ZoomIn, ZoomOut, Crosshair } from "lucide-react";
import { toast } from "sonner";

type Room = { id: string; name: string; structure_id: string; plan_path: string | null };
type Furn = {
  id: string; room_id: string; structure_id: string;
  kind: "mobilio" | "arredo" | "accessorio" | null;
  name: string; locale: string | null; quantity: number | null; notes: string | null;
  pos_x: number | null; pos_y: number | null;
};

export default function RoomDetailDialog({
  room, open, onOpenChange,
}: { room: Room; open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader><DialogTitle>Camera {room.name}</DialogTitle></DialogHeader>
        <Tabs defaultValue="plan" className="space-y-3">
          <TabsList>
            <TabsTrigger value="plan">Pianta</TabsTrigger>
            <TabsTrigger value="furn">Arredi & Mobilio</TabsTrigger>
          </TabsList>
          <TabsContent value="plan"><PlanAndFurniture room={room} /></TabsContent>
          <TabsContent value="furn"><FurnitureList room={room} /></TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function useFurnishings(room: Room) {
  return useQuery({
    queryKey: ["room_furnishings", room.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("room_furnishings")
        .select("*").eq("room_id", room.id).order("created_at");
      if (error) throw error;
      return (data ?? []) as Furn[];
    },
  });
}

function FurnitureList({ room }: { room: Room }) {
  const qc = useQueryClient();
  const { data } = useFurnishings(room);
  const [form, setForm] = useState({ kind: "arredo", name: "", locale: "camera", quantity: "1", notes: "" });
  const create = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("room_furnishings").insert({
        room_id: room.id, structure_id: room.structure_id,
        kind: form.kind, name: form.name, locale: form.locale || null,
        quantity: form.quantity ? Number(form.quantity) : 1, notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Aggiunto"); setForm({ kind: "arredo", name: "", locale: "camera", quantity: "1", notes: "" }); qc.invalidateQueries({ queryKey: ["room_furnishings", room.id] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const upd = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Furn> }) => {
      const { error } = await (supabase as any).from("room_furnishings").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["room_furnishings", room.id] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await (supabase as any).from("room_furnishings").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Eliminato"); qc.invalidateQueries({ queryKey: ["room_furnishings", room.id] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const grouped = useMemo(() => {
    const g: Record<string, Furn[]> = {};
    for (const f of data ?? []) {
      const k = f.locale || "altro";
      (g[k] ||= []).push(f);
    }
    return g;
  }, [data]);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
        <div><Label className="text-xs">Tipo</Label>
          <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["mobilio","arredo","accessorio"].map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Letto matrimoniale" /></div>
        <div><Label className="text-xs">Locale</Label>
          <Input list="furn-locales" value={form.locale} onChange={(e) => setForm({ ...form, locale: e.target.value })} placeholder="camera/bagno/soggiorno…" />
          <datalist id="furn-locales">
            {["camera","bagno","soggiorno","cucina","ingresso","balcone","giardino","cabina armadio"].map(x => <option key={x} value={x} />)}
          </datalist>
        </div>
        <div><Label className="text-xs">Q.tà</Label><Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></div>
        <div className="md:col-span-1"><Label className="text-xs">Note</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        <Button onClick={() => create.mutate()} disabled={!form.name || create.isPending}><Plus className="h-4 w-4 mr-1" />Aggiungi</Button>
      </div>
      <div className="space-y-3 max-h-[420px] overflow-auto">
        {Object.entries(grouped).map(([locale, items]) => (
          <div key={locale}>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{locale}</div>
            <div className="divide-y border rounded">
              {items.map(f => (
                <div key={f.id} className="grid grid-cols-12 gap-2 items-center p-2 text-sm">
                  <Select value={f.kind ?? "arredo"} onValueChange={(v) => upd.mutate({ id: f.id, patch: { kind: v as any } })}>
                    <SelectTrigger className="h-8 col-span-2"><SelectValue /></SelectTrigger>
                    <SelectContent>{["mobilio","arredo","accessorio"].map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input className="col-span-3 h-8" defaultValue={f.name} onBlur={(e) => e.target.value !== f.name && upd.mutate({ id: f.id, patch: { name: e.target.value } })} />
                  <Input className="col-span-2 h-8" defaultValue={f.locale ?? ""} onBlur={(e) => e.target.value !== (f.locale ?? "") && upd.mutate({ id: f.id, patch: { locale: e.target.value || null } })} />
                  <Input type="number" className="col-span-1 h-8" defaultValue={f.quantity ?? 1} onBlur={(e) => Number(e.target.value) !== f.quantity && upd.mutate({ id: f.id, patch: { quantity: Number(e.target.value) } })} />
                  <Input className="col-span-3 h-8" defaultValue={f.notes ?? ""} placeholder="note" onBlur={(e) => e.target.value !== (f.notes ?? "") && upd.mutate({ id: f.id, patch: { notes: e.target.value || null } })} />
                  <Button size="icon" variant="ghost" className="col-span-1" onClick={() => del.mutate(f.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          </div>
        ))}
        {(!data || data.length === 0) && <div className="p-6 text-center text-sm text-muted-foreground border rounded">Nessun arredo registrato.</div>}
      </div>
    </div>
  );
}

function PlanAndFurniture({ room }: { room: Room }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const imgWrapRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [placingMode, setPlacingMode] = useState(false);

  const { data: furn } = useFurnishings(room);
  const [planUrl, setPlanUrl] = useState<string | null>(null);
  const [planPath, setPlanPath] = useState<string | null>(room.plan_path);

  useEffect(() => { setPlanPath(room.plan_path); }, [room.plan_path]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!planPath) { setPlanUrl(null); return; }
      const { data } = await supabase.storage.from("structure-photos").createSignedUrl(planPath, 3600);
      if (!cancel) setPlanUrl(data?.signedUrl ?? null);
    })();
    return () => { cancel = true; };
  }, [planPath]);

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const ext = file.name.split(".").pop() || "bin";
      const path = `${room.structure_id}/rooms/${room.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("structure-photos").upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { error } = await supabase.from("rooms").update({ plan_path: path } as any).eq("id", room.id);
      if (error) throw error;
      return path;
    },
    onSuccess: (path) => {
      toast.success("Pianta caricata");
      setPlanPath(path);
      qc.invalidateQueries({ queryKey: ["rooms", room.structure_id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removePlan = useMutation({
    mutationFn: async () => {
      if (planPath) await supabase.storage.from("structure-photos").remove([planPath]);
      const { error } = await supabase.from("rooms").update({ plan_path: null } as any).eq("id", room.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Pianta rimossa"); setPlanPath(null); qc.invalidateQueries({ queryKey: ["rooms", room.structure_id] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const setPos = useMutation({
    mutationFn: async ({ id, x, y }: { id: string; x: number; y: number }) => {
      const { error } = await (supabase as any).from("room_furnishings").update({ pos_x: x, pos_y: y }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["room_furnishings", room.id] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const draggingRef = useRef<string | null>(null);
  const [dragPos, setDragPos] = useState<{ id: string; x: number; y: number } | null>(null);

  const computePct = (clientX: number, clientY: number) => {
    const wrap = imgWrapRef.current;
    if (!wrap) return null;
    const rect = wrap.getBoundingClientRect();
    const clamp = (v: number) => Math.max(0, Math.min(100, v));
    return { x: clamp(((clientX - rect.left) / rect.width) * 100), y: clamp(((clientY - rect.top) / rect.height) * 100) };
  };

  const onMarkerDragStart = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    draggingRef.current = id;
    setSelectedId(id);
  };

  useEffect(() => {
    const move = (ev: MouseEvent) => {
      const id = draggingRef.current; if (!id) return;
      const p = computePct(ev.clientX, ev.clientY); if (!p) return;
      setDragPos({ id, x: p.x, y: p.y });
    };
    const up = (ev: MouseEvent) => {
      const id = draggingRef.current; if (!id) return;
      draggingRef.current = null;
      const p = computePct(ev.clientX, ev.clientY);
      if (p) setPos.mutate({ id, x: p.x, y: p.y });
      setDragPos(null);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
  }, [setPos]);

  const onMapClick = (e: React.MouseEvent) => {
    if (!placingMode || !selectedId) return;
    const wrap = imgWrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    // Reverse pan/zoom: position relative to displayed image
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const clamped = (v: number) => Math.max(0, Math.min(100, v));
    setPos.mutate({ id: selectedId, x: clamped(x), y: clamped(y) });
    setPlacingMode(false);
  };

  const onPanStart = (e: React.MouseEvent) => {
    if (placingMode || draggingRef.current) return;
    dragRef.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
  };
  const onPanMove = (e: React.MouseEvent) => {
    const d = dragRef.current; if (!d) return;
    setPan({ x: d.px + (e.clientX - d.x), y: d.py + (e.clientY - d.y) });
  };
  const onPanEnd = () => { dragRef.current = null; };

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_320px]">
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2 items-center">
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => e.target.files?.[0] && upload.mutate(e.target.files[0])} />
          <Button size="sm" onClick={() => fileRef.current?.click()} disabled={upload.isPending}>
            <Upload className="h-4 w-4 mr-1" />{planPath ? "Sostituisci pianta" : "Carica pianta"}
          </Button>
          {planPath && <Button size="sm" variant="outline" onClick={() => removePlan.mutate()}>Rimuovi</Button>}
          <div className="ml-auto flex gap-1">
            <Button size="icon" variant="outline" onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}><ZoomOut className="h-4 w-4" /></Button>
            <Button size="icon" variant="outline" onClick={() => setZoom((z) => Math.min(4, z + 0.25))}><ZoomIn className="h-4 w-4" /></Button>
            <Button size="icon" variant="outline" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}><Crosshair className="h-4 w-4" /></Button>
          </div>
        </div>
        <div
          className={"relative h-[460px] w-full overflow-hidden rounded border bg-muted " + (placingMode ? "cursor-crosshair" : "cursor-grab")}
          onMouseDown={onPanStart} onMouseMove={onPanMove} onMouseUp={onPanEnd} onMouseLeave={onPanEnd}
          onClick={onMapClick}
        >
          {planUrl ? (
            <div
              ref={imgWrapRef}
              className="absolute inset-0 origin-center"
              style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "center center" }}
            >
              <img src={planUrl} alt="Pianta camera" className="h-full w-full object-contain pointer-events-none select-none" draggable={false} />
              {(furn ?? []).filter(f => f.pos_x != null && f.pos_y != null).map(f => (
                <button key={f.id}
                  onClick={(e) => { e.stopPropagation(); setSelectedId(f.id); }}
                  onMouseDown={(e) => onMarkerDragStart(e, f.id)}
                  className={"absolute -translate-x-1/2 -translate-y-1/2 rounded-full px-2 py-0.5 text-[10px] font-semibold shadow border cursor-move select-none " +
                    (selectedId === f.id ? "bg-primary text-primary-foreground border-primary ring-2 ring-primary" : "bg-background border-border")}
                  style={{
                    left: `${dragPos?.id === f.id ? dragPos.x : f.pos_x}%`,
                    top: `${dragPos?.id === f.id ? dragPos.y : f.pos_y}%`,
                  }}
                  title={`${f.name} — trascina per spostare`}
                >{f.name}</button>
              ))}
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">Nessuna pianta caricata.</div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {placingMode
            ? "Modalità posizionamento: clicca sulla pianta per piazzare il segnaposto."
            : "Trascina la vista per spostarti, usa zoom. I segnaposti possono essere trascinati direttamente sulla pianta; in alternativa seleziona un arredo e clicca \"Posiziona\"."}
        </p>
      </div>
      <div className="space-y-2">
        <div className="text-xs font-medium text-muted-foreground uppercase">Arredi</div>
        <div className="border rounded divide-y max-h-[460px] overflow-auto">
          {(furn ?? []).map(f => (
            <div key={f.id}
              onClick={() => setSelectedId(f.id)}
              className={"p-2 text-sm cursor-pointer " + (selectedId === f.id ? "bg-accent" : "hover:bg-accent/40")}>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium truncate">{f.name}</div>
                  <div className="text-[11px] text-muted-foreground">{f.kind ?? "—"} · {f.locale ?? "—"} · q. {f.quantity ?? 1}</div>
                </div>
                {f.pos_x != null
                  ? <span className="text-[10px] text-emerald-600">●</span>
                  : <span className="text-[10px] text-muted-foreground">○</span>}
              </div>
            </div>
          ))}
          {(!furn || furn.length === 0) && <div className="p-4 text-center text-xs text-muted-foreground">Nessun arredo. Aggiungili nella tab "Arredi & Mobilio".</div>}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant={placingMode ? "default" : "outline"} disabled={!selectedId || !planPath} onClick={() => setPlacingMode((v) => !v)}>
            {placingMode ? "Annulla" : "Posiziona segnaposto"}
          </Button>
          {selectedId && (furn ?? []).find(f => f.id === selectedId)?.pos_x != null && (
            <Button size="sm" variant="ghost" onClick={() => setPos.mutate({ id: selectedId!, x: null as any, y: null as any })}>Rimuovi posizione</Button>
          )}
        </div>
      </div>
    </div>
  );
}