# HotelOps — Manuale Operativo

> Documento vivo: aggiornato a ogni interazione con l'utente.

## Changelog
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