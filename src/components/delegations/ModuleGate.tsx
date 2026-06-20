import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { useModuleAccess } from "@/lib/use-permission";
import { logAccessDenied } from "@/lib/access-denied";

/**
 * Server-authoritative gate: wraps a control and disables it when the
 * has_module_access RPC says the user cannot access (module, structure).
 * Uses the same SECURITY DEFINER check the backend enforces, so UI and
 * server stay in sync (no false-positive buttons).
 */
export function ModuleGate({
  userId, module, structureId = null, children, fallbackLabel = "Non autorizzato",
}: {
  userId: string | null;
  module: string;
  structureId?: string | null;
  children: (props: { disabled: boolean; loading: boolean }) => ReactNode;
  fallbackLabel?: string;
}) {
  const { enabled, loading } = useModuleAccess(userId, module, structureId);
  const logged = useRef(false);
  useEffect(() => {
    if (loading || enabled || logged.current || !userId) return;
    logged.current = true;
    logAccessDenied({ module, structureId }).catch(() => {});
  }, [enabled, loading, userId, module, structureId]);
  return (
    <div
      data-testid={`module-gate-${module}`}
      data-enabled={enabled ? "true" : "false"}
      aria-label={enabled ? "abilitato" : fallbackLabel}
    >
      {children({ disabled: !enabled, loading })}
    </div>
  );
}