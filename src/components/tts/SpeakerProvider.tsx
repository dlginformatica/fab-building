import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

type Voice = "alloy" | "ash" | "ballad" | "coral" | "echo" | "sage" | "shimmer" | "verse" | "marin" | "cedar";

type Ctx = {
  enabled: boolean;
  setEnabled: (b: boolean) => void;
  voice: Voice;
  setVoice: (v: Voice) => void;
  volume: number;
  setVolume: (n: number) => void;
  speak: (text: string) => Promise<void>;
  isSpeaking: boolean;
};
const C = createContext<Ctx | null>(null);
export const useSpeaker = () => {
  const v = useContext(C);
  if (!v) throw new Error("useSpeaker outside SpeakerProvider");
  return v;
};

const ENABLED_KEY = "hotelops.tts.enabled";
const VOICE_KEY = "hotelops.tts.voice";
const VOL_KEY = "hotelops.tts.volume";

export function SpeakerProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState(false);
  const [voice, setVoiceState] = useState<Voice>("alloy");
  const [volume, setVolumeState] = useState(0.9);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const ctxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const announcedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window === "undefined") return;
    setEnabledState(localStorage.getItem(ENABLED_KEY) === "1");
    const v = localStorage.getItem(VOICE_KEY) as Voice | null;
    if (v) setVoiceState(v);
    const vol = localStorage.getItem(VOL_KEY);
    if (vol) setVolumeState(parseFloat(vol));
  }, []);

  const setEnabled = (b: boolean) => { setEnabledState(b); if (typeof window !== "undefined") localStorage.setItem(ENABLED_KEY, b ? "1" : "0"); };
  const setVoice = (v: Voice) => { setVoiceState(v); if (typeof window !== "undefined") localStorage.setItem(VOICE_KEY, v); };
  const setVolume = (n: number) => { setVolumeState(n); if (typeof window !== "undefined") localStorage.setItem(VOL_KEY, String(n)); if (gainRef.current) gainRef.current.gain.value = n; };

  const ensureCtx = useCallback(async () => {
    if (!ctxRef.current) {
      const Ctor = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
      ctxRef.current = new Ctor({ sampleRate: 24000 });
      gainRef.current = ctxRef.current.createGain();
      gainRef.current.gain.value = volume;
      gainRef.current.connect(ctxRef.current.destination);
    }
    if (ctxRef.current.state === "suspended") await ctxRef.current.resume().catch(() => {});
    return ctxRef.current;
  }, [volume]);

  const speak = useCallback(async (text: string) => {
    const job = queueRef.current.then(async () => {
      setIsSpeaking(true);
      try {
        const ctx = await ensureCtx();
        const { supabase } = await import("@/integrations/supabase/client");
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error("TTS: utente non autenticato");
        const res = await fetch("/api/tts/speak", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ text, voice }),
        });
        if (!res.ok || !res.body) throw new Error(`TTS ${res.status}`);
        let playhead = 0;
        let pending = new Uint8Array(0);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        const playChunk = (incoming: Uint8Array) => {
          const bytes = new Uint8Array(pending.length + incoming.length);
          bytes.set(pending); bytes.set(incoming, pending.length);
          const usable = bytes.length - (bytes.length % 2);
          pending = bytes.slice(usable);
          if (usable === 0) return;
          const samples = new Int16Array(bytes.buffer, 0, usable / 2);
          const floats = Float32Array.from(samples, (s) => s / 32768);
          const buf = ctx.createBuffer(1, floats.length, 24000);
          buf.copyToChannel(floats, 0);
          const src = ctx.createBufferSource();
          src.buffer = buf;
          src.connect(gainRef.current!);
          if (playhead === 0) playhead = ctx.currentTime + 0.05;
          else playhead = Math.max(playhead, ctx.currentTime);
          src.start(playhead);
          playhead += buf.duration;
        };
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";
          for (const e of events) {
            const line = e.split("\n").find((l) => l.startsWith("data:"));
            if (!line) continue;
            const data = line.slice(5).trim();
            if (!data) continue;
            try {
              const obj = JSON.parse(data);
              if (obj.type === "speech.audio.delta" && obj.audio) {
                const bin = atob(obj.audio);
                const arr = new Uint8Array(bin.length);
                for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
                playChunk(arr);
              }
            } catch { /* ignore */ }
          }
        }
        const tailMs = Math.max(0, (playhead - ctx.currentTime) * 1000);
        await new Promise((r) => setTimeout(r, tailMs));
      } finally {
        setIsSpeaking(false);
      }
    }).catch((e) => { console.error("TTS error", e); setIsSpeaking(false); });
    queueRef.current = job;
    return job;
  }, [ensureCtx, voice]);

  // Realtime: ascolta nuovi ticket critici e annunci SLA
  useEffect(() => {
    if (!enabled) return;
    const channel = supabase
      .channel("tts-tickets")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "tickets" }, async (payload) => {
        const t = payload.new as { id: string; priority: string; title: string; tts_announced: boolean; ticket_number?: number };
        if (t.priority === "critica" && !announcedRef.current.has(t.id) && !t.tts_announced) {
          announcedRef.current.add(t.id);
          await speak(`Attenzione. Nuovo ticket critico numero ${t.ticket_number ?? ""}. ${t.title}.`);
          await supabase.from("tickets").update({ tts_announced: true }).eq("id", t.id);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [enabled, speak]);

  const value = useMemo(() => ({ enabled, setEnabled, voice, setVoice, volume, setVolume, speak, isSpeaking }),
    [enabled, voice, volume, isSpeaking, speak]);

  return <C.Provider value={value}>{children}</C.Provider>;
}