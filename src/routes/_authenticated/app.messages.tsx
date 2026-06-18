import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useActiveStructure } from "@/lib/structure-context";
import { askAgent } from "@/lib/agent.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Send, Bot } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/messages")({ component: Page });

function Page() {
  const qc = useQueryClient();
  const { activeStructureId } = useActiveStructure();
  const [selected, setSelected] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title:"", is_group:false, agent_type:"", participants: [] as string[] });

  const { data: me } = useQuery({ queryKey:["me"], queryFn: async()=> (await supabase.auth.getUser()).data.user });
  const { data: profiles = [] } = useQuery({ queryKey:["profiles-mini"], queryFn: async()=> (await supabase.from("profiles").select("id,full_name,email").order("full_name")).data ?? [] });
  const { data: convs = [] } = useQuery({
    queryKey: ["conversations", activeStructureId, me?.id], enabled: !!me?.id,
    queryFn: async () => (await supabase.from("conversations").select("*").order("updated_at",{ascending:false})).data ?? [],
  });

  const createConv = useMutation({
    mutationFn: async () => {
      if (!me) throw new Error("Non autenticato");
      const { data: conv, error } = await supabase.from("conversations").insert({
        structure_id: activeStructureId ?? null,
        title: form.title || (form.agent_type ? `Agente ${form.agent_type}` : "Nuova conversazione"),
        is_group: form.is_group || form.participants.length > 1,
        agent_type: form.agent_type || null,
        created_by: me.id,
      }).select().single();
      if (error) throw error;
      const parts = [{ conversation_id: conv.id, user_id: me.id },
        ...form.participants.filter(p=>p!==me.id).map(p=>({ conversation_id: conv.id, user_id: p }))];
      const { error: perr } = await supabase.from("conversation_participants").insert(parts);
      if (perr) throw perr;
      return conv;
    },
    onSuccess: (c) => { toast.success("Conversazione creata"); qc.invalidateQueries({queryKey:["conversations"]}); setOpen(false); setSelected(c.id); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid h-[calc(100vh-7rem)] grid-cols-[280px_1fr] gap-3">
      <div className="flex flex-col gap-2 overflow-hidden">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Conversazioni</h2>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4"/></Button></DialogTrigger>
            <DialogContent><DialogHeader><DialogTitle>Nuova conversazione</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1"><Label>Titolo</Label><Input value={form.title} onChange={(e)=>setForm({...form,title:e.target.value})}/></div>
                <div className="space-y-1"><Label>Partecipanti</Label>
                  <div className="max-h-40 overflow-y-auto rounded-md border p-2 space-y-1">
                    {profiles.filter((p:any)=>p.id!==me?.id).map((p:any)=>(
                      <label key={p.id} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={form.participants.includes(p.id)} onChange={(e)=>{
                          setForm({...form, participants: e.target.checked ? [...form.participants, p.id] : form.participants.filter(x=>x!==p.id)});
                        }}/>
                        {p.full_name ?? p.email}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-1"><Label>Agente AI (opzionale)</Label>
                  <Select value={form.agent_type} onValueChange={(v)=>setForm({...form,agent_type:v})}>
                    <SelectTrigger><SelectValue placeholder="Nessuno"/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="concierge">Concierge tecnico</SelectItem>
                      <SelectItem value="sla_watcher">SLA Watcher</SelectItem>
                      <SelectItem value="procurement">Procurement</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full" disabled={createConv.isPending} onClick={()=>createConv.mutate()}>Crea</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <div className="flex-1 overflow-y-auto space-y-1">
          {convs.map((c:any)=>(
            <button key={c.id} onClick={()=>setSelected(c.id)}
              className={`w-full rounded-md border p-3 text-left text-sm hover:bg-accent ${selected===c.id?"border-primary bg-accent":""}`}>
              <div className="flex items-center justify-between"><span className="font-medium">{c.title ?? "Senza titolo"}</span>
                {c.agent_type && <Badge variant="outline" className="text-[10px]"><Bot className="mr-1 h-3 w-3"/>{c.agent_type}</Badge>}</div>
              <div className="text-[10px] text-muted-foreground">{new Date(c.updated_at).toLocaleString("it-IT")}</div>
            </button>
          ))}
          {convs.length===0 && <div className="text-center text-xs text-muted-foreground p-4">Nessuna conversazione.</div>}
        </div>
      </div>
      <Card className="overflow-hidden">{selected ? <Chat conversationId={selected} meId={me?.id ?? ""}/> : <div className="grid h-full place-items-center text-sm text-muted-foreground">Seleziona o crea una conversazione</div>}</Card>
    </div>
  );
}

function Chat({ conversationId, meId }: { conversationId: string; meId: string }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const askFn = useServerFn(askAgent);
  const endRef = useRef<HTMLDivElement>(null);
  const { data: conv } = useQuery({ queryKey:["conv", conversationId],
    queryFn: async()=> (await supabase.from("conversations").select("*").eq("id",conversationId).single()).data });
  const { data: msgs = [] } = useQuery({
    queryKey: ["messages", conversationId],
    queryFn: async()=> (await supabase.from("messages").select("*").eq("conversation_id",conversationId).order("created_at")).data ?? [],
  });
  useEffect(()=>{ endRef.current?.scrollIntoView({behavior:"smooth"}); },[msgs]);
  useEffect(()=>{
    const ch = supabase.channel(`conv-${conversationId}`)
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"messages", filter:`conversation_id=eq.${conversationId}` },
        ()=>qc.invalidateQueries({queryKey:["messages", conversationId]}))
      .subscribe();
    return ()=>{ supabase.removeChannel(ch); };
  },[conversationId, qc]);

  const send = useMutation({
    mutationFn: async () => {
      const body = text.trim(); if (!body) return;
      const { error } = await supabase.from("messages").insert({ conversation_id: conversationId, sender_id: meId, body });
      if (error) throw error;
      setText("");
      if (conv?.agent_type) {
        const history = [...(msgs as any[]), { sender_kind:"user", body, sender_id: meId }].map(m=>({
          role: m.sender_kind === "agent" ? "assistant" as const : "user" as const,
          content: m.body,
        }));
        await askFn({ data: { conversationId, agentType: conv.agent_type, messages: history }});
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-4 py-3"><h3 className="font-display font-semibold">{conv?.title ?? "…"}</h3>
        {conv?.agent_type && <div className="text-xs text-muted-foreground flex items-center gap-1"><Bot className="h-3 w-3"/>Agente {conv.agent_type}</div>}
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {(msgs as any[]).map(m=>{
          const mine = m.sender_id === meId;
          const agent = m.sender_kind === "agent";
          return (
            <div key={m.id} className={`flex ${mine?"justify-end":"justify-start"}`}>
              <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${agent ? "bg-secondary text-secondary-foreground" : mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                {agent && <div className="text-[10px] uppercase opacity-70 flex items-center gap-1"><Bot className="h-3 w-3"/>Agente</div>}
                <div className="whitespace-pre-wrap">{m.body}</div>
                <div className="mt-1 text-[10px] opacity-60">{new Date(m.created_at).toLocaleTimeString("it-IT",{hour:"2-digit",minute:"2-digit"})}</div>
              </div>
            </div>
          );
        })}
        <div ref={endRef}/>
      </div>
      <form className="flex gap-2 border-t p-3" onSubmit={(e)=>{e.preventDefault(); send.mutate();}}>
        <Textarea rows={1} placeholder="Scrivi un messaggio…" value={text}
          onChange={(e)=>setText(e.target.value)}
          onKeyDown={(e)=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); send.mutate(); } }}
          className="resize-none"/>
        <Button type="submit" disabled={!text.trim()||send.isPending}><Send className="h-4 w-4"/></Button>
      </form>
    </div>
  );
}