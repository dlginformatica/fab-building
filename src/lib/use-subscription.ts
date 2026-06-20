import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Tier = "small" | "medium" | "large";
export type SubStatus = "trial" | "active" | "expired" | "readonly" | "cancelled";

export interface PlanRow {
  id: string; tier: Tier; name: string; description: string | null;
  price_monthly_eur: number; price_yearly_eur: number | null;
  max_users: number; max_structures: number; trial_days: number;
  modules: string[]; features_highlight: string[]; sort_order: number; active: boolean;
}

export interface OrgSubRow {
  id: string; org_id: string; tier: Tier; status: SubStatus;
  trial_started_at: string; trial_ends_at: string;
  current_period_start: string | null; current_period_end: string | null;
  manual_payment_ref: string | null; manual_payment_notes: string | null;
}

export function usePlans() {
  return useQuery<PlanRow[]>({
    queryKey: ["subscription_plans"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("subscription_plans").select("*").order("sort_order");
      if (error) throw error;
      return (data ?? []) as PlanRow[];
    },
  });
}

/** Subscription of the active user's organization (single row) + effective tier/status. */
export function useMySubscription() {
  return useQuery({
    queryKey: ["my-subscription"],
    queryFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) return null;
      const { data: prof } = await (supabase as any).from("profiles").select("organization_id").eq("id", uid).maybeSingle();
      const orgId = prof?.organization_id;
      if (!orgId) return null;
      const { data: sub } = await (supabase as any).from("org_subscriptions").select("*").eq("org_id", orgId).maybeSingle();
      const now = Date.now();
      let effectiveTier: Tier | null = null;
      let effectiveStatus: SubStatus = "readonly";
      if (sub) {
        const trialEnd = sub.trial_ends_at ? new Date(sub.trial_ends_at).getTime() : 0;
        const periodEnd = sub.current_period_end ? new Date(sub.current_period_end).getTime() : Infinity;
        if (sub.status === "trial" && trialEnd > now) { effectiveTier = "large"; effectiveStatus = "trial"; }
        else if (sub.status === "active" && periodEnd > now) { effectiveTier = sub.tier; effectiveStatus = "active"; }
        else effectiveStatus = "readonly";
      }
      const { data: plan } = effectiveTier
        ? await (supabase as any).from("subscription_plans").select("*").eq("tier", effectiveTier).maybeSingle()
        : { data: null };
      const trialDaysLeft = sub?.trial_ends_at
        ? Math.max(0, Math.ceil((new Date(sub.trial_ends_at).getTime() - now) / 86400000)) : 0;
      return { sub: sub as OrgSubRow | null, effectiveTier, effectiveStatus, plan: plan as PlanRow | null, trialDaysLeft, orgId };
    },
  });
}

/** True if module is included in the user's effective plan (super_admin always true). */
export function useModuleEnabledForTier(moduleKey: string) {
  const { data } = useMySubscription();
  const { data: isSuper } = useIsSuperAdmin();
  if (isSuper) return true;
  if (!data?.plan) return false;
  return data.plan.modules.includes(moduleKey);
}

export function useIsSuperAdmin() {
  return useQuery<boolean>({
    queryKey: ["is-super-admin"],
    queryFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) return false;
      const { data } = await (supabase as any).rpc("has_role", { _user_id: uid, _role: "super_admin" });
      return !!data;
    },
  });
}

export function useCanWrite(): boolean {
  const { data } = useMySubscription();
  const { data: isSuper } = useIsSuperAdmin();
  if (isSuper) return true;
  return data?.effectiveStatus === "trial" || data?.effectiveStatus === "active";
}