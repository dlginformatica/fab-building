import { supabase } from "@/integrations/supabase/client";

/** Records a denied access attempt with full reason and missing deps, so it appears in Smart Inbox. */
export async function logAccessDenied(params: { module: string; structureId?: string | null; path?: string }) {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) return;
  const { data: ex } = await (supabase as any).rpc("explain_module_access", {
    _user: user.id, _module: params.module, _structure: params.structureId ?? null,
  });
  if (ex?.enabled) return;
  await (supabase as any).from("access_denied_log").insert({
    user_id: user.id,
    module: params.module,
    structure_id: params.structureId ?? null,
    reason: ex?.reason ?? "other",
    missing_deps: ex?.missing_deps ?? [],
    path: params.path ?? (typeof window !== "undefined" ? window.location.pathname : null),
  });
  return ex;
}