# HotelOps — Requisiti Funzionali

> Documento vivo: aggiornato a ogni interazione con l'utente.

## Changelog

### 2026-06-19 — Fase 8.3 Asset avanzati
- RF-ASSET-12 Storico modifiche asset con tracciamento automatico campi principali (nome, codice, stato, stanza, area, garanzia, foto, note, marca/modello/seriale).
- RF-ASSET-13 Timeline manutenzioni asset: unione interventi preventivi (piani) e correttivi (ticket) ordinati cronologicamente.
- RF-ASSET-14 KPI affidabilità per asset: MTBF, MTTR, conteggi guasti/riparazioni, date ultimo guasto/riparazione.

### 2026-06-19 — Fase 8.2 SLA guidata (escalation + conformità)
- Nuova tabella `sla_escalation_rules`: catena multi-livello (L1–L5) per regola SLA o struttura, con `after_minutes`, destinatario per ruolo / utente / canale, evento dedicato (`sla_escalation_l1/l2/l3`), abilitabile.
- Nuove colonne `last_escalation_level`, `last_escalation_at` su `sla_violations` per idempotenza.
- Funzione DB `sla_pending_escalations()` (service role) usata dal cron orario per emettere escalation non ancora processate.
- Funzione DB `sla_compliance_report(_from,_to,_structure)` con conteggi ack/resolve on time, violazioni, % compliance e tempo medio di risoluzione, filtrata da `has_structure_access`.
- Nuova pagina `/app/sla-escalations`: editor catena escalation (livello, minuti, ruolo o canale, evento) con tabella tabellare attivabile/disattivabile.
- Nuova pagina `/app/sla-compliance`: KPI globali (Ack on time %, Risolti on time %, Violazioni), filtro periodo + struttura, tabella per priorità, export CSV.
- Nuovo cron route `/api/public/hooks/sla-escalations` (auth `apikey: SCHEDULER_SECRET`) — invocazione oraria suggerita.
- Eventi notifica aggiunti: `sla_escalation_l1`, `sla_escalation_l2`, `sla_escalation_l3`, `compliance_report_ready`.

### 2026-06-19 — Fase 8.1 Contratti completi (rinnovi, allegati, scadenziario)
- Estesa tabella `contracts` con `notice_period_days`, `renewal_terms`, `next_review_at`, `attachments_count`, `last_notified_at`.
- Nuova tabella `contract_renewals`: storico rinnovi con previous_end_date → new_end_date, importo, note e autore. Trigger applica automaticamente il rinnovo al contratto (aggiorna end_date, riapre stato attivo, reset last_notified_at).
- Nuova tabella `contract_attachments` + bucket privato `contracts`: upload/download/elimina con URL firmati a 5 minuti; trigger mantiene `attachments_count`.
- Pagina `/app/contracts` rivista con due tab: **Tutti** (card con badge stato, scadenza, allegati, azioni Rinnova/Allegati) e **Scadenzario** (KPI Scaduti / ≤30 / 31–60 / 61–90 gg + tabella ordinata per scadenza).
- Nuovo evento notifica `contract_expiring` e route cron `/api/public/hooks/contracts-notify` (auth via SCHEDULER_SECRET) che invia notifiche giornaliere ai canali Teams/Email configurati per i contratti in scadenza entro il periodo di preavviso.
- RLS: accesso a rinnovi e allegati riservato a chi ha accesso alla struttura del contratto.

### 2026-06-19 — Fase 7.4 Notifiche Email & Microsoft Teams
- Nuove tabelle `notification_channels` (canale per struttura: tipo email/teams, destinazione, eventi sottoscritti, attivo) e `notification_log` (storico invii con esito).
- Eventi supportati: ticket_created, ticket_assigned, sla_warning, sla_violated, workflow_step, invoice_due, maintenance_due.
- Server function `dispatchNotification` (createServerFn protetta) e `sendTestNotification` per test diretto del canale.
- Microsoft Teams via webhook entrante (MessageCard con titolo/testo/azione "Apri in HotelOps").
- Email pronta per integrazione con Lovable Emails (dominio mittente da configurare in Cloud → Emails).
- UI: /app/notifications con tabs Canali / Log invii, toggle attivo, multi-evento, test invio in un click.
- RLS: solo admin (super_admin/direttore/facility_manager) della struttura possono creare/modificare canali e leggere log.


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


