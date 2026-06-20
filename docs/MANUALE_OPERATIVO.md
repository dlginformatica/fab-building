# HotelOps — Manuale Operativo

> Documento vivo: aggiornato a ogni interazione con l'utente.

## Changelog
- **2026-06-20 — Fase 20 · Abbonamenti & livelli**: nuove tabelle `subscription_plans` (tier, price_monthly_eur, max_users, max_structures, modules[], trial_days) e `org_subscriptions` (status: trial/active/expired/readonly, trial_ends_at, current_period_end). Funzioni: `org_effective_tier(_org)` (large in trial, altrimenti tier attivo), `org_can_write(_org)` (false se expired/readonly, sempre true per super_admin), `plan_validate_modules(modules[])` (verifica dipendenze). `handle_new_user` esteso: ogni nuova org riceve trial Large 30 giorni. Hook `useMySubscription`, `useModuleEnabledForTier`, `useCanWrite`. Sidebar filtra moduli per tier effettivo. Banner stato in `AppShell`. Pagine: `/app/super-admin/plans` (configurazione prezzi e mappatura moduli con validazione dipendenze + gestione manuale abbonamenti), `/app/billing` (stato + istruzioni pagamento manuale). Stripe rinviato a Fase 2.
- **2026-06-20 — PDF reale del Manuale**: il pulsante "Scarica PDF" in `/manual` non lancia più `window.print()` ma genera client-side un vero PDF (jsPDF + marked) con **copertina** (titolo, sottotitolo, versione, data), **indice navigabile con numeri pagina**, **numerazione pagine "Pag. X / Y"** e impaginazione di testo, liste, tabelle e **immagini reali** (caricate via fetch dalle path `public/screens/*`). Nome file personalizzato es. `hotelops_manuale_utente_v2026-06-20_2026-06-20.pdf`. Conservato `Stampa` come fallback browser. Nuovo modulo `src/lib/manual-pdf.ts`.
- **2026-06-20 — Manuale Utente introdotto**: nuovo `docs/MANUALE_UTENTE.md` (10 capitoli + FAQ + glossario, screenshot reali). Pagina `/manual` ora ha doppia vista (toggle): **Manuale Utente** (markdown ricco, TOC laterale, immagini) e **Manuale Operativo** (changelog tecnico, questa pagina). Aggiunti `react-markdown`, `remark-gfm`, `@tailwindcss/typography`. Regola permanente aggiornata: anche il manuale utente è documento vivo da mantenere ad ogni iterazione.
- **2026-06-20 — Fix routing detail pages & screenshot completi**: rinominati `app.assets.tsx`/`app.tickets.tsx`/`app.delivery-queue.tsx`/`app.reorders.tsx` in `*.index.tsx` (il file padre faceva da layout senza `<Outlet />`, lasciando bianche le pagine di dettaglio `/$id`). Rimossi i join PostgREST verso `profiles` privi di FK in `app.tickets.$id.tsx` e `InterventionReport.tsx` (causavano 400). Catturati gli screenshot reali mancanti: asset detail, ticket detail, TTS speaker panel, documenti vivi, trend YoY consumi, report builder. Aggiunto `public/favicon.ico` per eliminare i 404 ricorrenti del probe di connettività.
- **2026-06-20 — Fase 19 · Vetrina prodotto & brochure**: home rinnovata con tutti i 13 moduli organizzati in 4 categorie; nuova pagina **/features** (catalogo) e **/features/:slug** (scheda dettaglio con descrizione, benefici, flusso operativo, schermate); pulsante "Leggi il manuale" ora punta a **/manual** (pagina pubblica con manuale operativo + download .md); nuova pagina **/brochure** (versione HTML stampabile + download PDF via window.print, layout A4). Catalogo funzioni centralizzato in `src/lib/features-catalog.ts` (single source of truth per home, /features, /brochure). Componente `FeatureScreenshot` con fallback wireframe quando lo screenshot reale non è ancora disponibile. Regola permanente estesa: ad ogni modifica vengono aggiornati anche `docs/BROCHURE.md`, la pagina `/brochure`, e le pagine descrittive `/features`/`/features/:slug`.
- **2026-06-20 — Fase 18**: avvisi admin con link diretto al modulo coinvolto e riepilogo visivo delle dipendenze mancanti; nuova pagina **Preferenze notifiche organizzazione** (`/app/notification-prefs`) per impostare canali (in-app/email/push), frequenza (immediata/digest), categorie e fascia di silenzio; rollback delle dipendenze ora ha **selettore versione**, **diff** vs versione attiva, **anteprima impatto** sulle deleghe correnti e blocco di conferma se la versione bersaglio renderebbe non conformi deleghe attive.
- **2026-06-20 — Fase 17**: rollback versionato delle regole di dipendenza (clona la versione target, la attiva e traccia l'evento in audit), nuovi avvisi automatici per gli admin di organizzazione quando un utente viene respinto per dipendenza mancante (con modulo, motivazione e link alla pagina deleghe).
- **2026-06-20 — Fase 16**: editor versionato delle dipendenze tra moduli (validazione cicli/duplicati + anteprima impatto), pagina **Accessi negati** in Smart Inbox che mostra il motivo e le dipendenze mancanti, **Audit permessi & deleghe** con diff before/after, test di integrazione sull'espansione delle dipendenze nelle deleghe (`src/lib/module-deps.test.ts`).

### 2026-06-20 — Matrice permessi granulare con dipendenze obbligatorie
- Aggiunta funzione SQL `has_module_access(user, module, structure)` — verifica server-authoritative (super_admin, owner organizzazione, direttore/facility_manager, delega attiva, permesso granulare).
- Aggiunta funzione `missing_module_deps(modules[])` per anteprima dipendenze mancanti.
- Trigger `user_delegations_expand_deps` su `user_delegations`: ogni delega viene espansa automaticamente con i moduli prerequisito, garantendo coerenza a livello DB.
- Estesa la mappa `module_dependencies` (cashbook→invoices, smart_inbox→tickets, sustainability→utilities, scheduled_exports→reports, alerts→sla, overview→statistics, audit→settings, sla_settings→sla, notifications→sla, delegations→users, organization→users, integrations→settings, housekeeping/guest_issues→rooms, messages→users, workflows→tickets, rooms→structures).
- Nuova RPC `permission_matrix(org)` restituisce per ciascun utente dell'organizzazione lo stato effettivo di ogni modulo (enabled + origine).
- UI: pagina "Matrice permessi" (`/app/permissions-matrix`) con vista tabellare utenti×moduli, simulatore di selezione moduli con dipendenze auto-aggiunte e legenda fonte.
- Aggiunti hook `useModuleAccess` e `useMissingDeps`, componente `ModuleGate` (gate UI in sincrono con il check server).

### 2026-06-20 — Fase 14 · Sistema multi-tenant (organizzazioni)
- **Organizzazioni** (`/app/organization`): ogni utente che si registra crea automaticamente la propria organizzazione e ne è proprietario (owner). Limite **6 utenti per organizzazione** (1 owner + 5 membri).
- **Inviti** con email destinatario, ruolo organizzazione (admin/member), ruolo applicativo, **moduli delegati** (con espansione automatica delle dipendenze obbligatorie — es. invitando `work_orders` vengono aggiunti `tickets`+`assets`+`suppliers`) e **strutture** specifiche o tutte. Link condivisibile `/invite/{token}`, scadenza 14 giorni, revocabile.
- **Trasferimento proprietà** dall'owner verso un altro membro esistente (il precedente owner diventa admin).
- **Tabelle nuove**: `organizations`, `org_memberships`, `org_invitations`, `module_dependencies`.
- **RLS**: `structures` filtrate per `organization_id`; solo l'owner può creare/modificare strutture; inviti accettabili anche da non autenticati via token; ogni utente vede solo la propria organizzazione.
- **Signup**: aggiunto campo "Nome organizzazione" nella registrazione; se l'email ha un invito pending la nuova org non viene creata.
- **Funzioni DB**: `current_org_id`, `is_org_owner`, `is_org_member`, `org_user_count`, `expand_modules_with_deps`, `transfer_org_ownership`, `accept_org_invitation`. Trigger `tg_enforce_org_user_limit` blocca inserimenti oltre il limite.

### 2026-06-20 — Fase 13 · Notifiche SLA push/email con template editabili
- **Template editabili** (`/app/notifications` → tab *Template*): subject + corpo markdown con placeholder `{{ticket_number}}`, `{{title}}`, `{{priority}}`, `{{due_at}}`, `{{delay_minutes}}`; scope globale o per struttura; canali supportati: email, Teams, push in-app.
- **Dispatcher cron** `/api/public/hooks/sla-notify` (ogni minuto): scansiona `sla_notifications` non ancora dispatchate, risolve il template appropriato per evento+canale e invia via canali attivi configurati. Tracking `dispatched_at` + `dispatched_count`. Logga tutto in `notification_log`.
- **Stati riconoscimento**: già attivi nella Smart Inbox (nuovo / letto / risolto) e nello storico `/app/sla-notifications`. Ora ogni notifica viene anche dispatchata sui canali email/Teams/push secondo il template scelto.

### 2026-06-20 — Fase 12 · Trend, Preferenze SLA, Stato notifiche, Export schedulati
- **Trend YoY** (`/app/trends`): selettore KPI (ticket, SLA, fatture, energia, acqua, gas, housekeeping, guest issues) con confronto anno corrente vs precedente, benchmark per camera/anno, export CSV.
- **Preferenze SLA** (`/app/sla-settings`): per utente e struttura — soglia pre-allerta, intervallo reminder, canali (in-app/email/push), orario silenzioso. Anteprima impatto in tempo reale sui ticket aperti.
- **Smart Inbox · stato notifiche SLA**: nuovo blocco con stato `nuovo / letto / risolto` e azioni rapide (Letto, Risolto). Refresh 30s.
- **Export schedulati** (`/app/scheduled-exports`): pianificazioni periodiche per Fatture SDI (XML/PDF/CSV), Cashbook, Housekeeping KPI, SLA, ESG. Ogni pianificazione genera un link condivisibile (`/exports/{token}`).

### 2026-06-20 — Fase 11: Overview, Alert, Export & Audit estesi

**Overview unificata (`/app/overview`)** — Dashboard "tutto in uno" con KPI di Housekeeping, Segnalazioni ospiti, SLA, Fatture e trend consumi elettrici, filtrabile per periodo (default ultimi 30 giorni). Include lista degli alert recenti e bottone *PDF* per esportare il riepilogo.

**Alert & Scadenze (`/app/alerts`)** — Pannello reminder automatici aggregati dalla funzione `alerts_for_structure`: violazioni SLA aperte, contratti in scadenza entro 30 giorni, fatture scadute o in scadenza entro 7 giorni, documenti fornitori in scadenza entro 30 giorni. Filtri per tipo, severità *high/medium*, refresh ogni 60 secondi. Export CSV/PDF inclusi. Gli alert appaiono anche come nuova colonna in Smart Inbox.

**Export CSV/PDF unificati** — Nuovo helper `src/lib/exports.ts` con `exportCSV`, `exportPDF` (header standard HotelOps, brand color, formato landscape) e `shareLink`. Applicato a Prima Nota (ora ha sia CSV che PDF), Alert, Overview. Audit log già aveva entrambi; altri moduli possono riutilizzarlo in tre righe.

**Audit log esteso** — Nuovo trigger generico `audit_trigger_fn` registra automaticamente ogni `INSERT/UPDATE/DELETE` su: `invoices`, `cash_movements`, `integrations`, `supplier_documents`, `suppliers`. Ogni voce salva utente (`auth.uid()`), entità, azione e diff JSON `{old,new}`. Visibile in `/app/audit` agli admin con filtri/export.

### 2026-06-20 — Fasi 2-10: rilancio per piccole/medie strutture

**Housekeeping (`/app/housekeeping`)** — Stato di ogni camera (Pulita/Sporca/In pulizia/Ispezionata/Fuori uso) + occupazione (Libera/Occupata/Arrivo/Partenza/Permanenza). KPI giornaliero a colpo d'occhio. "Genera turni" crea automaticamente i task del giorno per tutte le camere sporche; il cameriere clicca *Inizia* → *Fatto* dal telefono. I task sono per data, tipo (pulizia, cambio completo, rifacimento, ispezione, blocco) e priorità.

**Segnalazioni ospiti via QR (`/g/<token>` pubblica, `/app/guest-issues` staff)** — Generi i QR di tutte le camere con un click ("Genera QR mancanti"), li stampi dal pannello (anteprima + bottone Stampa) e li attacchi in stanza. L'ospite inquadra → form mobile (categoria, descrizione, nome/telefono opzionali). Lo staff vede la segnalazione in "Segnalazioni ospiti" e con *Crea ticket* la trasforma in un ticket regolare. Funziona senza login per l'ospite (RLS INSERT anon controllato).

**Integrazioni (`/app/integrations`)** — Collega Fatture in Cloud (export SDI), Octorate (channel manager), un PMS generico (Beddy o custom), WhatsApp Business, provider energia. Per ogni provider salvi credenziali (token cifrato lato DB) e attivi/disattivi con uno switch. Solo super_admin/direttore/facility_manager.

**Export FatturaPA SDI** — Su ogni fattura ora compare *Export SDI XML*: genera un file XML schema FPR12 conforme. Prerequisito: in Impostazioni struttura inserire P.IVA, indirizzo, CAP, regime fiscale (default RF01). Il `CodiceDestinatario` viene preso dal Codice SDI del fornitore (o `0000000` se non presente, e si aggiunge `PECDestinatario` se il fornitore ha PEC).

**Prima Nota / Cassa (`/app/cashbook`)** — Entrate e uscite quotidiane. Filtra per periodo, vedi saldo e totali in tempo reale, esporta in CSV per il commercialista. Categorie: soggiorno, extra (bar/ristorante), utenze, fornitori, manutenzione, stipendi, tasse, altro. Metodo: contanti, POS, bonifico, assegno.

**Smart Inbox (`/app/smart-inbox`)** — Una sola pagina con tutto ciò che richiede la tua attenzione: nuove segnalazioni ospiti + ticket critici/alti aperti + ultime conversazioni. Tre colonne, link diretti alle pagine di dettaglio. Pensata come prima pagina della giornata.

**Consumi & Sostenibilità (`/app/sustainability`)** — Letture contatori ultimi 12 mesi → consumi per camera/anno → confronto con benchmark di settore (3200 kWh elettrica, 380 Smc gas, 130 mc acqua per camera/anno). Badge ✓ sotto media / ≈ in media / ⚠ sopra media + percentuale. In fondo, 4 suggerimenti ESG operativi (caldaia condensazione, LED+sensori, soffioni a basso flusso, riuso asciugamani).

**WhatsApp Business** — Provider preconfigurato nelle Integrazioni (phone_number_id + access_token); base per notifiche outbound a ospiti/tecnici nei prossimi rilasci.

**Mobile-first** — Tutte le nuove pagine sono progettate per uso da telefono (housekeeping a bordo letto, ospite QR sul comodino, cassa al banco). La PWA installabile e l'offline outbox della Fase 8.4 restano attivi.

### 2026-06-19 — Setup guidato in 5 minuti
Nuova pagina **Setup guidato** (`/app/onboarding`, in sidebar sotto Operativo) che porta un albergatore dal primo accesso a una struttura pronta all'uso in pochi minuti:
1. **Struttura**: nome + città (crea o aggiorna la struttura attiva).
2. **Preset**: B&B / Hotel piccolo / Boutique-Resort, ciascuno con dimensioni consigliate.
3. **Piani e camere**: piani (1-20) e camere per piano (1-100); le camere sono numerate automaticamente con la convenzione `piano*100 + n` (101, 102, …, 201, …).
4. **Riepilogo**: mostra esattamente cosa verrà creato — piani, camere, 11 categorie asset (caldaia, climatizzazione, idraulico, elettrico, ascensori, TV/Wi-Fi, mini-bar, lavanderia, cucina, antincendio, generico) e 4 SLA di default per priorità.
5. **Completato**: 4 prossimi passi consigliati (asset, fornitori, primo ticket, KPI).

Sulla dashboard principale appare un banner "Completa il setup in 5 minuti" finché la struttura non viene marcata come `onboarded_at`. Il seed è idempotente: rilanciarlo non duplica piani/camere/SLA già esistenti.

### 2026-06-19 — Verifica fornitori + documenti fiscali
Nella pagina **Fornitori** ogni scheda ora mostra un badge con lo stato di verifica (Da verificare / In verifica / Verificato / Rifiutato) e tre azioni rapide:
- **Documenti** apre il dialog di gestione documenti fiscali: caricamento (PDF/JPG/PNG) con tipo (visura, DURC, polizza, certificazione SDI, attestazione IBAN, HACCP, privacy, altro), data di scadenza opzionale e stato iniziale "da confermare". Lo staff autorizzato può confermare o rifiutare ogni documento dall'archivio; i file sono conservati nel bucket privato `supplier-docs` (link firmato 60s).
- **Verifica** / **Rifiuta** aggiornano lo stato di verifica del fornitore e registrano chi ha effettuato l'operazione.

Il form di creazione fornitore valida ora il **Codice SDI** (6-7 caratteri alfanumerici, "0000000" ammesso come placeholder) e la **PEC** (formato email). Errori inline impediscono l'invio.

### 2026-06-19 — Anagrafica fornitori estesa
Form nuovo fornitore riorganizzato in sezioni (Anagrafica, Dati fiscali, Contatti, Sede legale, Compliance) con i campi richiesti per la fatturazione elettronica italiana:
- **Dati fiscali**: P.IVA, Codice Fiscale, Codice SDI (7 caratteri), PEC, IBAN, REA.
- **Contatti**: aggiunto Sito web.
- **Sede legale**: indirizzo, città, provincia (2 lettere), CAP, paese (ISO).
- Card fornitore mostra città/provincia, PEC, codice SDI e IBAN quando presenti.

### 2026-06-19 — Fase 8.5 Dashboard KPI struttura
Nuova pagina `/app/structure-kpi` con selettore struttura e:
- 7 KPI card cliccabili: ticket aperti, ticket in ritardo (rosso se >0), % SLA risolti on time (30g), contratti in scadenza 90g, totale bollette ultimi 30g, asset totali, manutenzioni pending.
- Trend ticket aperti vs risolti, ultime 12 settimane (line chart).
- Distribuzione ticket aperti per categoria (bar chart).
- Tabella Top 5 fornitori per numero ticket gestiti (ultimi 90g) con rating.
- Voce sidebar "KPI struttura" sotto Operativo.

### 2026-06-19 — Fase 8.4 PWA offline + sync
HotelOps è ora installabile come app (icona home, splash, manifest) e funziona offline.
- **Installazione**: dal browser mobile usa "Aggiungi a schermata Home" / "Installa app". L'icona apre direttamente la pagina ticket.
- **Offline**: l'app shell (HTML/CSS/JS/font) è cachata. Quando la rete cade, le pagine già visitate restano navigabili.
- **Outbox**: ticket, commenti e scansioni QR creati offline vengono salvati in IndexedDB e inviati automaticamente al ritorno della rete.
- **Badge**: in basso a destra appare lo stato (Offline / N in coda). Pulsante "Sync" per forzare l'invio.
- **Editor Lovable**: il service worker NON si registra in preview/dev (evita stale cache). Funziona solo sul dominio pubblicato. Usare `?sw=off` come kill-switch.

### 2026-06-19 — Fase 8.3 Asset avanzati
Nuova scheda asset con tre tab in fondo alla pagina (`/app/assets/:id`):
- **Storico modifiche**: traccia automatica di ogni cambio sui campi principali (nome, codice, marca/modello, stato, stanza, area, foto, garanzia, note). Registrata data, attore, valore precedente e nuovo.
- **Manutenzioni**: timeline combinata di manutenzioni preventive (da piani) e ticket correttivi, con stato, data chiusura e ore consuntivate.
- **KPI affidabilità**: guasti totali, MTBF (Mean Time Between Failures) e MTTR (Mean Time To Repair) in ore, ultimo guasto e ultima riparazione.

### 2026-06-19 — Fase 8.2 SLA guidata
**Escalation** (`/app/sla-escalations`):
- Aggiungi livelli (L1/L2/L3) indicando minuti di ritardo dopo la scadenza e destinatario:
  - **Canale**: invia direttamente al canale Teams/Email indicato.
  - **Auto**: usa i canali sottoscritti all'evento (es. `sla_escalation_l1`).
- Disattiva temporaneamente un livello dal toggle; elimina con il cestino.
- Lo scheduler orario `/api/public/hooks/sla-escalations` processa tutte le violazioni aperte e marca il livello inviato.

**Conformità** (`/app/sla-compliance`):
- Seleziona periodo (default ultimi 30 giorni) e struttura per ottenere KPI Ack/Risoluzione on time e tabella per priorità.
- Esporta in CSV per condivisione con direzione o auditor.

**Cron suggerito** (super_admin lato DB):
`SELECT cron.schedule('hotelops-sla-escalations-hourly','15 * * * *', $$SELECT net.http_post(url:='https://project--83b017ab-cb1a-4977-a89e-bc32522b4ed2.lovable.app/api/public/hooks/sla-escalations', headers:=jsonb_build_object('Content-Type','application/json','apikey','<SCHEDULER_SECRET>'), body:='{}'::jsonb);$$);`

### 2026-06-19 — Fase 8.1 Contratti completi
**Gestione contratti** (`/app/contracts`):
- Tab **Tutti**: card con codice, fornitore, periodo, importo, badge stato, indicatore allegati e auto-rinnovo. Pulsanti **Rinnova** e **Allegati** su ogni card.
- Tab **Scadenzario**: KPI (Scaduti, ≤30, 31–60, 61–90 gg) e tabella ordinata per data scadenza con azione rapida di rinnovo.
- Nuovo contratto: compila codice, titolo, fornitore, periodo, importo, **preavviso (giorni)**, **rinnovo automatico**, **termini di rinnovo**, SLA contrattuali.

**Rinnovi**: dal pulsante Rinnova inserisci nuova scadenza e (opzionale) nuovo importo + note. Lo storico è visibile nello stesso dialog. Il rinnovo aggiorna `end_date` e riporta lo stato ad attivo.

**Allegati**: bucket privato `contracts`. Carica file dal dialog Allegati; download via link firmato 5 minuti; elimina rimuove anche il file dallo storage.

**Notifiche scadenza**: per ricevere alert su Teams/Email aggiungi un canale in *Notifiche Email & Teams* selezionando l'evento **contract_expiring**. Lo scheduler è un cron giornaliero `/api/public/hooks/contracts-notify` (auth `apikey: SCHEDULER_SECRET`) — per attivarlo lato DB: `SELECT cron.schedule('hotelops-contracts-notify-daily','0 8 * * *', $$SELECT net.http_post(url:='https://project--83b017ab-cb1a-4977-a89e-bc32522b4ed2.lovable.app/api/public/hooks/contracts-notify', headers:=jsonb_build_object('Content-Type','application/json','apikey','<SCHEDULER_SECRET>'), body:='{}'::jsonb);$$);` (chiedi al super_admin se non è già attivo).

### 2026-06-19 — Fase 7.4 Notifiche Email & Teams
- Vai in **Amministrazione → Notifiche Email & Teams**.
- Clicca **Nuovo canale**, scegli tipo (Teams o Email), incolla l'URL webhook Teams (creato in Teams → canale → Connettori → Webhook in ingresso) o l'indirizzo email destinatario.
- Seleziona gli eventi su cui ricevere notifica (es. SLA violato + Ticket creato per il team manutenzione).
- Usa il bottone **Test** per inviare un messaggio di prova; controlla il tab **Log invii** per esiti e diagnostica errori.
- Toggle **Attivo** per sospendere temporaneamente un canale senza eliminarlo.

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
**Manutenzione → Calendario**: clicca un giorno per vedere i task pianificati. Tocca un task per aprire la scheda d'esecuzione: spunta le voci della checklist, inserisci ore ed esito, allega foto, premi "Firma e chiudi" per chiudere l'intervento.
**Manutenzione → Storico**: elenco interventi chiusi, filtrabili per esito (OK / Da rifare / Problema / Annullato).

- **v0.16 (2026-06-19)** — **Notifiche SLA**: campanella in alto a destra mostra il numero di avvisi aperti (refresh ogni 60s). Cliccando su un avviso si apre il ticket; in `/app/sla-notifications` lo storico completo con filtri "solo aperte/tutte" e per tipo (warning ack, warning resolve, violated ack, violated resolve) e pulsante "Conferma" per registrare la presa in carico. **Documenti impianto** nella scheda asset: form a 6 colonne (titolo, categoria, emissione, scadenza, upload) + descrizione. Documenti con scadenza < 30 giorni in giallo, scaduti in rosso. **Foto & video impianto**: caricamento multi-file di immagini e video (mp4/mov/webm) con didascalia opzionale, anteprima grid e player integrato. I file finiscono in bucket privati separati per asset/struttura.
- **v0.15 (2026-06-19)** — Nuove sezioni operative: (1) Riordini → "Dettaglio" apre `/app/reorders/$id` con timeline auto-popolata e upload allegati (ordine, DDT, fattura). (2) `/app/sla` ora consente di nominare la regola, aggiungere descrizione e selezionare l'area: SLA più specifica vince. (3) `/app/area-mapping` permette al facility manager di assegnare l'area a ogni asset (singola o massiva); ticket e ordini di lavoro ereditano l'area automaticamente. (4) Compliance fornitori: pulsante "Esporta PDF executive" produce PDF firmato con QR per destinatario. (5) Scheda asset: pulsanti Rigenera/Revoca/Riattiva QR e tabella audit eventi token; un QR revocato mostra messaggio dedicato in `/app/a/<token>`.
- **v0.13 (2026-06-19)** — Nuovo modulo **Costi per area (5★)** (`/app/cost-analytics`) con KPI executive, grafici stacked/pie/trend, SLA per area e PDF. **QR mobile** (`/app/a/<token>`): scansione apre scheda asset mobile con storico interventi, log scansioni e apertura ticket diretta. **Riordini magazzino** (`/app/reorders`): articoli sotto-scorta, flusso da_approvare → approvato → ordinato → ricevuto con incremento giacenza automatico. **Compliance fornitori** (`/app/suppliers-compliance`) con DURC, assicurazione, HACCP, visura, rating 1-5★ e blocco fornitori.
- **v0.12 (2026-06-18)** — In Report Builder l'anteprima ora salva un PDF temporaneo (link firmato 24h) con bottone "Scarica" prima del test invio; il test invio allega lo stesso link al destinatario. Nuova pagina **Dettaglio job coda** (`/app/delivery-queue/:id`) con tentativi, errori, payload, esecuzione pianificata d'origine, altri destinatari della stessa run e azioni Rilancia/Rimuovi. **Audit deleghe** offre ricerca full-text e filtri Struttura/Funzione. Scheduler `/api/public/hooks/report-scheduler` richiede ora `Authorization: Bearer <chiave>`/`apikey` e accetta solo sorgenti dall'allowlist.
- **v0.11 (2026-06-18)** — Report Builder ora ha 4 tab (Layout / Per destinatario / Pianificazione / Retry). Per ogni destinatario puoi personalizzare oggetto, header, footer, firma e QR, vedere l'anteprima PDF in iframe e inviare un test che finisce nella nuova pagina **Coda invii report** (`/app/delivery-queue`). La pianificazione valida il cron, mostra preset e le prossime 5 esecuzioni nel timezone scelto. Le deleghe sono ora tracciate nella nuova pagina **Audit deleghe** (`/app/delegation-audit`) con filtri (email, azione, periodo) ed export CSV completo di motivazione.
- **2026-06-18** — v0.10: storico deleghe consultabile per utente/funzione/stato con export CSV; pianificazione automatica dei modelli del Report Builder (destinatari, prossima esecuzione, log `scheduled_report_runs`) tramite endpoint `/api/public/hooks/report-scheduler`; test automatici (vitest) che verificano l'aggiornamento immediato dei controlli abilitati/disabilitati al concedere o revocare una delega per singola funzione, modulo e struttura.
- **2026-06-18** — v0.9: Audit log filtrabile + export CSV/PDF (alimentato da trigger automatici), wizard SLA con simulazione, simulatore penali, onboarding utenti via email + reset password, Report Builder con layout PDF personalizzato (header/footer/firma/QR) e pianificazione cron.
- **2026-06-18** — v0.8: nuove sezioni **Permessi per funzione**, **Deleghe**, **Penali & Violazioni**, **Statistiche** e **Report Builder**. Le violazioni SLA e le penali sono calcolate automaticamente dal database alla risoluzione di ogni ticket; il Report Builder produce PDF e CSV su qualsiasi sorgente (ticket, asset, fatture, contratti, magazzino, violazioni SLA, ecc.) con colonne e filtri salvabili come modello.
- **2026-06-18** — v0.7.1: bootstrap automatico super_admin per `info@dlginformatica.it`. Al primo `signUp` con questa email il trigger DB assegna il ruolo `super_admin` senza intervento manuale.
- **2026-06-18** — v0.7: aggiunti Portale Agenti/Fornitori, Dashboard personalizzabile a widget, allegati foto/PDF sui ticket, rapportino intervento firmato, videocall integrata (Jitsi).
- **2026-06-18** — v0.6: completate Fasi 2-6. Aggiunte sezioni: Fornitori, Contratti, Ordini di Lavoro, Manutenzione programmata, Magazzino, Ordini d'Acquisto, Utenze & Letture, Fatture & Bollette, Messaggistica multi-agente, Report direzionale, Audit log.
- **2026-06-18** — v0.1: inizializzazione manuale (autenticazione, asset, ticket, TTS).

## Portale Agenti & Fornitori (`/portal`)
È una vista alleggerita per i tecnici esterni:
1. Login con le credenziali del proprio account (stesso `/auth`).
2. Si apre la sezione **I tuoi interventi** con i ticket assegnati.
3. Selezionando un ticket si possono:
   - caricare **foto** e **PDF** (da smartphone o desktop);
   - compilare il **rapportino di intervento** (riepilogo, ore, materiali) e firmarlo;
   - avviare una **videocall** col gestore (link Jitsi condivisibile);
   - aggiornare lo stato (Prendi in carico / Segna risolto).

## Dashboard personalizzabile
Dalla pagina **Dashboard**:
1. Al primo accesso clicca **Carica widget predefiniti** per partire da un layout standard.
2. **Aggiungi widget**: scegli dal catalogo (KPI, liste operative, magazzino, fornitori).
3. **Modifica layout**: cambia dimensione (SM/MD/LG/XL), riordina o rimuovi i widget.
4. La configurazione è personale: ogni utente (direttore, proprietà, facility manager) vede la propria.

## 1. Primo accesso

### 1.0 Account super_admin di bootstrap
È preconfigurato un bootstrap automatico per l'email **`info@dlginformatica.it`**:
1. Vai su `/auth` → tab **Registrati**.
2. Inserisci email `info@dlginformatica.it` e password iniziale `passw0rd.1` (cambiala dopo il primo accesso).
3. Al completamento il trigger DB `handle_new_user` assegna automaticamente il ruolo **super_admin** (visibile in `Impostazioni → Utenti & Ruoli`).
4. Da quel momento questo utente può creare strutture, assegnare ruoli e gestire SLA/fornitori senza alcun intervento SQL manuale.

1. Vai alla pagina **/auth**.
2. Crea un account con email + password, oppure clicca **Continua con Google**.
3. Al primo accesso il sistema crea automaticamente il tuo profilo.
4. Un **super_admin** deve assegnarti almeno un ruolo (vai a **Impostazioni → Utenti & Ruoli**) e collegarti a una struttura, altrimenti non vedrai dati.

> Per il primissimo super_admin: dopo aver registrato il primo account, inserire manualmente in `user_roles` una riga con `role='super_admin'` (operazione una tantum).

## 2. Creare una struttura (hotel)
1. Menù laterale → **Strutture** → **+ Nuova struttura**.
2. Inserisci nome, codice (es. `MAR01`), indirizzo, città, n° camere.
3. Salva. Da quel momento la struttura è selezionabile dal **selettore struttura** in topbar.
4. Aggiungi piani e stanze dalla scheda della struttura (sezioni "Piani" e "Stanze").

## 3. Censire un asset / impianto
1. Menù → **Asset & Impianti** → **+ Nuovo asset**.
2. Compila: codice (univoco per struttura), nome, categoria, ubicazione (piano/stanza), marca, modello, seriale, date installazione e garanzia.
3. Carica una foto e (opzionale) il manuale PDF.
4. Salva: viene generato automaticamente un **QR code** stampabile dalla scheda asset.
5. Stampa il QR e attaccalo sull'asset fisico: una scansione apre direttamente la scheda asset con il bottone "Apri ticket".

## 4. Aprire un ticket di manutenzione
1. Tre vie:
   - Pulsante **+ Nuovo ticket** in topbar.
   - Dalla scheda asset → **Apri ticket** (asset pre-compilato).
   - Scansionando il QR code dell'asset.
2. Compila: titolo, descrizione, priorità (bassa/media/alta/**critica**), categoria.
3. Salva. Il ticket riceve uno **SLA automatico**:
   - Critica → ack 15 min, risolvi 2h
   - Alta → ack 1h, risolvi 8h
   - Media → ack 4h, risolvi 24h
   - Bassa → ack 8h, risolvi 72h
4. Se la priorità è **critica**, lo Speaker TTS annuncia il ticket in viva voce a tutti gli operatori connessi.

## 5. Gestire un ticket
1. Menù → **Ticket** (lista) o **Ticket → Kanban**.
2. Apri il ticket: vedi il countdown SLA (verde = in tempo, ambra = in scadenza, rosso = violato).
3. Cambia stato (assegnato → in_corso → risolto → chiuso) e assegna un utente.
4. Aggiungi commenti/aggiornamenti nella timeline.

## 6. Pannello TTS (Speaker)
1. Topbar → icona **altoparlante**.
2. Toggle "Attivo": abilita l'annuncio automatico dei ticket critici e degli alert SLA per la sessione corrente del browser.
3. Seleziona la **voce** (alloy/ash/coral/…) e il **volume**.
4. Test: pulsante "Prova voce".

## 7. Configurare le SLA (admin/facility manager)
1. Menù → **Impostazioni → SLA**.
2. Crea regole specifiche per struttura e/o categoria (es. "Antincendio" → tempi più stringenti).
3. Una regola più specifica (struttura+categoria) ha priorità sulla regola globale.

## 8. Documenti del progetto
- **Documenti** dal menù → leggi e scarica i 3 documenti vivi:
  - Requisiti Funzionali
  - Requisiti Non Funzionali
  - Manuale Operativo

## 9. Roadmap visibile all'utente
- ✅ Fase 0–1: fondamenta + Asset + Ticketing + TTS
- ✅ Fase 2: Fornitori & Contratti & Ordini di Lavoro
- ✅ Fase 3: Manutenzione programmata & Magazzino & PO
- ✅ Fase 4: Utenze, Letture, Fatture
- ✅ Fase 5: Messaggistica multi-agente AI (Lovable Gateway)
- ✅ Fase 6: Report direzionale & Audit log

## 10. Nuovi flussi (Fasi 2-6)

### 10.1 Fornitori (menù → Fornitori)
1. **+ Nuovo fornitore** → compila ragione sociale, P.IVA, categoria, referente, scadenze DURC/assicurazione.
2. La card mostra contatti e scadenze. Stato Attivo/Sospeso/Dismesso.

### 10.2 Contratti (menù → Contratti)
1. **+ Nuovo contratto** → seleziona fornitore, imposta tipo, periodo, importo, **SLA ack/resolve in minuti**.
2. Le SLA contrattuali sono visibili nel record; integrazione con ticket via campo `contract_id` (Fase 7).

### 10.3 Ordini di Lavoro (menù → Ordini di Lavoro)
1. **+ Nuovo ordine**: collega ticket/asset/fornitore/contratto, programma data, costo. Stati: aperto/programmato/in_corso/completato/annullato.

### 10.4 Manutenzione programmata (menù → Manutenzione)
1. **+ Nuovo piano**: nome, frequenza (giornaliera→annuale o custom giorni), asset, fornitore, **checklist (1 voce per riga)**, prossima scadenza.

### 10.5 Magazzino (menù → Magazzino)
1. **+ Nuovo articolo**: SKU univoco, unità (pz/kg/L…), giacenza, scorta minima, costo, ubicazione.
2. Badge **"sotto-scorta"** rosso quando giacenza ≤ minima.

### 10.6 Ordini d'Acquisto (menù → Ordini d'Acquisto)
1. **+ Nuovo PO**: fornitore, righe in formato `Nome|Qta|Prezzo` (una per riga), consegna prevista, totale.

### 10.7 Utenze & Letture (menù → Utenze & Letture)
1. **+ Nuovo contatore**: tipo (elettricità/gas/acqua/…), POD/PDR, matricola, unità.
2. Sulla card → **+ Lettura** per registrare valore di oggi.

### 10.8 Fatture & Bollette (menù → Fatture & Bollette)
1. **+ Nuova fattura**: numero, fornitore, tipo utenza, importi, scadenza, upload PDF.
2. Badge **"scaduta"** automatico se due_date passata e non pagata.

### 10.9 Messaggi (menù → Messaggi)
1. **+** in colonna sinistra → titolo, partecipanti (multi), **Agente AI opzionale** (concierge / sla_watcher / procurement).
2. Selezione conversazione → chat realtime. Quando è configurato un agente, ogni messaggio utente riceve risposta automatica dall'AI.

### 10.10 Report (menù → Report)
- KPI live di struttura: ticket aperti, % SLA rispettati, € fatture, € costo interventi, valore magazzino.

### 10.11 Audit log (menù → Audit log)
- Solo admin (super_admin / direttore / facility_manager) vedono le ultime 200 operazioni tracciate.

## 11. Funzionalità mancanti / opzioni note

- **Portale fornitore** dedicato (login esterno, vista solo PO/contratti propri).
- **Rapportini firmabili** (signature pad) negli ordini di lavoro.
- **OCR PDF fatture** (estrazione automatica importi/scadenze).
- **Generazione automatica task** dai piani di manutenzione (job ricorrente lato DB).
- **Scarico magazzino automatico** alla chiusura di un ordine di lavoro.
- **Notifiche scadenze** DURC/assicurazione/contratti via email o in-app.
- **Grafici** (consumi utenze nel tempo, andamento ticket, spending).
- **Export PDF/Excel** dei report.
- **AI tools/function-calling**: apertura ticket, query asset/fornitore direttamente dall'agente.
- **Allegati nei messaggi** + ricerca + indicatore "non letto" per conversazione.
- **Audit trigger DB**: oggi `audit_log` riceve insert manuali; serve trigger su ogni tabella critica.
- **Mobile PWA** + notifiche push.
- **Multilingua** (oggi solo IT).
