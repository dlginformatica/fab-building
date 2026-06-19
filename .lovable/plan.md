## Piano Fase 8 — Consolidamento operativo

Cinque moduli, li costruisco in sequenza in 5 step così rimangono testabili. Documenti (`REQUISITI_FUNZIONALI.md`, `REQUISITI_NON_FUNZIONALI.md`, `MANUALE_OPERATIVO.md`, `SCHEMA_DB.md`) aggiornati ad ogni step come da regola.

### 8.1 — Modulo Contratti completo
- Estensione tabella `contracts` (auto-renewal, notice_period_days, renewal_terms, next_review_at, attachments_count) + nuova `contract_attachments` (file su bucket privato `contracts`) + `contract_renewals` (storico rinnovi).
- Pagina `/app/contracts`: lista filtrabile (stato, fornitore, struttura, scadenza), dettaglio con timeline rinnovi, upload allegati, scadenzario (KPI prossime scadenze 30/60/90 gg).
- Trigger `pg_cron` giornaliero che alimenta `notification_log` via `dispatchNotification` per contratti in scadenza entro `notice_period_days`.

### 8.2 — Gestione SLA guidata
- Wizard `/app/sla` per definire regole (priorità → soglie ack/risoluzione, escalation chain multi-livello con ritardi).
- Tabelle nuove: `sla_escalation_rules` (rule_id, level, after_minutes, notify_role/user/channel), `sla_compliance_snapshots` (mensile per struttura).
- Cron orario che valuta `sla_notifications` e dispatcha escalation ai canali configurati.
- Pagina **Report Conformità**: % SLA rispettati per periodo, breakdown per categoria/priorità, export CSV/PDF.

### 8.3 — Asset avanzato
- Nuove tabelle: `asset_history` (audit field-level via trigger), `asset_maintenance_log` (vista materializzata su `maintenance_tasks` + interventi su ticket collegati).
- Dettaglio asset esteso: tab **Storico**, tab **Documenti** (riusa `asset_documents`), tab **Manutenzioni** (timeline interventi pianificati + correttivi con costi).
- Indicatore MTBF/MTTR per asset.

### 8.4 — PWA offline + sync
- Service worker via `vite-plugin-pwa` (Workbox `generateSW`) con guardie preview Lovable da skill PWA.
- IndexedDB locale (`idb`) con outbox per: creazione/aggiornamento ticket, scansioni QR asset, foto allegate.
- Hook `useOfflineSync` che monitora `navigator.onLine` e drena l'outbox alle server functions; UI badge "offline / N elementi in coda".
- Cache `NetworkFirst` per navigazioni, `CacheFirst` per asset hashed, runtime cache per liste asset/ticket dell'utente.

### 8.5 — Dashboard KPI per struttura
- Pagina `/app/dashboard` con selettore struttura. KPI cards: ticket aperti per stato, SLA compliance 30gg, ticket in ritardo, contratti in scadenza 90gg, top 5 fornitori per rating + tempo medio risposta, consumi utility trend.
- Charts (recharts): andamento ticket settimanale, distribuzione per categoria, mix correttive/preventive.
- Server functions read-only con `requireSupabaseAuth` + filtro `has_structure_access`.

### Trasversali
- Documentazione: ogni step aggiorna i 4 file `docs/*.md` con changelog datato in testa.
- Test manuale guidato a fine 8.5 con checklist (login per ruolo, ticket end-to-end, OCR fattura, notifica Teams, offline+sync, dashboard).
- Audit coerenza UI: revisione Sidebar, breadcrumb, permessi per ruolo (super_admin / direttore / facility_manager / manutentore / fornitore / economato / viewer).

### Note tecniche
- Tutte le nuove tabelle: `GRANT` + RLS + policy `has_structure_access` o `is_admin`.
- Notifiche riusano `dispatchNotification` (Fase 7.4) — niente nuovi canali, solo nuovi eventi enum: `contract_expiring`, `sla_escalation_l1/l2/l3`, `compliance_report_ready`.
- Cron jobs via `pg_cron` + `pg_net` verso `/api/public/hooks/...` con `apikey` anon (pattern standard).

Procedo step 8.1 → 8.5 in chiamate separate, oppure dimmi se vuoi cambiare ordine / saltare uno step.