### 2026-06-19 — Fase 7.1 Manutenzione evoluta
- Pagina Manutenzione con 3 tab: **Piani**, **Calendario** (mese, evidenziazione scaduto/in scadenza/completato), **Storico interventi** filtrabile per esito.
- Esecuzione task da calendario: checklist spuntabile, ore lavorate, esito (ok/da rifare/problema/annullato), note, foto multiple, firma chiusura (`signed_at`, `completed_by`).
- Tabella `maintenance_tasks` estesa con `assigned_to`, `estimated_hours`, `actual_hours`, `outcome`, `photos`, `signature_url`, `signed_at`, `ticket_report_id`, `scheduled_for`, `updated_at`.
- Funzione SQL `generate_maintenance_tasks(from,to)` (service_role) per materializzare i task ricorrenti.

- **v0.16 (2026-06-19)** — **Notifiche SLA automatiche** (`/app/sla-notifications`): tabella `sla_notifications` con tipi `warning_ack/warning_resolve` (entro 30 min dalla scadenza) e `violated_ack/violated_resolve`. Job `pg_cron` ogni 5 minuti esegue `enqueue_sla_warnings(30)` per generare gli avvisi pre-scadenza; trigger su `sla_violations` crea automaticamente la notifica di violazione. Bell di notifica in topbar con badge contatore, popover delle ultime 20 aperte e link al ticket; pagina storico con filtri (tipo / aperte-tutte) e conferma manuale (`acknowledged_at/by`). RLS scoped per struttura, INSERT solo da trigger SECURITY DEFINER. **Sistema documentale impianti**: tabella `asset_documents` con categorie (libretto, certificazione, manuale, garanzia, collaudo, schema, dichiarazione conformità, verbale ispezione, altro), versioning (`version`, `superseded_by`), date emissione/scadenza con highlight rosso (scaduto) o giallo (scadenza < 30 giorni). Storage bucket privato `asset-docs` con policy per struttura. **Foto & video impianti**: tabella `asset_media` (kind image/video, caption, taken_at, thumbnail), bucket privato `asset-media`, upload multi-file con anteprima immagini e player video integrato nella scheda asset.
- **v0.15 (2026-06-19)** — **Timeline e allegati riordini** (`/app/reorders/$id`): tabella `reorder_events` con log automatico dei cambi di stato (da_approvare → approvato → ordinato → ricevuto/annullato) tramite trigger DB, allegati `reorder_attachments` (ordine, DDT, fattura, altro) salvati nel bucket privato `reorders` con RLS per struttura. **SLA per area e tipologia**: campi `name`, `description`, `area`, `enabled` su `sla_rules`; la funzione `apply_sla_on_ticket` ora seleziona la regola più specifica considerando struttura → area → tipologia. **Aree & reparti** (`/app/area-mapping`): mappatura asset → area con assegnazione massiva; trigger ereditarietà area da asset su ticket e ordini di lavoro. Campo `area` aggiunto ai centri di costo. **PDF executive Compliance**: export PDF di `/app/suppliers-compliance` con header, footer firma, QR per destinatario e paginazione. **Ciclo vita QR asset**: campi `qr_revoked_at`, `qr_generated_at` su asset, tabella `asset_qr_audit` con trigger su rotazione/revoca/riattivazione del token, controlli Rigenera/Revoca/Riattiva nella scheda asset, vista mobile QR blocca correttamente i token revocati.
- **v0.13 (2026-06-19)** — **Costi per area (5★)**: nuovo modulo `/app/cost-analytics` con campo `area` (camere, SPA, ristorante, cucina, aree comuni, esterno, uffici) su asset/ticket/work_orders/invoices/purchase_orders, eredità automatica dall'asset via trigger, KPI executive, grafici stacked/pie/trend mensile, SLA per area ed export PDF. **QR mobile + storico interventi** (`/app/a/$qr`): scansione QR apre scheda asset mobile con storico interventi, log scansioni (`asset_scans`), accesso rapido all'apertura ticket. **Riordini magazzino** (`/app/reorders`): vista `low_stock_items`, tabella `reorder_requests` con flusso da_approvare → approvato → ordinato → ricevuto, ricezione che incrementa giacenza e genera movimento di carico. **Compliance fornitori** (`/app/suppliers-compliance`): scadenze DURC, assicurazione, HACCP, visura camerale, rating 1-5★, flag bloccato e vista `supplier_compliance` con stato calcolato (ok / in scadenza < 30gg / scaduto / bloccato).
- **v0.12 (2026-06-18)** — Anteprima PDF salvata in storage privato (`report-previews`, link firmato 24h) con scarica diretta prima del test invio; permessi per template (`report_template_access`: viewer/editor/admin per utente o ruolo) e audit completo dei cambi di layout (header/footer/firma/QR + layout per destinatario); pagina di dettaglio job coda invii con tentativi, errori, payload, link tra destinatari della stessa esecuzione e rilancio manuale; audit deleghe con ricerca full-text e filtri per struttura e funzione.
- **v0.11 (2026-06-18)** — Report Builder: layout PDF per destinatario (header/footer/firma/QR) con anteprima inline e test di invio; pianificazione con validazione cron, preset, timezone per struttura e preview delle prossime 5 esecuzioni; coda di invio PDF con retry/back-off e DLQ; nuova sezione "Audit deleghe" (chi/cosa/quando/motivazione) con filtri ed export CSV.
- **2026-06-18** — v0.10: **Storico deleghe** (`/app/delegations-history`) consultabile per utente (delegante/delegato), funzione/modulo e stato (attiva/sospesa/scaduta), con scadenza, motivazione ed export CSV. **Pianificazione automatica export Report Builder**: ogni modello accetta destinatari email e `next_run_at`; un endpoint pubblico `/api/public/hooks/report-scheduler` (richiamabile da pg_cron) esegue le query, registra le esecuzioni in `scheduled_report_runs` e invia il PDF ai destinatari. **Test automatici** (`vitest run`) verificano che la UI aggiorni in tempo reale i controlli abilitati/disabilitati al concedere o revocare una delega per singola funzione, modulo e struttura.
- **2026-06-18** — v0.9: **Audit log consultabile** con filtri (entità, azione, periodo, utente, ricerca) ed export CSV/PDF, alimentato da trigger DB automatici su SLA, penali, permessi, deleghe, modelli report, violazioni, fatture. **Configurazione guidata SLA** per priorità + tipologia (categoria) + struttura, con **simulazione** del calcolo prima di salvare. **Simulatore penali** per stimare l'importo a partire da ritardo prima di applicare la regola. **Onboarding utenti** via email (magic link) e **reset password** dalla scheda utente. **Report Builder** esteso con layout PDF (intestazione, sotto-intestazione, piè di pagina, firma, QR), pianificazione cron e tracciamento ultima esecuzione.
- **2026-06-18** — v0.8: aggiunti **Permessi per funzione** (granulari per utente/ruolo/struttura), **Deleghe utente** (temporanee, per moduli), **Penali & Violazioni SLA** (calcolo automatico via trigger DB), **Statistiche operative** (KPI, MTTR, % SLA, grafici Recharts, export PDF), **Report Builder universale** (sorgente + colonne + filtri + salvataggio modelli, export PDF/CSV via jsPDF).
- **2026-06-18** — v0.7: aggiunti **Portale Agenti/Fornitori** (`/portal`), **Dashboard personalizzabile a widget** per direttore/proprietà, **allegati foto/PDF** sui ticket (bucket `tickets`), **rapportino di intervento** firmato (`ticket_reports`), **videocall integrata** via Jitsi Meet (`videocall_rooms`).
- **2026-06-18** — v0.6: completate Fasi 2-6. Aggiunti: Fornitori, Contratti, Ordini di Lavoro, Manutenzione programmata, Magazzino, Ordini d'Acquisto, Utenze & Letture, Fatture & Bollette, Messaggistica multi-agente (porting Penelope con AI Gateway), Report direzionale, Audit log. Aggiornato __root.tsx per usare Google Fonts (font @fontsource non installato).
- **2026-06-18** — v0.1: inizializzazione documento. Coperti: autenticazione, multi-tenant, ruoli, Asset & Impianti, Trouble Ticketing con SLA, TTS sui ticket.

