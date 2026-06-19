import { openDB, type IDBPDatabase } from "idb";
import { supabase } from "@/integrations/supabase/client";

export type OutboxEntry = {
  id?: number;
  kind: "ticket" | "asset_scan" | "ticket_comment";
  payload: Record<string, unknown>;
  created_at: number;
  attempts: number;
  last_error?: string;
};

const DB_NAME = "hotelops-offline";
const DB_VER = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;
function db() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VER, {
      upgrade(d) {
        if (!d.objectStoreNames.contains("outbox")) {
          d.createObjectStore("outbox", { keyPath: "id", autoIncrement: true });
        }
        if (!d.objectStoreNames.contains("cache")) {
          d.createObjectStore("cache");
        }
      },
    });
  }
  return dbPromise;
}

export async function enqueue(entry: Omit<OutboxEntry, "id" | "created_at" | "attempts">) {
  const d = await db();
  await d.add("outbox", { ...entry, created_at: Date.now(), attempts: 0 } as OutboxEntry);
  notifyListeners();
}

export async function listOutbox(): Promise<OutboxEntry[]> {
  return (await db()).getAll("outbox");
}

export async function clearEntry(id: number) {
  await (await db()).delete("outbox", id);
  notifyListeners();
}

export async function cachePut<T>(key: string, value: T) {
  await (await db()).put("cache", value as unknown, key);
}
export async function cacheGet<T>(key: string): Promise<T | undefined> {
  return (await db()).get("cache", key) as Promise<T | undefined>;
}

const listeners = new Set<() => void>();
export function subscribe(fn: () => void) { listeners.add(fn); return () => listeners.delete(fn); }
function notifyListeners() { listeners.forEach(l => l()); }

async function flushOne(entry: OutboxEntry): Promise<boolean> {
  try {
    if (entry.kind === "ticket") {
      const { error } = await supabase.from("tickets").insert(entry.payload as never);
      if (error) throw error;
    } else if (entry.kind === "ticket_comment") {
      const { error } = await supabase.from("ticket_comments").insert(entry.payload as never);
      if (error) throw error;
    } else if (entry.kind === "asset_scan") {
      const { error } = await supabase.from("asset_scans").insert(entry.payload as never);
      if (error) throw error;
    }
    return true;
  } catch (e: any) {
    const d = await db();
    await d.put("outbox", { ...entry, attempts: entry.attempts + 1, last_error: e?.message ?? String(e) });
    return false;
  }
}

let flushing = false;
export async function flushOutbox(): Promise<{ ok: number; fail: number }> {
  if (flushing) return { ok: 0, fail: 0 };
  flushing = true;
  let ok = 0, fail = 0;
  try {
    const items = await listOutbox();
    for (const it of items) {
      const success = await flushOne(it);
      if (success && it.id != null) { await (await db()).delete("outbox", it.id); ok++; }
      else fail++;
    }
    if (ok > 0) notifyListeners();
  } finally {
    flushing = false;
  }
  return { ok, fail };
}