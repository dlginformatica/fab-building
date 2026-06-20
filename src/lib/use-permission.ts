import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

export type DelegationRow = {
  id: string;
  delegate_id: string;
  delegator_id: string;
  structure_id: string | null;
  modules: string[];
  starts_at: string;
  ends_at: string | null;
  active: boolean;
};

const now = () => new Date().toISOString();

function matches(d: DelegationRow, module: string, structureId: string | null) {
  if (!d.active) return false;
  const t = now();
  if (d.starts_at && d.starts_at > t) return false;
  if (d.ends_at && d.ends_at < t) return false;
  if (d.structure_id && structureId && d.structure_id !== structureId) return false;
  if (!d.modules || d.modules.length === 0) return false;
  return d.modules.includes("*") || d.modules.includes(module);
}

/**
 * Returns whether the active user (or any of its delegators) can act on
 * (module, structureId). The hook subscribes to the React Query cache key
 * "delegations:incoming" so any invalidation/setQueryData updates the UI
 * immediately without a page reload.
 */
export function useDelegatedAccess(userId: string | null, module: string, structureId: string | null = null) {
  const { data } = useQuery<DelegationRow[]>({
    queryKey: ["delegations:incoming", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await (supabase as any)
        .from("user_delegations")
        .select("*")
        .eq("delegate_id", userId);
      if (error) throw error;
      return (data ?? []) as DelegationRow[];
    },
  });
  return useMemo(() => {
    const list = data ?? [];
    const enabled = list.some((d) => matches(d, module, structureId));
    return { enabled, delegations: list };
  }, [data, module, structureId]);
}

/**
 * Server-authoritative module access check via has_module_access RPC.
 * Use this to gate UI controls so visibility/abilitazione corrispondono
 * esattamente a ciò che il server consentirà.
 */
export function useModuleAccess(userId: string | null, module: string, structureId: string | null = null) {
  const { data, isLoading } = useQuery<boolean>({
    queryKey: ["module-access", userId, module, structureId],
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("has_module_access", {
        _user: userId, _module: module, _structure: structureId,
      });
      if (error) throw error;
      return !!data;
    },
  });
  return { enabled: !!data, loading: isLoading };
}

/** Returns the list of mandatory dependencies missing from a desired modules[] set. */
export function useMissingDeps(modules: string[]) {
  return useQuery<string[]>({
    queryKey: ["missing-deps", [...modules].sort().join(",")],
    enabled: modules.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("missing_module_deps", { _modules: modules });
      if (error) throw error;
      return (data ?? []) as string[];
    },
  });
}