## Nuovi moduli v0.7

### RF-PORTAL Portale Agenti & Fornitori (`/portal`)
- RF-PORTAL-01 Vista dedicata e semplificata per utenti con ruolo `fornitore` / `manutentore`.
- RF-PORTAL-02 Elenco ticket assegnati all'utente corrente, suddivisi in Aperti / Conclusi.
- RF-PORTAL-03 Apertura del ticket con allegati foto/PDF, rapportino intervento e videocall integrata.
- RF-PORTAL-04 Azioni rapide: prendi in carico, segna risolto.

### RF-DASH Dashboard personalizzabile
- RF-DASH-01 Ogni utente (direttore, proprietà, facility manager) può comporre la propria dashboard scegliendo widget da un catalogo.
- RF-DASH-02 Widget supportati: KPI (ticket aperti/critici, SLA %, asset, fatture da pagare, valore magazzino, fornitori attivi) e liste (ticket recenti, violazioni SLA, ordini di lavoro aperti, manutenzioni in scadenza, sotto-scorta).
- RF-DASH-03 Riordino, ridimensionamento (SM/MD/LG/XL) e rimozione dei widget in modalità "Modifica layout".
- RF-DASH-04 Layout persistito in `dashboard_widgets` con RLS per-utente.

### RF-TKT-EXT Estensioni Ticket
- RF-TKT-EXT-01 Allegati multipli (foto da smartphone e PDF) per ticket, conservati nel bucket `tickets`.
- RF-TKT-EXT-02 Rapportino di intervento con riepilogo, ore lavorate, lista materiali e firma (timestamp) — tabella `ticket_reports`.
- RF-TKT-EXT-03 Videocall on-demand (Jitsi Meet, room univoca per ticket) — tabella `videocall_rooms`. Nessuna chiave API richiesta.

