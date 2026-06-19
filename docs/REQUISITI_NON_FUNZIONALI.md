# HotelOps — Requisiti Non Funzionali

> Documento vivo: aggiornato a ogni interazione con l'utente.

## Changelog

### 2026-06-19 — Fase 8.5
- RNF-DASH-01 KPI calcolati da funzioni `dashboard_*` SECURITY DEFINER con `has_structure_access(auth.uid(), structure_id)` — nessuna struttura altrui visibile.
- RNF-DASH-02 Una sola query per blocco (kpi, weekly, top suppliers, by category) — preview perf accettabile su >10k ticket.

### 2026-06-19 — Fase 8.4
- RNF-PWA-01 Service worker generato da `vite-plugin-pwa` (Workbox) con `injectRegister: null` — registrazione solo dal wrapper guardato `src/lib/pwa/register.ts`.
- RNF-PWA-02 Nessuna registrazione in dev, iframe, host Lovable preview, beta o quando `?sw=off`. In quei contesti viene fatto `unregister()` dei SW esistenti.
- RNF-PWA-03 `navigateFallbackDenylist` esclude `/~oauth` e `/api/*` dal fallback offline (callback OAuth e hook server-side non vengono dirottati).
- RNF-PWA-04 Outbox IndexedDB con retry per voce; nessun dato sensibile esce dal device finché non torna online (RLS applicate al flush).

### 2026-06-19 — Fase 8.3
- RNF-AUDIT-04 Storico asset alimentato da trigger DB `tg_asset_history` (SECURITY DEFINER, search_path fissato) — non bypassabile da scritture client.
- RNF-RBAC-09 Lettura `asset_history` e funzioni `asset_maintenance_log` / `asset_maintenance_kpi` filtrate via `has_structure_access(auth.uid(), structure_id)`.

### 2026-06-19 — Fase 8.2 SLA
- `sla_compliance_report` SECURITY DEFINER, `EXECUTE` revocato ad anon e filtrato internamente da `has_structure_access(auth.uid(),...)` per evitare leak di ticket di strutture non accessibili.
- `sla_pending_escalations` SECURITY DEFINER, `EXECUTE` revocato ad anon e authenticated (solo service role via cron).
- Indici `idx_sla_escalation_rule (sla_rule_id, level)` e `idx_sla_escalation_struct (structure_id)` per dispatch O(rules × violations) → O(matched).
- Unicità `(sla_rule_id, level)` su `sla_escalation_rules` per prevenire dupliciti L1 multipli sulla stessa regola.
- Cron orario `/api/public/hooks/sla-escalations` autenticato con `SCHEDULER_SECRET`; aggiorna `last_escalation_level` per evitare riemissioni.

### 2026-06-19 — Fase 8.1 Contratti
- Allegati contratti su bucket privato Supabase Storage `contracts`; accesso solo via URL firmati (300 s) e RLS che incrocia `storage_path` con `contract_attachments.structure_id`.
- Trigger `tg_contract_attachments_count` e `tg_contract_apply_renewal` SECURITY DEFINER con search_path bloccato a `public`.
- Funzione `contracts_due_for_notice` con EXECUTE revocato ad anon/authenticated (callable solo dal cron via service role).
- Cron giornaliero (08:00) invoca `/api/public/hooks/contracts-notify` autenticato con `SCHEDULER_SECRET`; idempotenza basata su `last_notified_at` (finestra 24 h).
- Indice parziale `idx_contracts_expiry` su `end_date WHERE status='attivo'` per scadenziario.

