<!-- changelog 2026-06-20 -->
- Seed dati demo completo (2 organizzazioni Hotel Demo A/B isolate, 16 utenti uno per ruolo, strutture, asset, fornitori, contratti, magazzino, contatori, ticket con SLA, abbonamenti) e checklist passo-passo in `docs/CHECKLIST_TEST_UMANO.md` per il primo test umano. Password demo: `Demo1234!`.
- Verificato isolamento multi-tenant via `has_structure_access`: ogni utente vede solo i dati della propria struttura/org; super admin vede tutto.

<!-- changelog 2026-06-20 -->
- Numero di build (`yyyy.mm.dd.hh.mm`) ora presente anche nei footer di: CSV esportati (riga finale), PDF esportati (footer di ogni pagina), PDF Manuale Utente, anteprima HTML stampabile, e nuovo helper `emailFooterHtml/Text` per i template email.

<!-- changelog 2026-06-20 -->
- Nuova pagina **Notifiche backup** (/app/backup-notification-prefs): owner/admin gestiscono canali (email/in-app), eventi (start/success/failure/integrità), destinatari, frequenza (immediata/digest orario/giornaliero) e fascia oraria di silenzio.
- Build number visibile in basso a destra di ogni schermata nel formato `yyyy.mm.dd.hh.mm` (UTC) per supporto e tracciabilità versioni.

## Aggiornamento 2026-06-20 — Backup cloud, point-in-time, audit e reset

- **Backup nel cloud**: nella pagina **Backup, Restore & Import** trovi un nuovo bottone "Backup nel cloud" che salva uno snapshot completo della tua organizzazione su archivio sicuro, tracciato nel registro.
- **2026-06-20 — Fase 21.3 · Integrità backup, progress restore, notifiche backup/restore**: RF-BCK-16 ogni backup nel cloud calcola un **hash SHA-256** dello snapshot (`backup_runs.integrity_hash`, `integrity_status`, `verified_at`, `duration_ms`); pulsante "Verifica integrità" su ogni riga dello storico ricalcola l'hash dal file storage e marca lo stato (`verified` / `mismatch` / `missing` / `error`). I backup non ripristinabili (`mismatch`/`missing`) nascondono il bottone di restore. RF-BCK-17 il restore point-in-time mostra **barra di avanzamento** con step (Ricerca → Download → Pre-restore → Restore replace → Finalizzazione); ogni step viene salvato su `restore_runs.steps_total`, `steps_done`, `current_step` ed è consultabile in `/app/backup-audit`. RF-BCK-18 nuove notifiche in-app per owner/admin via RPC `notify_org_admins`: `backup_started`, `backup_completed` (con dimensione + durata + link audit), `backup_failed`, `restore_started`, `restore_completed`, `restore_failed`.
- **Pianificazione automatica** (`/app/backup-schedules`): scegli frequenza giornaliera/settimanale/mensile, ora UTC e quanti backup conservare. Puoi anche eseguire un backup pianificato on-demand.
- **Restore point-in-time**: nel restore scegli "Point-in-time (cloud, data/ora)" e indica la data esatta a cui tornare: il sistema usa lo snapshot pianificato più vicino e antecedente alla data scelta, dopo aver salvato un backup di sicurezza.
- **Audit Backup & Restore** (`/app/backup-audit`): consulta chi/quando/cosa per ogni backup e restore, filtra per data e organizzazione, esporta in **CSV** o **PDF**.
- **Audit abbonamenti**: la pagina super admin ora supporta filtri data + organizzazione ed export CSV/PDF.
- **Schemi di mapping per l'import**: nel wizard puoi esportare il mapping corrente come file `.mapping.json` e ricaricarlo agli import successivi (versionato `schema_version`).
- **Reset organizzazione (super admin)** (`/app/super-admin/reset-org`): cancella tutti i dati operativi di un'organizzazione (strutture, asset, ticket, contratti, ruoli, audit, backup). Restano l'organizzazione, l'owner e l'abbonamento. Operazione irreversibile, richiede digitazione del nome esatto e si consiglia il backup di sicurezza.