## 1. Visione
HotelOps è un sistema di **Building & Facility Management** per strutture alberghiere. Gestisce in un unico ambiente impianti, asset, fornitori, contratti, SLA, manutenzioni, materiali, bollette e fatture, con un sistema di Trouble Ticketing e annuncio vocale (TTS) per gli interventi urgenti.

## 2. Attori e ruoli
| Ruolo | Descrizione |
|---|---|
| super_admin | Accesso totale a tutte le strutture e impostazioni |
| direttore | Direzione di una o più strutture |
| facility_manager | Gestione operativa impianti/ticket/fornitori |
| manutentore | Esegue interventi, aggiorna ticket assegnati |
| fornitore | Vede e gestisce solo i ticket/contratti propri |
| economato | Bollette, fatture, ordini, magazzino |
| viewer | Sola lettura |

## 3. Requisiti per modulo

### 3.1 Autenticazione & multi-tenant *(Fase 0 — implementato)*
- RF-AUTH-01 Registrazione/login con email+password.
- RF-AUTH-02 Login con Google (managed).
- RF-AUTH-03 Recupero password via email.
- RF-AUTH-04 Una stessa identità può appartenere a più strutture con ruoli diversi.
- RF-MT-01 Selettore struttura attiva nella topbar.
- RF-MT-02 Tutti i dati operativi (asset, ticket, contratti…) sono scopati per struttura via RLS.

