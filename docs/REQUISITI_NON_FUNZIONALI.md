# HotelOps — Requisiti Non Funzionali

> Documento vivo: aggiornato a ogni interazione con l'utente.

## Changelog
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