## Aggiornamento 2026-06-20 — Sincronizzazione robusta, notifiche e trial personalizzato

- **Sincronizzazione abbonamenti più sicura**: il super admin può usare "Sincronizza ora" senza rischio di esecuzioni doppie — un lock cooperativo impedisce sovrapposizioni; ogni esecuzione (manuale, cron, retry) viene registrata con stato, durata e numero di organizzazioni aggiornate.
- **Storico & retry**: nella pagina Piani il super admin vede la coda delle sincronizzazioni. Dai job falliti basta un click su **Retry** per rilanciarli.
- **Notifiche automatiche in-app**: quando il trial scade o un abbonamento passa a *Sola lettura*, owner e admin dell'organizzazione ricevono subito una notifica con link diretto alla pagina **Abbonamento & piano**.
- **Audit abbonamenti**: nuova voce di menu "Audit abbonamenti (super admin)" — elenco completo di chi ha forzato/esteso un piano, quando, vecchio→nuovo tier/stato, motivo.
- **Trial personalizzato per organizzazione**: dal pannello Piani, accanto a ciascuna organizzazione, il super admin può impostare una durata trial custom (0..3650 giorni) con motivo opzionale; banner e modalità sola lettura si aggiornano immediatamente.
# HotelOps — Manuale Utente

> Guida completa all'uso della piattaforma HotelOps per direttori, facility manager, manutentori, fornitori e personale di struttura.
> Documento vivo: aggiornato ad ogni iterazione (regola permanente).

## Aggiornamento 2026-06-20 — Backup, Restore & Import

Dalla voce di menu **Abbonamento → Backup, Restore & Import** (`/app/backup`) puoi:

1. **Scaricare un backup completo** della tua organizzazione in tre formati:
   - **JSON** — il formato re-importabile (consigliato per il restore).
   - **ZIP di CSV** — un file CSV per ogni gestione (utile per analisi esterna).
   - **Excel** — un foglio per gestione (leggibile da non tecnici).
2. **Ripristinare un backup** caricando un file JSON:
   - **Merge** (consigliato): aggiorna i record esistenti per ID, non cancella nulla.
   - **Replace**: cancella i dati attuali dell'organizzazione e ricarica quelli del backup. Per sicurezza devi digitare il nome esatto dell'organizzazione.
3. **Importare dati massivi da CSV / TXT** con il wizard guidato in 5 passi:
   1. Scegli la gestione (Asset, Fornitori, Contratti, Magazzino, Letture contatori, Ticket) e la struttura di destinazione.
   2. Carica il file: il delimitatore viene rilevato automaticamente (puoi forzarlo).
   3. Mappa le colonne del file ai campi del sistema (la mappatura iniziale è automatica per nome).
   4. Vedi l'anteprima delle prime righe, eventuali errori di validazione e il numero di righe da importare.
   5. Conferma e ricevi il riepilogo dell'esito.

Il **super_admin** dispone in più della pagina `/app/super-admin/backup` per operare su qualsiasi organizzazione e per scaricare un **backup globale** che contiene lo snapshot di tutte le organizzazioni.

**Aggiornamento 2026-06-20 — Abbonamenti**: la scadenza del trial 30 giorni e degli abbonamenti attivi viene rilevata automaticamente da un job che gira ogni ora; alla scadenza l'app passa in **sola lettura** senza intervento manuale. Il super admin può sempre forzare attivazione, blocco o estensione dalla pagina "Configurazione piani".

## Changelog
- **2026-06-20** — Aggiunto capitolo **Abbonamenti e livelli (Small/Medium/Large)**: come funziona il trial 30 giorni, cosa cambia tra i tre piani, come gestire upgrade/downgrade, cosa succede alla scadenza (sola lettura), come l'admin di organizzazione consulta `/app/billing` e come il super_admin configura prezzi e moduli in `/app/super-admin/plans`.
- **2026-06-20** — Il pulsante "Scarica PDF" in /manual produce ora un **PDF reale** con copertina, indice cliccabile, immagini e numerazione pagine. Nome file: `hotelops_manuale_utente_v{versione}_{data}.pdf`.
- **2026-06-20** — Prima edizione del Manuale Utente: 10 capitoli, FAQ, screenshot reali. Affiancato al Manuale Operativo (tecnico) già esistente.