### 3.2 Asset & Impianti *(Fase 1 — implementato)*
- RF-AST-01 CRUD asset con codice univoco per struttura, nome, marca, modello, serial number.
- RF-AST-02 Categorie precaricate (HVAC, Idraulico, Elettrico, Ascensori, Cucine, Lavanderia, Antincendio, Piscina & SPA, IT & Wi-Fi, Mobilio, Altri).
- RF-AST-03 Ubicazione struttura → piano → stanza/area.
- RF-AST-04 Foto, manuale (upload su Cloud Storage), data installazione, garanzia.
- RF-AST-05 Stato asset: attivo / in_manutenzione / guasto / dismesso.
- RF-AST-06 QR code stampabile per ogni asset; lo scan apre la scheda asset con bottone "Apri ticket".
- RF-AST-07 Filtri per categoria, stato, struttura, ricerca testuale.

### 3.3 Trouble Ticketing *(Fase 1 — implementato)*
- RF-TT-01 Apertura ticket con titolo, descrizione, priorità (bassa/media/alta/critica), categoria, asset, stanza, foto.
- RF-TT-02 Stati workflow: aperto → assegnato → in_corso → (sospeso) → risolto → chiuso (annullato).
- RF-TT-03 Assegnazione a utente.
- RF-TT-04 Commenti/timeline.
- RF-TT-05 Vista lista + vista kanban.
- RF-TT-06 Numerazione progressiva.

### 3.4 SLA engine *(Fase 1 — implementato)*
- RF-SLA-01 Regole SLA configurabili per priorità e (opzionale) categoria/struttura.
- RF-SLA-02 Calcolo automatico di `ack_due_at` e `resolve_due_at` al momento dell'apertura ticket (trigger DB).
- RF-SLA-03 Countdown live nel dettaglio ticket.
- RF-SLA-04 KPI nella dashboard: % ticket in SLA, % violati, MTTR.

### 3.5 TTS (Text-to-Speech) sul ticketing *(Fase 1 — implementato)*
- RF-TTS-01 Lettura vocale automatica dei ticket di priorità **critica** appena creati.
- RF-TTS-02 Annuncio vocale degli alert SLA in violazione (ack o resolve scaduti).
- RF-TTS-03 Pannello Speaker (toggle attivo/non attivo, voce selezionabile, volume).
- RF-TTS-04 Voci disponibili: alloy, ash, ballad, coral, echo, sage, shimmer, verse, marin, cedar.
- RF-TTS-05 Storage idempotente: ogni ticket annunciato è marcato (`tts_announced=true`) per non ripetere.

### 3.6 Documentazione viva *(Fase 0 — implementato)*
- RF-DOC-01 I file `docs/REQUISITI_FUNZIONALI.md`, `docs/REQUISITI_NON_FUNZIONALI.md`, `docs/MANUALE_OPERATIVO.md` sono visibili dentro l'app (pagina "Documenti") e sempre allineati allo stato del codice.

## 4. Roadmap funzionale (non ancora implementata)

### 3.7 Fornitori *(Fase 2 — implementato)*
- RF-SUP-01 CRUD fornitori: ragione sociale, P.IVA, categoria, referente, contatti, scadenze DURC/assicurazione, stato (attivo/sospeso/dismesso).
- RF-SUP-02 Fornitori globali (cross-struttura) o legati a singola struttura.

### 3.8 Contratti *(Fase 2 — implementato)*
- RF-CON-01 CRUD contratti per struttura+fornitore: codice, titolo, tipo (canone/consumo/intervento/misto), periodo, importo, rinnovo automatico.
- RF-CON-02 SLA contrattuali (ack/resolve in minuti) collegabili ai ticket.
- RF-CON-03 Stato workflow: bozza → attivo → scaduto/disdetto.

### 3.9 Ordini di Lavoro *(Fase 2 — implementato)*
- RF-WO-01 Creazione ordine collegato a ticket/asset/contratto/fornitore con costo, data programmata, stato.

