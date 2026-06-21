import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Restituisce i metadati colonne di una tabella public.
 * Eseguito server-side con privilegi service-role dopo verifica super_admin.
 */
export const getTableColumns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { table: string }) => {
    if (!d?.table || !/^[a-z0-9_]+$/.test(d.table)) throw new Error("Nome tabella non valido");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { data: isSuper, error: roleErr } = await context.supabase
      .rpc("has_role", { _user_id: context.userId, _role: "super_admin" });
    if (roleErr) throw new Error(roleErr.message);
    if (!isSuper) throw new Error("Solo super_admin");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // information_schema.columns via PostgREST non è esposto direttamente;
    // usiamo una query semplice via from() su pg_catalog non disponibile.
    // Strategia: leggiamo la prima riga della tabella e inferiamo le colonne con SELECT *.
    // In più recuperiamo colonne via RPC se disponibile; in mancanza, prima riga.
    const { data: sample, error } = await (supabaseAdmin as any)
      .from(data.table).select("*").limit(1);
    if (error) throw new Error(error.message);
    const row = (sample && sample[0]) || {};
    const columns = Object.keys(row).map((name) => ({
      name,
      type: inferType(row[name]),
      nullable: true,
    }));
    return { columns, hasRows: (sample?.length ?? 0) > 0 };
  });

function inferType(v: unknown): "string" | "number" | "boolean" | "json" | "unknown" {
  if (v === null || v === undefined) return "unknown";
  if (typeof v === "number") return "number";
  if (typeof v === "boolean") return "boolean";
  if (typeof v === "object") return "json";
  return "string";
}