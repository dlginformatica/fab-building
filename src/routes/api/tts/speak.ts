import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/tts/speak")({
  server: {
    handlers: {
      POST: async ({ request }) => {
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