### 3.10 Manutenzione Programmata *(Fase 3 — implementato)*
- RF-MAN-01 Piani con frequenza (giornaliera→annuale o custom giorni), checklist editabile (1 riga per voce), prossima scadenza, assegnazione fornitore.
- RF-MAN-02 Task generabili dai piani (tabella maintenance_tasks).

### 3.11 Magazzino *(Fase 3 — implementato)*
- RF-INV-01 Articoli con SKU univoco per struttura, unità, giacenza, scorta minima, costo unitario, ubicazione.
- RF-INV-02 Alert sotto-scorta automatico in lista (quantità ≤ minima).
- RF-INV-03 Movimenti magazzino (entrata/uscita/rettifica) legati a ticket/ordine.

### 3.12 Ordini d'Acquisto *(Fase 3 — implementato)*
- RF-PO-01 PO con fornitore, stato (bozza/inviato/confermato/ricevuto/annullato), righe item (Nome|Qta|Prezzo), totale, consegna prevista.

### 3.13 Utenze & Letture *(Fase 4 — implementato)*
- RF-UT-01 Contatori per tipo (elettricità/gas/acqua/gasolio/teleriscaldamento/altro) con POD/PDR, matricola, unità.
- RF-UT-02 Letture periodiche con data/valore; ultima lettura visibile in lista.

### 3.14 Fatture & Bollette *(Fase 4 — implementato)*
- RF-INV2-01 Registrazione fattura passiva: numero, fornitore, tipo utenza, importi (imponibile/IVA/totale), scadenza, stato.
- RF-INV2-02 Upload PDF su Storage; link diretto al PDF dalla card.
- RF-INV2-03 Calcolo automatico "scaduta" (badge rosso) se due_date passata e non pagata.
- RF-INV2-04 Centri di costo (tabella creata; UI gestita da admin in fasi successive).

### 3.15 Messaggistica multi-agente *(Fase 5 — implementato, adattata da Penelope)*
- RF-MSG-01 Conversazioni 1:1 o di gruppo legate opzionalmente a ticket/contratto, scopate per struttura.
- RF-MSG-02 Realtime via Postgres Realtime (canale `conv-<id>`).
- RF-MSG-03 Agenti AI: `concierge`, `sla_watcher`, `procurement` — ogni conversazione può avere uno; risposta via Lovable AI Gateway (`google/gemini-2.5-flash`).
- RF-MSG-04 Storia conversazione persistita; messaggi distintivi per utente/agente.

### 3.16 Report direzionale *(Fase 6 — implementato)*
- RF-REP-01 KPI live per struttura: ticket totali/aperti, % SLA rispettati, € fatture da pagare/pagate, € costo interventi, valore magazzino, articoli sotto-scorta.

### 3.17 Audit log *(Fase 6 — implementato)*
- RF-AUD-01 Tabella `audit_log` (insert da app, select solo per admin via `is_admin`). UI elenco ultime 200 voci.

## 4. Funzionalità ancora da implementare (rilevate nelle fasi)

**Fase 2 — gap**: portale fornitore esterno (login dedicato fornitore), rapportini intervento firmabili digitalmente (signature pad), notifica automatica scadenze DURC/assicurazione (cron), allegati multipli a contratto.

**Fase 3 — gap**: generazione automatica `maintenance_tasks` dai piani (job ricorrente), scarico automatico magazzino al chiudere un ordine di lavoro, codici a barre articoli, soglie min/max con riordino auto.

**Fase 4 — gap**: OCR PDF fattura (parser → ocr_data), abbinamento fattura↔contratto/POD, grafici consumi nel tempo, esportazione registro IVA, scadenzario calendario, fatturazione attiva.

**Fase 5 — gap**: tools AI (open ticket, query asset, lookup fornitore via function-calling), allegati nei messaggi, indicatore "non letto" (`last_read_at`), reazioni, ricerca, conversazioni con fornitori esterni (via `supplier_id` in participants).

**Fase 6 — gap**: export PDF/Excel report, audit automatico via trigger DB (oggi inserimento solo manuale), grafici (chart.js/recharts), drill-down per centro di costo, mobile PWA, notifiche push.
