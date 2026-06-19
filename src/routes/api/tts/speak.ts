import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/tts/speak")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Require authenticated Supabase session to prevent unauthenticated
        // consumption of AI gateway credits.
        const authHeader = request.headers.get("authorization") ?? "";
        const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
        if (!token) return new Response("Unauthorized", { status: 401 });
        try {
          const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
            auth: { persistSession: false, autoRefreshToken: false },
            global: { headers: { Authorization: `Bearer ${token}` } },
          });
          const { data, error } = await sb.auth.getUser(token);
          if (error || !data.user) return new Response("Unauthorized", { status: 401 });
        } catch {
          return new Response("Unauthorized", { status: 401 });
        }
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });
        let body: { text?: string; voice?: string };
        try { body = await request.json(); } catch { return new Response("Bad JSON", { status: 400 }); }
        const text = (body.text ?? "").trim();
        if (!text) return new Response("Missing text", { status: 400 });
        const voice = body.voice ?? "alloy";
        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "openai/gpt-4o-mini-tts",
            input: text,
            voice,
            stream_format: "sse",
            response_format: "pcm",
          }),
        });
        if (!upstream.ok) {
          const txt = await upstream.text().catch(() => "");
          return new Response(`TTS upstream ${upstream.status}: ${txt}`, { status: upstream.status });
        }
        return new Response(upstream.body, {
          headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
        });
      },
    },
  },
});