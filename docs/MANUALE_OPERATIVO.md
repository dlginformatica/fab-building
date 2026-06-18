# HotelOps — Manuale Operativo

> Documento vivo: aggiornato a ogni interazione con l'utente.

## Changelog
- **2026-06-18** — v0.1: inizializzazione manuale (autenticazione, asset, ticket, TTS).

## 1. Primo accesso
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
- ⏳ Fase 2: Fornitori & Contratti
- ⏳ Fase 3: Manutenzione programmata & Magazzino
- ⏳ Fase 4: Bollette & Fatture (OCR)
- ⏳ Fase 5: Messaggistica multi-agente AI
- ⏳ Fase 6: Dashboard direzionale & Report