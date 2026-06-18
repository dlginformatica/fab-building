import type { ReactNode } from "react";
import { useDelegatedAccess } from "@/lib/use-permission";

/**
 * Wraps a control (button, link, form) and disables it in real time when
 * the matching delegation is missing/revoked/expired. Used by tests and pages
 * to guarantee immediate UI reactivity on grant/revoke.
 */
export function DelegationGate({
  userId, module, structureId = null, children, fallbackLabel = "Non autorizzato",
}: {
  userId: string | null;
  module: string;
  structureId?: string | null;
  children: (props: { disabled: boolean }) => ReactNode;
  fallbackLabel?: string;
}) {
  const { enabled } = useDelegatedAccess(userId, module, structureId);
  return (
    <div data-testid={`gate-${module}`} data-enabled={enabled ? "true" : "false"} aria-label={enabled ? "abilitato" : fallbackLabel}>
      {children({ disabled: !enabled })}
    </div>
  );
}