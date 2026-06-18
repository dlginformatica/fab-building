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