### 2026-06-19 — Fase 7.4
- Notifiche outbound: chiamate HTTP POST verso webhook Teams con timeout breve; errori loggati in `notification_log` (status=error) senza bloccare il flusso applicativo.
- Email: integrazione opzionale con Lovable Emails (queue + retry gestiti dall'infrastruttura email Lovable quando attivata).
- Sicurezza: webhook Teams trattati come segreti operativi — visibili solo agli admin di struttura (RLS).

### 2026-06-19 — Fase 7.3 OCR fatture + scadenzario
- Server function extractInvoice (createServerFn protetta da requireSupabaseAuth) che invia PDF/immagine a Lovable AI Gateway (google/gemini-2.5-flash) con response_format json_object e prompt strutturato.
- Estrazione automatica: fornitore, P.IVA, IBAN, numero fattura, date emissione/scadenza, imponibile, IVA, totale, valuta, tipo utenza, righe di dettaglio, note.
- UI: in /app/invoices nuova sezione OCR nel dialog "Nuova fattura" — upload + bottone "Estrai dati dal file" che pre-compila il form; gli ocr_data vengono salvati nel campo JSONB della fattura.
- Matching automatico fornitore best-effort per nome (prima parola); l'utente conferma sempre prima di salvare.
- Nuovo tab "Scadenzario" con KPI (totale 30gg + scadute, scadute, in scadenza) e tabella ordinata per data, evidenziando in rosso le scadute.
- Errori AI gestiti: 429 (rate limit) e 402 (crediti esauriti) mostrati come toast.


### 2026-06-19 — Fase 7.2 Workflow Engine
- Nuove tabelle: workflows, workflow_steps, workflow_instances, workflow_transitions (append-only).
- Editor procedure multi-step con tipi: approval, action, notification, wait, condition, form.
- Assegnatario per ruolo/utente, SLA per step in minuti, escalation su timeout (config).
- Istanze collegabili a ticket/asset/fornitore/fattura; transizioni con outcome (approved, rejected, completed, skipped, timeout, escalated, cancelled).
- RLS scoped per struttura; admin (super_admin/direttore/facility_manager) gestiscono definizioni; membri struttura avviano/avanzano istanze.
- Audit automatico via tg_audit_log su workflows e workflow_instances.
- UI: /app/workflows con tabs Procedure / Esecuzioni, editor step inline, dialog di avanzamento.


### 2026-06-19 — Fase 7.1
- Indici su `maintenance_tasks(due_date, plan_id, assigned_to, status)` per performance calendario/storico.
- Trigger `updated_at` su `maintenance_tasks`.
- Storage foto intervento nel bucket privato `assets/` sotto prefisso `maintenance/<task_id>/`.

- **v0.16 (2026-06-19)** — Tabella `sla_notifications` con UNIQUE su `(ticket_id, kind)` per garantire idempotenza (un solo warning + una sola notifica di violazione per ticket); INSERT revocata agli utenti `authenticated`, alimentata solo da trigger SECURITY DEFINER (`tg_sla_violation_notify`) e dalla funzione `enqueue_sla_warnings(threshold)` (EXECUTE solo a `service_role`). Job `pg_cron` `sla-warnings-enqueue` ogni 5 minuti. Nuovi bucket privati `asset-docs` e `asset-media` con policy `storage.objects` scoped su `(storage.foldername(name))[1] = structure_id` e verifica ownership su update/delete. Tabelle `asset_documents` e `asset_media` con RLS scoped per struttura, INSERT vincolato a `uploaded_by = auth.uid()`, UPDATE/DELETE riservato all'uploader o agli admin. Trigger di ereditarietà `structure_id` da asset per evitare desincronizzazioni.
- **v0.15 (2026-06-19)** — Trigger `tg_log_reorder_status` (SECURITY DEFINER) garantisce auditabilità completa dei cambi stato riordini senza dipendere dal client. Trigger `tg_inherit_area_from_asset` esteso a `tickets` e `work_orders` per mantenere coerenza area in pipeline analitica. Bucket `reorders` privato con RLS basata su `storage.foldername(name)[1] = structure_id`. Tabella `asset_qr_audit` immutabile via RLS (solo SELECT per i membri della struttura), inserimenti via trigger SECURITY DEFINER. SLA: la `apply_sla_on_ticket` ordina per specificità (struttura → area → categoria) per garantire risoluzione deterministica delle regole.
- **v0.12 (2026-06-18)** — Nuovo bucket privato `report-previews` (RLS sotto-cartella per `auth.uid()`). Tabelle: `report_pdf_previews` (anteprime con scadenza 24h, RLS owner), `report_template_access` (permessi per template, helper `can_manage_template`), `report_template_layout_audit` + trigger `tg_report_layout_audit` che cattura diff su header/footer/firma/QR/sotto-intestazione e su `recipient_layouts`. Scheduler hook ora richiede header `Authorization: Bearer <SCHEDULER_SECRET|anon|service>` o `apikey`, e applica allowlist `ALLOWED_SOURCES` per impedire l'esfiltrazione di tabelle sensibili via service role.
- **v0.11 (2026-06-18)** — Nuove tabelle: `report_delivery_queue` (coda PDF con retry/back-off e DLQ), `delegation_audit` (trigger AFTER INSERT/UPDATE/DELETE su `user_delegations` con autore via `auth.uid()`). Estese: `report_templates.recipient_layouts/timezone/max_retries/retry_backoff_minutes`, `scheduled_report_runs.attempts/next_retry_at/last_error_at/recipient_logs/triggered_by`, `structures.timezone`. RLS: coda visibile solo agli admin, audit deleghe visibile a super_admin/direzione e ai soggetti coinvolti. Lo scheduler hook ora separa enqueue (creazione delivery row per destinatario con override layout) e processing (RPC `enqueue_email` con back-off esponenziale `15 min × tentativo` e passaggio a DLQ).
- **2026-06-18** — v0.10: aggiunte colonne `recipients text[]`, `next_run_at timestamptz`, `pdf_layout jsonb` su `report_templates`; nuova tabella `scheduled_report_runs` (RLS riservata agli admin via `is_admin`). Server route pubblica `/api/public/hooks/report-scheduler` con service role per esecuzione cron + invio email best-effort (queue `transactional_emails` se l'infrastruttura email è configurata). Suite di test `vitest` (`bun run test`) con jsdom + @testing-library/react: `DelegationGate.test.tsx` verifica reattività UI sulle deleghe per modulo/funzione/struttura.
- **2026-06-18** — v0.9: nuovi campi su `report_templates` (`layout` jsonb, `schedule_cron`, `last_run_at`, `last_export_url`). Funzione trigger `tg_audit_log` (SECURITY DEFINER, search_path bloccato) collegata in AFTER INSERT/UPDATE/DELETE su `sla_rules`, `penalty_rules`, `module_permissions`, `user_delegations`, `report_templates`, `sla_violations`, `invoices`. RLS `audit_log` allargata per accettare insert da trigger (user_id = auth.uid() o NULL). Onboarding utenti via `signInWithOtp` (magic link) e reset password via `resetPasswordForEmail` con redirect a `/auth`.
- **2026-06-18** — v0.8: aggiunte tabelle `module_permissions`, `user_delegations`, `penalty_rules`, `sla_violations`, `report_templates`. Funzione `has_permission` (SECURITY DEFINER). Trigger `compute_sla_violation` calcola automaticamente ritardo e penale alla risoluzione del ticket. RLS su tutte le nuove tabelle scopata per struttura/utente.
- **2026-06-18** — v0.7.1: aggiunto bootstrap automatico ruolo `super_admin` su email `info@dlginformatica.it` via trigger `handle_new_user` (SECURITY DEFINER, search_path bloccato). Nessuna credenziale hardcoded nel codice client.
- **2026-06-18** — v0.7: aggiunte tabelle `ticket_attachments`, `ticket_reports`, `videocall_rooms`, `dashboard_widgets` con RLS. Storage policies su bucket `tickets` (SELECT/INSERT autenticati, DELETE solo owner). Realtime attivata. Videocall via Jitsi Meet pubblico (room name random, nessuna chiave API).
- **2026-06-18** — v0.6: estesa copertura per Fasi 2-6 (RLS su tutte le nuove tabelle, Realtime su `messages`/`conversations`, server fn `askAgent` autenticata via `requireSupabaseAuth`, Google Fonts CDN al posto di `@fontsource` per evitare dipendenze non installate).
- **2026-06-18** — v0.1: inizializzazione documento.

## 1. Architettura
- **Frontend**: TanStack Start v1 (React 19, Vite 7), Tailwind v4, shadcn/ui.
- **Backend**: Lovable Cloud (PostgreSQL + Auth + Storage + Server Functions Cloudflare Workers).
- **AI**: Lovable AI Gateway (TTS `openai/gpt-4o-mini-tts`).
- **Stato server**: stateless; persistenza solo su Postgres + Storage.

## 2. Sicurezza
- RNF-SEC-01 Tutte le tabelle applicative hanno RLS attiva.
- RNF-SEC-02 I ruoli sono in tabella `user_roles` separata; controllo via funzione `SECURITY DEFINER` `has_role` per evitare ricorsione RLS.
- RNF-SEC-03 Il bucket Storage `assets` e `tickets` è privato; accesso solo agli utenti autenticati.
- RNF-SEC-04 La service-role key non è mai esposta al client.
- RNF-SEC-05 Le server functions chiamate dal client autenticato passano sempre da `requireSupabaseAuth`.
- RNF-SEC-06 Password policy minimum 8 caratteri; HIBP attivabile dal dashboard Cloud.

## 3. Performance & scalabilità
- RNF-PRF-01 Indici DB su `tickets(structure_id, status, assigned_to)` e `assets(structure_id, category_id)`.
- RNF-PRF-02 Caching lato client via TanStack Query; loader prima della render con `ensureQueryData`.
- RNF-PRF-03 TTS streaming SSE PCM 24 kHz per latenza < 1s al primo audio.
- RNF-PRF-04 Realtime Postgres su `tickets` per dashboard live.

## 4. Affidabilità
- RNF-REL-04 Tabelle Fasi 2-6: RLS per struttura via `has_structure_access`. Conversazioni protette da funzione `is_conversation_member` (SECURITY DEFINER) per evitare ricorsione.
- RNF-REL-05 Realtime Postgres su `messages` e `conversations` con filtro per `conversation_id`.
- RNF-REL-06 AI Agent (Lovable Gateway) chiamato server-side: chiave `LOVABLE_API_KEY` mai esposta al client.
- RNF-REL-01 Trigger DB calcola SLA in modo deterministico (no race condition).
- RNF-REL-02 TTS idempotente: flag `tts_announced` impedisce annunci duplicati.
- RNF-REL-03 Tutte le mutazioni passano da React Query con invalidazione coerente delle liste e dei dettagli.

## 5. Usabilità & accessibilità
- RNF-UX-01 Layout responsive (desktop-first, supporto tablet).
- RNF-UX-02 Tema dark/light con tokens semantici (no colori hardcoded).
- RNF-UX-03 Lingua interfaccia: italiano.
- RNF-UX-04 Contrasti WCAG AA su bottoni e badge stato.

## 6. Manutenibilità
- RNF-MNT-01 Tutti i token colore/font in `src/styles.css` (no classi tipo `text-white` nei componenti).
- RNF-MNT-02 Schema DB modificato solo via migration tool, mai a runtime.
- RNF-MNT-03 I 3 documenti (`REQUISITI_FUNZIONALI`, `REQUISITI_NON_FUNZIONALI`, `MANUALE_OPERATIVO`) aggiornati a ogni iterazione con changelog datato in testa.

## 7. Audit & logging
- RNF-LOG-01 (Fase 6) tabella `audit_log` di tutte le modifiche su tickets, contratti, fatture.
- RNF-LOG-02 Console errori frontend riportati al sistema di lovable error reporting.

## 8. Compliance
- RNF-CMP-01 GDPR: dati personali utenti (`profiles`) cancellabili su richiesta.
- RNF-CMP-02 Documenti fornitori (DURC, assicurazioni) con scadenza tracciata (Fase 2).
