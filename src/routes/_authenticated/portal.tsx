import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Attachments } from "@/components/tickets/Attachments";
import { Videocall } from "@/components/tickets/Videocall";
import { InterventionReport } from "@/components/tickets/InterventionReport";
import { fmtDateTime, timeUntil } from "@/lib/format";
import { Clock, LogOut, Ticket as TicketIcon, Video, Camera } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/portal")({ component: Portal });

function Portal() {
  const [activeTicket, setActiveTicket] = useState<string | null>(null);

  const { data: me } = useQuery({ queryKey:["me-portal"], queryFn: async()=>(await supabase.auth.getUser()).data.user });
  const { data: profile } = useQuery({
    queryKey:["me-profile-portal", me?.id], enabled: !!me?.id,
    queryFn: async()=> (await supabase.from("profiles").select("*").eq("id", me!.id).single()).data,
  });

  // I ticket assegnati all'agente / fornitore corrente
  const { data: tickets = [] } = useQuery({
    queryKey:["portal-tickets", me?.id], enabled: !!me?.id,
    queryFn: async()=> (await supabase.from("tickets")
      .select("id,ticket_number,title,priority,status,resolve_due_at,created_at,structure_id, structures(name)")
      .eq("assigned_to", me!.id)
      .order("created_at", { ascending: false })).data ?? [],
  });

  const open = tickets.filter((t:any)=>!["risolto","chiuso","annullato"].includes(t.status));
  const done = tickets.filter((t:any)=>["risolto","chiuso"].includes(t.status));
  const selected = tickets.find((t:any)=>t.id===activeTicket) ?? null;

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }

  return (
    <div className="min-h-[calc(100vh-7rem)] -m-6 p-6 bg-muted/30">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-primary text-primary-foreground font-display font-bold">P</div>
          <div>
            <h1 className="font-display text-xl font-bold">Portale Agenti & Fornitori</h1>
            <p className="text-xs text-muted-foreground">Benvenuto {profile?.full_name ?? profile?.email}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild><Link to="/app">Area completa</Link></Button>
          <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="h-4 w-4 mr-1"/>Esci</Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <div className="space-y-3">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="font-display text-base flex items-center gap-2"><TicketIcon className="h-4 w-4"/>I tuoi interventi</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Tabs defaultValue="open">
                <TabsList className="mx-3 my-2"><TabsTrigger value="open">Aperti ({open.length})</TabsTrigger><TabsTrigger value="done">Conclusi ({done.length})</TabsTrigger></TabsList>
                <TabsContent value="open" className="m-0 divide-y">
                  {open.length===0 && <div className="p-4 text-xs text-center text-muted-foreground">Nessun intervento aperto.</div>}
                  {open.map((t:any)=>(<TicketRow key={t.id} t={t} active={activeTicket===t.id} onClick={()=>setActiveTicket(t.id)}/>))}
                </TabsContent>
                <TabsContent value="done" className="m-0 divide-y">
                  {done.length===0 && <div className="p-4 text-xs text-center text-muted-foreground">Nessuno.</div>}
                  {done.map((t:any)=>(<TicketRow key={t.id} t={t} active={activeTicket===t.id} onClick={()=>setActiveTicket(t.id)}/>))}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="font-display text-sm">Cosa puoi fare</CardTitle></CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-2">
              <div className="flex items-center gap-2"><Camera className="h-3 w-3"/>Carica foto e PDF dell'intervento</div>
              <div className="flex items-center gap-2"><TicketIcon className="h-3 w-3"/>Compila il rapportino con ore e materiali</div>
              <div className="flex items-center gap-2"><Video className="h-3 w-3"/>Avvia una videocall col gestore</div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {!selected ? (
            <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">Seleziona un intervento dalla lista a sinistra.</CardContent></Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <div className="text-xs text-muted-foreground">#{(selected as any).ticket_number} · {(selected as any).structures?.name}</div>
                      <CardTitle className="font-display text-xl">{(selected as any).title}</CardTitle>
                    </div>
                    <div className="flex gap-2 items-center">
                      <Badge variant="outline">{(selected as any).priority}</Badge>
                      <Badge variant="outline">{(selected as any).status}</Badge>
                      <StatusActions ticket={selected as any} onUpdated={()=>{}} />
                    </div>
                  </div>
                </CardHeader>
              </Card>
              <Attachments ticketId={(selected as any).id}/>
              <InterventionReport ticketId={(selected as any).id}/>
              <Videocall ticketId={(selected as any).id} structureId={(selected as any).structure_id}/>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TicketRow({ t, active, onClick }: { t: any; active: boolean; onClick: ()=>void }) {
  const sla = timeUntil(t.resolve_due_at);
  return (
    <button onClick={onClick} className={`block w-full text-left px-3 py-2 hover:bg-accent/40 ${active?"bg-accent":""}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] text-muted-foreground">#{t.ticket_number}</span>
        <Badge variant="outline" className="text-[10px]">{t.priority}</Badge>
      </div>
      <div className="text-sm font-medium truncate">{t.title}</div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{t.structures?.name}</span>
        <span className={sla.status==="violated"?"text-destructive":sla.status==="warn"?"text-warning":"text-success"}><Clock className="inline h-3 w-3 mr-0.5"/>{sla.label}</span>
      </div>
      <div className="text-[10px] text-muted-foreground">{fmtDateTime(t.created_at)}</div>
    </button>
  );
}

function StatusActions({ ticket }: { ticket: any; onUpdated: ()=>void }) {
  async function set(status: string) {
    const patch: any = { status };
    if (status==="in_corso" && !ticket.ack_at) patch.ack_at = new Date().toISOString();
    if (status==="risolto" && !ticket.resolved_at) patch.resolved_at = new Date().toISOString();
    const { error } = await supabase.from("tickets").update(patch).eq("id", ticket.id);
    if (error) toast.error(error.message); else toast.success("Stato aggiornato");
  }
  return (
    <div className="flex gap-1">
      {ticket.status==="assegnato" && <Button size="sm" onClick={()=>set("in_corso")}>Prendi in carico</Button>}
      {ticket.status==="in_corso" && <Button size="sm" variant="outline" onClick={()=>set("risolto")}>Segna risolto</Button>}
    </div>
  );
}