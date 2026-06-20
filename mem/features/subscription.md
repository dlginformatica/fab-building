---
name: Subscription tiers & trial
description: Piani Small/Medium/Large configurabili dal super admin con trial 30gg Large, gate moduli per tier e read-only post-scadenza
type: feature
---
- 3 piani in `subscription_plans` (tier enum small/medium/large): prezzo, max_users, max_structures, trial_days, modules[].
- Ogni nuova organizzazione → `org_subscriptions` con `status='trial'`, `tier='small'`, `trial_ends_at=now()+trial_days` ma `org_effective_tier` ritorna 'large' durante il trial.
- `has_module_access` filtra per moduli inclusi nel tier effettivo (super_admin sempre passa).
- Read-only post-scadenza: `org_can_write` + UI banner + `useCanWrite()`; super_admin sempre scrive.
- Downgrade: dati conservati, moduli completamente nascosti dalla sidebar (filtro client + RLS server).
- Super admin: `/app/super-admin/plans` configura prezzi/limiti/moduli con validazione dipendenze via `plan_validate_modules`.
- Org admin: `/app/billing` vede stato e confronto piani (pagamenti manuali in Fase 1, Stripe in Fase 2).
- info@dlginformatica.it = super_admin globale (trigger `handle_new_user`).