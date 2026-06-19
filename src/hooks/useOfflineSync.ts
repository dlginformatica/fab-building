import { useEffect, useState } from "react";
import { flushOutbox, listOutbox, subscribe, type OutboxEntry } from "@/lib/pwa/outbox";

export function useOfflineSync() {
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const [queue, setQueue] = useState<OutboxEntry[]>([]);

  const refresh = () => { listOutbox().then(setQueue).catch(() => {}); };

  useEffect(() => {
    refresh();
    const unsub = subscribe(refresh);
    const on = () => { setOnline(true); flushOutbox().finally(refresh); };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { unsub(); window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  return { online, queue, flush: async () => { const r = await flushOutbox(); refresh(); return r; } };
}