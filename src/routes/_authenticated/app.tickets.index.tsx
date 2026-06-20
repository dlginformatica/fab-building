import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useActiveStructure } from "@/lib/structure-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Clock } from "lucide-react";
import { toast } from "sonner";
import { fmtDateTime, timeUntil } from "@/lib/format";
import { PriorityBadge, StatusBadge } from "./app.index";

const searchSchema = z.object({ asset: z.string().optional() });

export const Route = createFileRoute("/_authenticated/app/tickets/")({
  validateSearch: (s) => searchSchema.parse(s),
  component: Page,
});

const STATUSES = ["aperto","assegnato","in_corso","sospeso","risolto","chiuso","annullato"] as const;
const KANBAN = ["aperto","assegnato","in_corso","risolto"] as const;

function Page() {
  const qc = useQueryClient();
  const { activeStructureId } = useActiveStructure();
  const search = Route.useSearch();
  const [open, setOpen] = useState(!!search.asset);

  const { data: tickets } = useQuery({
    queryKey: ["tickets", activeStructureId],
    enabled: !!activeStructureId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("id,ticket_number,title,priority,status,resolve_due_at,ack_due_at,created_at,assigned_to,asset_id")
        .eq("structure_id", activeStructureId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (!activeStructureId) return <div className="p-10 text-center text-sm text-muted-foreground">Seleziona una struttura.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Ticket</h1>
          <p className="text-sm text-muted-foreground">Trouble Ticketing con SLA.</p>
        </div>
        <NewTicketDialog open={open} setOpen={setOpen} structureId={activeStructureId} presetAssetId={search.asset} onCreated={() => qc.invalidateQueries({ queryKey: ["tickets"] })} />
      </div>
      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">Lista</TabsTrigger>
          <TabsTrigger value="kanban">Kanban</TabsTrigger>
        </TabsList>
        <TabsContent value="list" className="pt-4">
          <Card><CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <tr><th className="px-4 py-2">#</th><th className="px-4 py-2">Titolo</th><th className="px-4 py-2">Priorità</th><th className="px-4 py-2">Stato</th><th className="px-4 py-2">Assegnato</th><th className="px-4 py-2">SLA risolvi</th><th className="px-4 py-2">Creato</th></tr>
              </thead>
              <tbody>
                {(tickets ?? []).map((t) => {
                  const sla = timeUntil(t.resolve_due_at);
                  return (
                    <tr key={t.id} className="border-b border-border/60 hover:bg-accent/40">
                      <td className="px-4 py-2 font-mono text-xs">#{t.ticket_number}</td>
                      <td className="px-4 py-2"><Link to="/app/tickets/$id" params={{ id: t.id }} className="hover:underline">{t.title}</Link></td>
                      <td className="px-4 py-2"><PriorityBadge p={t.priority} /></td>
                      <td className="px-4 py-2"><StatusBadge s={t.status} /></td>
                      <td className="px-4 py-2 text-xs">{(t as { profiles?: { full_name?: string; email?: string } }).profiles?.full_name ?? "—"}</td>
                      <td className="px-4 py-2 text-xs"><span className={sla.status === "violated" ? "text-destructive" : sla.status === "warn" ? "text-warning" : "text-success"}><Clock className="mr-1 inline h-3 w-3" />{sla.label}</span></td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{fmtDateTime(t.created_at)}</td>
                    </tr>
                  );
                })}
                {(!tickets || tickets.length === 0) && (<tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Nessun ticket.</td></tr>)}
              </tbody>
            </table>
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="kanban" className="pt-4">
          <div className="grid gap-3 md:grid-cols-4">
            {KANBAN.map((status) => (
              <div key={status}>
                <div className="mb-2 px-1 text-xs font-medium uppercase text-muted-foreground">{status.replace("_"," ")}</div>
                <div className="space-y-2">
                  {(tickets ?? []).filter((t) => t.status === status).map((t) => (
                    <Link key={t.id} to="/app/tickets/$id" params={{ id: t.id }}>
                      <Card className="cursor-pointer hover:border-primary/60">
                        <CardContent className="space-y-2 p-3">
                          <div className="text-xs font-mono text-muted-foreground">#{t.ticket_number}</div>
                          <div className="text-sm font-medium">{t.title}</div>
                          <div className="flex items-center justify-between"><PriorityBadge p={t.priority} /><span className="text-[10px] text-muted-foreground">{fmtDateTime(t.created_at)}</span></div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function NewTicketDialog({ open, setOpen, structureId, presetAssetId, onCreated }: {
  open: boolean; setOpen: (b: boolean) => void; structureId: string; presetAssetId?: string; onCreated: () => void;
}) {
  const [form, setForm] = useState({ title: "", description: "", priority: "media", category_id: "", asset_id: presetAssetId ?? "" });

  const { data: categories } = useQuery({
    queryKey: ["asset_categories"],
    queryFn: async () => (await supabase.from("asset_categories").select("id,name").order("name")).data ?? [],
  });
  const { data: assets } = useQuery({
    queryKey: ["assets-mini", structureId],
    queryFn: async () => (await supabase.from("assets").select("id,code,name").eq("structure_id", structureId).order("name")).data ?? [],
  });

  const mut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("tickets").insert({
        structure_id: structureId,
        title: form.title, description: form.description || null,
        priority: form.priority as "bassa"|"media"|"alta"|"critica",
        category_id: form.category_id || null,
        asset_id: form.asset_id || null,
        reported_by: (await supabase.auth.getUser()).data.user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ticket creato");
      onCreated();
      setOpen(false);
      setForm({ title: "", description: "", priority: "media", category_id: "", asset_id: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" />Nuovo ticket</Button></DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Nuovo ticket</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>Titolo *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div className="space-y-1"><Label>Descrizione</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Priorità</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bassa">Bassa</SelectItem>
                  <SelectItem value="media">Media</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="critica">Critica</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Categoria</Label>
              <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{(categories ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Asset</Label>
            <Select value={form.asset_id} onValueChange={(v) => setForm({ ...form, asset_id: v })}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>{(assets ?? []).map((a) => <SelectItem key={a.id} value={a.id}>{a.code} · {a.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button disabled={!form.title || mut.isPending} onClick={() => mut.mutate()} className="w-full">Apri ticket</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { STATUSES };