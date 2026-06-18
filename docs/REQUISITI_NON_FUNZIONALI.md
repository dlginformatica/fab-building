# HotelOps — Requisiti Non Funzionali

> Documento vivo: aggiornato a ogni interazione con l'utente.

## Changelog
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