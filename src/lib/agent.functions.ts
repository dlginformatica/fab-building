import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SYSTEM = `Sei un assistente AI multi-ruolo per HotelOps, sistema di facility management alberghiero.
Ruoli possibili: "concierge" (supporto tecnico operatori), "sla_watcher" (monitora SLA), "procurement" (acquisti/fornitori).
Rispondi in italiano, conciso, pratico. Quando opportuno suggerisci l'apertura di un ticket o l'attivazione di un fornitore.`;

export const askAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { conversationId: string; agentType: string; messages: Array<{role:"user"|"assistant"|"system",content:string}> }) => d)
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY mancante");
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: `${SYSTEM}\nRuolo attivo: ${data.agentType}.` },
          ...data.messages,
        ],
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`AI gateway: ${res.status} ${t.slice(0,200)}`);
    }
    const json: any = await res.json();
    const reply = json.choices?.[0]?.message?.content ?? "(nessuna risposta)";
    const { error } = await context.supabase.from("messages").insert({
      conversation_id: data.conversationId,
      sender_kind: "agent",
      body: reply,
      agent_meta: { agent_type: data.agentType, model: "google/gemini-2.5-flash" },
    });
    if (error) throw new Error(error.message);
    return { reply };
  });