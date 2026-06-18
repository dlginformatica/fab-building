# HotelOps — Requisiti Funzionali

> Documento vivo: aggiornato a ogni interazione con l'utente.

## Changelog
- **2026-06-18** — v0.1: inizializzazione documento. Coperti: autenticazione, multi-tenant, ruoli, Asset & Impianti, Trouble Ticketing con SLA, TTS sui ticket.

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
- Fase 2: Fornitori, Contratti, portale fornitore, ordini di lavoro, rapportini firmabili.
- Fase 3: Piani di manutenzione preventiva, magazzino ricambi, ordini d'acquisto.
- Fase 4: Bollette utenze (luce/gas/acqua/gasolio) con letture contatori, fatture passive con OCR PDF, scadenzario, centri di costo.
- Fase 5: Messaggistica conversazionale 1:1 e di gruppo (porting da "Penelope Course Manager"), agenti AI multi-ruolo (Concierge tecnico, SLA Watcher, Procurement assistant).
- Fase 6: Dashboard direzionale, report PDF/Excel, audit log, mobile PWA.