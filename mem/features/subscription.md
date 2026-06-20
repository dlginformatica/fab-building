## Fase 21.1 — Sync robusta, notifiche, audit, trial custom
- `subscription_sync_jobs` traccia ogni run (lock cooperativo `pg_try_advisory_xact_lock`).
- `subscriptions_sync_run(_source,_parent)` sostituisce il vecchio `subscriptions_sync_expired` come ingresso (cron `*/5 * * * *` + manual + retry); emette `admin_alerts` (`trial_ended` / `subscription_expired`) con `billing_url=/app/billing` per owner/admin via `org_memberships`.
- `subscriptions_sync_retry(_job)` (super_admin) rilancia job `failed`/`skipped_locked`.
- `super_admin_set_trial_days(_org,_days,_note)` con validazione 0..3650 gg, audit su `permission_audit` (`action='set_trial_days'`).
- Vista `v_subscription_audit` (security_invoker) → pagina `/app/super-admin/subscription-audit`.
- UI: pannello "Coda & storico sincronizzazioni" + controllo Trial inline in `/app/super-admin/plans`.
---
name: Subscription tiers & trial
description: Piani Small/Medium/Large configurabili dal super admin con trial 30gg Large, gate moduli per tier e read-only post-scadenza
type: feature
---

## Backup, Restore & Import (Fase 21)
- `/app/backup` (admin org) e `/app/super-admin/backup` (super_admin) usano `src/lib/backup.ts` + `BackupPanel` + `ImportWizard`.
- Export: JSON re-importabile, ZIP-di-CSV (JSZip), Excel multi-foglio (SheetJS). Tutto client-side via RLS della sessione.
- Restore: merge (upsert per id) o replace (cancella prima le righe collegate alle strutture dell'org). Snapshot vincolato a `meta.org_id`.
- Import wizard CSV/TXT (papaparse) con 5 step, auto-detect delimitatore, mappatura auto, validazione tipi/required, preview prime 10 righe. Target: assets, suppliers, contracts, inventory_items, meter_readings, tickets.
- Super_admin: bottone "Backup globale (JSON)" che concatena snapshot di tutte le org.
- 3 piani in `subscription_plans` (tier enum small/medium/large): prezzo, max_users, max_structures, trial_days, modules[].
- Ogni nuova organizzazione → `org_subscriptions` con `status='trial'`, `tier='small'`, `trial_ends_at=now()+trial_days` ma `org_effective_tier` ritorna 'large' durante il trial.
- `has_module_access` filtra per moduli inclusi nel tier effettivo (super_admin sempre passa).
- Read-only post-scadenza: `org_can_write` + UI banner + `useCanWrite()`; super_admin sempre scrive.
- Downgrade: dati conservati, moduli completamente nascosti dalla sidebar (filtro client + RLS server).
- Super admin: `/app/super-admin/plans` configura prezzi/limiti/moduli con validazione dipendenze via `plan_validate_modules`.
- Org admin: `/app/billing` vede stato e confronto piani (pagamenti manuali in Fase 1, Stripe in Fase 2).
- info@dlginformatica.it = super_admin globale (trigger `handle_new_user`).