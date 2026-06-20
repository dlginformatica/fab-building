import { useEffect, useState } from "react";
import { flushOutbox, listOutbox, subscribe, type OutboxEntry } from "@/lib/pwa/outbox";

const PROBE_URL = "/favicon.ico";
const PROBE_INTERVAL_MS = 20_000;

async function probeOnline(): Promise<boolean> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 4000);
    const res = await fetch(`${PROBE_URL}?_=${Date.now()}`, {
      method: "HEAD",
      cache: "no-store",
      signal: ctl.signal,
    });
    clearTimeout(t);
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}

export function useOfflineSync() {
  // Default optimistic: many embedded iframes report navigator.onLine === false
  // even when network is fine. We confirm with a real probe before flipping offline.
  const [online, setOnline] = useState(true);
  const [queue, setQueue] = useState<OutboxEntry[]>([]);

  const refresh = () => { listOutbox().then(setQueue).catch(() => {}); };

  useEffect(() => {
    refresh();
    const unsub = subscribe(refresh);
    let cancelled = false;
    const verify = async () => {
      const ok = await probeOnline();
      if (cancelled) return;
      setOnline((prev) => {
        if (ok && !prev) flushOutbox().finally(refresh);
        return ok;
      });
    };
    // Initial verification + periodic poll
    verify();
    const interval = setInterval(verify, PROBE_INTERVAL_MS);
    const on = () => { verify(); };
    const off = () => { verify(); };
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      cancelled = true;
      clearInterval(interval);
      unsub();
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  return { online, queue, flush: async () => { const r = await flushOutbox(); refresh(); return r; } };
}