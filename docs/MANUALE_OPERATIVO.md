# HotelOps — Manuale Operativo

> Documento vivo: aggiornato a ogni interazione con l'utente.

## Changelog

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