---

## Indice

1. [Benvenuto in HotelOps](#1-benvenuto-in-hotelops)
2. [Primo accesso e onboarding](#2-primo-accesso-e-onboarding)
3. [Organizzazione, utenti e ruoli](#3-organizzazione-utenti-e-ruoli)
4. [Asset & Impianti — censire e gestire](#4-asset--impianti--censire-e-gestire)
5. [Ticketing — dal guasto alla risoluzione](#5-ticketing--dal-guasto-alla-risoluzione)
6. [SLA & Notifiche — non perdere mai una scadenza](#6-sla--notifiche--non-perdere-mai-una-scadenza)
7. [Manutenzione preventiva e fornitori](#7-manutenzione-preventiva-e-fornitori)
8. [Bollette, fatture e sostenibilità](#8-bollette-fatture-e-sostenibilità)
9. [Smart Inbox, report e TTS Speaker](#9-smart-inbox-report-e-tts-speaker)
10. [FAQ — domande frequenti](#10-faq--domande-frequenti)
11. [Glossario](#11-glossario)

---

## 1. Benvenuto in HotelOps

HotelOps è la piattaforma di **Building & Facility Management** per strutture alberghiere. In un'unica applicazione trovi:
- censimento impianti, attrezzature, ambienti;
- apertura e gestione ticket di manutenzione;
- gestione fornitori, contratti, ordini e magazzino;
- bollette con OCR AI e fatturazione elettronica SDI;
- dashboard direzionale, report ESG, notifiche multicanale.

### 1.1 A chi è rivolto
- **Direttore di struttura** — KPI, costi, conformità.
- **Facility manager** — pianificazione manutenzione, fornitori, contratti.
- **Manutentore interno** — ticket assegnati, intervention report, mobile.
- **Fornitore esterno** — portale dedicato, ordini e SLA contrattuali.
- **Economato** — magazzino, riordini, cassa.
- **Viewer / proprietà** — sola lettura, report ricevuti via email.

### 1.2 Come è organizzato questo manuale
Ogni capitolo segue lo schema **Obiettivo → Passi guidati → Suggerimenti → Errori comuni**. Le immagini mostrano la UI reale dell'applicazione. Quando vedi `/app/...` è un link che puoi aprire direttamente nell'app dopo aver fatto login.

---

## 2. Primo accesso e onboarding

**Obiettivo:** creare la tua organizzazione e configurare la prima struttura in meno di 10 minuti.

### 2.1 Registrazione
1. Apri la pagina `/auth`.
2. Inserisci **email**, **password** e **nome organizzazione** (es. "Hotel Bellavista Srl").
3. Conferma. Diventi automaticamente **owner** della tua organizzazione (max 6 utenti totali).

> Se hai ricevuto un invito via email apri prima il link `/invite/{token}` — non creare una nuova organizzazione, altrimenti l'invito viene ignorato.

### 2.2 Onboarding guidato
Al primo accesso si apre `/app/onboarding`. In 5 passi crei:
1. **Struttura** (nome, indirizzo, numero camere).
2. **Aree** standard (Reception, Cucina, Camere, Lavanderia, Centrale termica, Piscina…).
3. **Categorie asset** preimpostate (HVAC, Elettrico, Idraulico, Antincendio…).
4. **Primi utenti** invitati con ruolo e moduli delegati.
5. **Preferenze SLA** di default per la struttura.

### 2.3 Cosa fare subito dopo
- Stampa i **QR code** dei primi asset critici (caldaia, gruppi frigo, ascensore).
- Carica il logo della struttura in `/app/settings`.
- Imposta i **canali notifica** preferiti in `/app/notification-prefs`.

---

## 3. Organizzazione, utenti e ruoli

**Obiettivo:** invitare il team e assegnare permessi granulari senza esporre dati sensibili.

![Gestione organizzazione e inviti](/screens/multi-tenant-ruoli/org.png)

### 3.1 Modello multi-tenant
- Ogni organizzazione è **isolata** dalle altre (Row-Level Security sul database).
- Limite **6 utenti** (1 owner + 5 membri). Per più utenti contatta il supporto.
- L'owner può **trasferire la proprietà** a un altro membro in qualsiasi momento.

### 3.2 Ruoli applicativi
| Ruolo | Cosa può fare |
|---|---|
| `super_admin` | Solo staff HotelOps. Mai assegnato ai clienti. |
| `owner` | Tutto: gestisce organizzazione, fatturazione, utenti. |
| `admin` | Configura permessi, vede audit. |
| `direttore` | Vista direzionale, KPI, report, approvazioni. |
| `facility_manager` | Asset, ticket, manutenzione, fornitori. |
| `manutentore` | Ticket assegnati, intervention report, mobile. |
| `fornitore` | Portale fornitore, ordini, SLA contrattuali. |
| `economato` | Magazzino, riordini, cassa, fatture. |
| `viewer` | Sola lettura su moduli abilitati. |

### 3.3 Invitare un membro
1. Vai in `/app/organization` → **Invita membro**.
2. Inserisci email, ruolo applicativo, **moduli delegati** e **strutture** (singole o tutte).
3. Il sistema espande automaticamente le **dipendenze obbligatorie** (es. invitando *Work Orders* aggiunge *Tickets*, *Assets*, *Suppliers*).
4. Il membro riceve un link `/invite/{token}` valido 14 giorni.

### 3.4 Matrice permessi
![Matrice permessi utenti × moduli](/screens/multi-tenant-ruoli/matrix.png)

In `/app/permissions-matrix` vedi a colpo d'occhio chi ha accesso a cosa. Il **simulatore** mostra in tempo reale l'impatto di una modifica prima di applicarla. Ogni modifica viene tracciata in `/app/permission-audit` con diff before/after.

### 3.5 Errori comuni
- ❌ Invitare un manutentore con accesso a Fatture/Cassa — viola il principio del minimo privilegio.
- ❌ Trasferire la proprietà senza prima verificare che il destinatario abbia accettato l'invito.
- ❌ Disabilitare un modulo prerequisito: il sistema blocca l'operazione e mostra le dipendenze mancanti.

---

## 4. Asset & Impianti — censire e gestire

**Obiettivo:** avere una scheda completa per ogni impianto, scansionabile da QR.

![Elenco asset filtrabile](/screens/asset-impianti/list.png)

### 4.1 Modello dati
`Struttura → Area → Asset → Sotto-asset (opzionale)`. Ogni asset ha categoria, marca, modello, matricola, data di installazione, garanzia, fornitore di riferimento.

### 4.2 Aggiungere un asset (manuale)
1. `/app/assets` → **Nuovo asset**.
2. Compila scheda anagrafica, categoria, area.
3. Carica **foto**, **libretto d'uso** (PDF), **certificazioni**.
4. Salva. Il sistema genera automaticamente il **QR code stampabile**.

### 4.3 Aggiungere asset in massa (CSV)
- Scarica il template CSV dalla sezione **Import**.
- Compila in Excel o Google Sheets.
- Carica il file: il sistema valida riga per riga e mostra eventuali errori.

### 4.4 Scheda asset
![Scheda asset con storico, documenti e KPI](/screens/asset-impianti/detail.png)

La scheda mostra: anagrafica, **storico ticket**, **piani di manutenzione**, documenti, **KPI** (MTBF, MTTR, costo cumulato).

### 4.5 Stampare e applicare i QR
1. Dalla lista asset seleziona quelli da etichettare.
2. **Stampa QR** → PDF formato 70×40 mm pronto per etichettatrice.
3. Applica l'etichetta sull'apparecchiatura.
4. Da quel momento: scansione QR → apre direttamente la scheda asset e permette di aprire un ticket in 2 tap.

### 4.6 Errori comuni
- ❌ Saltare le foto: rendono la scheda inutile per chi non ha mai visto l'impianto.
- ❌ Non collegare il fornitore di riferimento → KPI fornitore e penali non funzionano.

---

## 5. Ticketing — dal guasto alla risoluzione

**Obiettivo:** ridurre i tempi di risposta e tracciare chi-fa-cosa-quando.

![Vista Kanban dei ticket](/screens/ticketing/kanban.png)

### 5.1 Aprire un ticket
Tre canali equivalenti:
- **Da QR**: scansiona, tocca *Apri ticket*, scegli categoria e priorità.
- **Da web**: `/app/tickets` → **Nuovo ticket**.
- **Da Smart Inbox**: a partire da una segnalazione ospite o da un alert.

Campi minimi: titolo, descrizione, asset (se applicabile), priorità (`bassa/media/alta/urgente`), categoria. Allegati foto/video opzionali.

### 5.2 Vista Kanban
Colonne: **Aperto · Assegnato · In corso · Risolto · Chiuso**. Trascina la card per cambiare stato; il sistema applica le regole di workflow e tiene traccia del tempo per stato.

### 5.3 Scheda ticket
![Scheda ticket con timeline, foto e rapporto](/screens/ticketing/detail.png)

- **Timeline** completa con commenti e cambi di stato.
- **Allegati** foto/video; possibilità di scattare direttamente da mobile.
- **Intervention report** PDF generato a chiusura, con firma digitale del tecnico.
- **Costi**: materiali (da magazzino), ore lavoro, costo fornitore.

### 5.4 Assegnazione a fornitore esterno
1. Apri la scheda ticket → **Assegna**.
2. Scegli fornitore dall'albo (filtrato per categoria e compliance valida).
3. Il fornitore riceve notifica e vede il ticket nel proprio **portale**.
4. SLA contrattuali del fornitore applicati automaticamente.

### 5.5 Errori comuni
- ❌ Aprire ticket senza asset collegato → impossibile misurare MTBF/MTTR.
- ❌ Chiudere senza compilare l'intervention report → audit incompleto.

---

## 6. SLA & Notifiche — non perdere mai una scadenza

**Obiettivo:** ricevere alert **prima** che lo SLA venga violato.

![Dashboard compliance SLA](/screens/sla-engine/compliance.png)

### 6.1 Come funziona lo SLA Engine
- Ogni ticket riceve uno SLA in base a **priorità** e **categoria**.
- Lo SLA ha due soglie: **tempo di presa in carico** e **tempo di risoluzione**.
- Il sistema invia **pre-allerta** in anticipo (es. 30 minuti prima della scadenza).
- Se lo SLA viene comunque violato → **escalation automatica** al ruolo superiore.

### 6.2 Preferenze personali
![Preferenze SLA per utente/struttura](/screens/sla-engine/settings.png)

In `/app/sla-settings` ogni utente sceglie:
- soglia di pre-allerta;
- intervallo dei reminder;
- canali (in-app, email, push);
- **orario silenzioso** (es. 22:00 – 07:00) per evitare disturbi notturni.

### 6.3 Compliance dashboard
Il direttore vede in `/app/sla` la percentuale di SLA rispettati, i top breach per categoria/fornitore e il trend mese su mese.

### 6.4 Template notifiche
In `/app/notifications` → tab **Template** puoi personalizzare il testo di email e messaggi push, con placeholder come `{{ticket_number}}`, `{{title}}`, `{{priority}}`, `{{delay_minutes}}`.

---

## 7. Manutenzione preventiva e fornitori

**Obiettivo:** prevenire i guasti e gestire i fornitori in modo strutturato.

### 7.1 Piani di manutenzione
![Piani di manutenzione attivi](/screens/manutenzione/plans.png)

1. `/app/maintenance` → **Nuovo piano**.
2. Seleziona asset, **frequenza** (mensile, trimestrale, semestrale, annuale).
3. Compila **checklist** dei punti di controllo obbligatori (es. pulizia filtri, verifica pressione, ricarica gas).
4. Salva: 7 giorni prima della scadenza il sistema genera automaticamente un **work order**.
5. Il tecnico esegue la checklist, allega foto, firma digitalmente.

### 7.2 Albo fornitori
![Albo fornitori con stato compliance](/screens/fornitori/list.png)

Per ogni fornitore: anagrafica, categorie servite, **stato compliance documentale** (DURC, assicurazione RC, certificazioni). Documenti in scadenza generano alert 30 giorni prima.

### 7.3 Contratti
![Contratti e scadenze](/screens/fornitori/contracts.png)

Per ogni contratto: oggetto, periodo, importo, **SLA contrattuali**, penali, allegato PDF. Notifica automatica per rinnovo o disdetta in tempo utile.

### 7.4 Ordini d'acquisto e di lavoro
- **PO (Purchase Order)** — acquisto materiali.
- **WO (Work Order)** — intervento da fornitore esterno o piano di manutenzione.
Entrambi tracciano stato, importi, documenti collegati.

### 7.5 Inventario & Riordini
![Magazzino con stato scorta](/screens/inventario/list.png)

`/app/inventory`: anagrafica articoli con scorta minima. Quando un movimento scarica un articolo sotto soglia, `/app/reorders` genera una **proposta di PO** al fornitore preferito; l'owner approva e l'ordine parte.

---

## 8. Bollette, fatture e sostenibilità

**Obiettivo:** azzerare il data entry, controllare i consumi, esportare per il commercialista.

### 8.1 Caricare una bolletta
![Upload bolletta con estrazione AI](/screens/bollette-ocr/upload.png)

1. `/app/invoices` → **Carica bolletta** (PDF, anche scansionato).
2. L'**OCR AI** estrae automaticamente: fornitore, periodo, importo, consumo, POD/PDR.
3. Controlla i campi proposti, conferma. La fattura viene archiviata e collegata al contratto fornitura.

### 8.2 Trend consumi (energia/acqua/gas)
![Trend consumi YoY](/screens/bollette-ocr/trend.png)

In `/app/trends` confronti l'anno corrente con il precedente per ogni utility. Anomalie evidenziate in rosso (es. consumo +30% rispetto allo stesso mese dell'anno scorso).

### 8.3 Sostenibilità & ESG
![Dashboard ESG per struttura](/screens/sostenibilita/esg.png)

`/app/sustainability`: KPI per camera/anno (kWh, mc d'acqua, Smc gas), confronto con target settoriali, export **report ESG** PDF per direzione o proprietà.

### 8.4 Fatturazione Elettronica SDI
Per le fatture attive: compila i dati, il sistema genera l'**XML SDI** conforme. Export periodico per il commercialista. Le fatture passive caricate via OCR sono già pronte per la registrazione contabile.

### 8.5 Cassa
`/app/cashbook`: prima nota con entrate/uscite, collegate a fatture e movimenti di magazzino. Export CSV/PDF.

---

## 9. Smart Inbox, report e TTS Speaker

**Obiettivo:** un unico flusso per tutto ciò che richiede attenzione.

### 9.1 Smart Inbox
![Smart Inbox con tutte le voci](/screens/smart-inbox/inbox.png)

`/app/smart-inbox` aggrega: ticket critici, SLA in pre-allerta o violati, scadenze contratti, accessi negati (con dipendenze mancanti), alert admin. Stati: **nuovo / letto / risolto**. Azioni rapide direttamente dall'inbox.

**Routine consigliata:** apri l'inbox a inizio turno, processa tutte le voci, imposta stato risolto man mano.

### 9.2 Report e overview direzionale
![Overview direzionale](/screens/report-statistiche/overview.png)

`/app/overview`: cruscotto con KPI di Housekeeping, segnalazioni ospiti, SLA, fatture, consumi. Filtri per periodo, export PDF.

### 9.3 Report Builder
![Report builder](/screens/report-statistiche/builder.png)

`/app/report-builder`: comporrre report ad-hoc trascinando blocchi (tabelle, grafici, KPI). Pianifica invio periodico via email a destinatari interni/esterni.

### 9.4 TTS Speaker
![Pannello speaker su tablet](/screens/tts-speaker/panel.png)

Pannello vocale per control room o reception: legge ad alta voce i ticket critici e gli SLA in violazione. Configura eventi annunciabili e **fascia di silenzio** notturna. Lingua: italiano naturale (Lovable AI).

### 9.5 Documenti vivi
![Documenti vivi nell'app](/screens/documenti-vivi/docs.png)

`/app/docs`: requisiti funzionali, non funzionali, manuale operativo (tecnico), manuale utente (questa guida), schema DB. Aggiornati ad ogni rilascio.

---

## 10. FAQ — domande frequenti

### Accesso e organizzazione

**D: Ho dimenticato la password.**
R: In `/auth` clicca *Password dimenticata*. Ricevi un link di reset via email.

**D: Posso avere più di 6 utenti?**
R: Il limite standard è 6. Per esigenze maggiori contatta il supporto.

**D: Voglio gestire più hotel.**
R: Sì: dalla stessa organizzazione crei più **strutture** in `/app/structures`. Ogni utente può essere abilitato su una, alcune o tutte le strutture.

**D: Come trasferisco la proprietà a un collega?**
R: `/app/organization` → **Trasferisci proprietà**. Il nuovo owner deve essere già membro.

### Asset e ticket

**D: Posso aprire un ticket senza essere loggato?**
R: Sì, se il QR è impostato come **pubblico**: ospiti e personale di reception aprono ticket senza login (`/g/{qr}`).

**D: Cosa succede se chiudo un ticket per sbaglio?**
R: Puoi riaprirlo dalla scheda. Tutte le azioni sono tracciate in audit.

**D: Come faccio a sapere quanto mi è costato un impianto?**
R: Nella scheda asset, sezione **KPI**: vedi costo cumulato (ticket + manutenzione + ricambi).

### SLA e notifiche

**D: Ricevo troppe email.**
R: `/app/notification-prefs`: scegli categorie, frequenza (immediata o digest) e fascia silenziosa.

**D: Lo SLA non si applica al mio fornitore.**
R: Verifica che il fornitore abbia uno **SLA contrattuale** definito in `/app/contracts`. In assenza si applica lo SLA di default della struttura.

### Fatture e ESG

**D: L'OCR ha sbagliato un campo.**
R: Correggi manualmente prima di confermare; il sistema impara dai feedback.

**D: Posso esportare le fatture per il commercialista?**
R: Sì, export XML SDI o CSV/PDF da `/app/invoices` → **Esporta**.

**D: Il consumo è molto più alto del solito, è un errore?**
R: Controlla la lettura sulla bolletta; se confermata, apri un ticket su asset HVAC/idraulico per indagine.

### Tecnici

**D: Funziona offline?**
R: Sì, come PWA installabile. Le operazioni offline vengono accodate in *outbox* e sincronizzate al ritorno della rete.

**D: I miei dati sono al sicuro?**
R: Database con **Row-Level Security** su ogni tabella: vedi solo i dati della tua organizzazione. Audit completo di accessi e modifiche.

---

## 11. Glossario

- **Asset** — qualunque impianto, attrezzatura o oggetto censito (caldaia, ascensore, pompa, ecc.).
- **Compliance documentale fornitore** — stato di validità di DURC, assicurazione, certificazioni.
- **Escalation** — passaggio automatico al ruolo superiore quando uno SLA è violato.
- **MTBF** — Mean Time Between Failures, tempo medio tra due guasti.
- **MTTR** — Mean Time To Repair, tempo medio di risoluzione.
- **OCR** — riconoscimento automatico testo da PDF/immagini.
- **PO** — Purchase Order, ordine d'acquisto.
- **PWA** — Progressive Web App, installabile come app su mobile/desktop.
- **RLS** — Row-Level Security, regole DB che filtrano i dati per organizzazione/utente.
- **SDI** — Sistema di Interscambio per fattura elettronica italiana.
- **SLA** — Service Level Agreement, soglie di tempo per presa in carico e risoluzione.
- **TTS** — Text-To-Speech, sintesi vocale.
- **WO** — Work Order, ordine di lavoro / intervento.

---

_HotelOps · Manuale Utente · Documento vivo_