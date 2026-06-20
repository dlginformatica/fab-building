# Checklist Test Umano — HotelOps

> Documento generato automaticamente dopo il seed dei dati demo del 2026-06-20.
> Esegui i test nell'ordine indicato. Ogni riga = un click test.
> Risultato atteso ✓ = funziona; ✗ = bug, segnalalo al team.

## 0. Credenziali demo

Password comune per tutti gli account demo: **`Demo1234!`**

### Hotel Demo A (abbonamento Large attivo, sede Milano)

| Email                       | Ruolo app           | Ruolo org |
|-----------------------------|---------------------|-----------|
| `ownerA@demo.hotelops`      | direttore           | owner     |
| `adminA@demo.hotelops`      | direttore           | admin     |
| `direttoreA@demo.hotelops`  | direttore           | member    |
| `fmA@demo.hotelops`         | facility_manager    | member    |
| `manutA@demo.hotelops`      | manutentore         | member    |
| `fornitoreA@demo.hotelops`  | fornitore           | member    |
| `economatoA@demo.hotelops`  | economato           | member    |
| `viewerA@demo.hotelops`     | viewer              | member    |

### Hotel Demo B (in trial, sede Roma)

Stessa convenzione con suffisso `B` (es. `ownerB@demo.hotelops`, `manutB@demo.hotelops`, ...).

### Super admin

`info@dlginformatica.it` (già esistente) — vede tutte e tre le organizzazioni.

---

## 1. Login & navigazione base
- [ ] Login con `ownerA@demo.hotelops` → atterra su `/app`
- [ ] Topbar mostra dropdown struttura con "Hotel Demo A - Sede Centrale"
- [ ] Footer in basso a destra mostra `build YYYY.MM.DD.HH.MM`
- [ ] Logout funziona e torna a `/auth`

## 2. Isolamento multi-tenant (3 prove)
- [ ] Login `ownerA`: in `/app/tickets` vedi 3 ticket A, nessuno di B
- [ ] Logout; login `ownerB`: in `/app/tickets` vedi 3 ticket B, nessuno di A
- [ ] Login `info@dlginformatica.it`: in `/app/tickets` vedi entrambe le serie

## 3. Dashboard & KPI
- [ ] `ownerA` su `/app`: KPI "Asset totali" ≥ 2, "Ticket aperti" ≥ 2, "Ticket scaduti" ≥ 1
- [ ] Stessa pagina come `ownerB`: numeri diversi (Asset 1, Ticket aperti 2)
- [ ] `/app/structure-kpi` mostra grafici per la struttura selezionata

## 4. Ticket & SLA (≥3 prove)
- [ ] `ownerA` apre "Chiller perde acqua" (risolto) → SLA scaduto = false, compliance OK
- [ ] Crea un nuovo ticket priorità "critica" → SLA `ack_due_at` ≈ +15 min, `resolve_due_at` ≈ +60 min
- [ ] Cambia stato del ticket a "in_corso" → audit log popolato (`/app/audit`)
- [ ] Su `/app/sla-compliance` vedi 1 riga "critica" con resolve 100%
- [ ] Su `/app/sla-escalations` definisci una regola livello 1 → 30 min, ruolo `facility_manager`
- [ ] Su un ticket aperto da >SLA → conta tra "Overdue"

## 5. Asset & manutenzione
- [ ] `/app/assets` come `fmA`: vedi 2 asset Demo A
- [ ] Apri "Chiller Reception" → tab Storico mostra ticket collegati
- [ ] Genera QR per l'asset (pulsante "QR") → `qr_token` rigenerato, audit `/app/audit` registra
- [ ] `/app/maintenance` crea un piano "Manut. trimestrale chiller" su Chiller → task pendente creato

## 6. Fornitori, contratti, compliance
- [ ] `/app/suppliers` come `economatoA`: vedi "Climatech Srl"
- [ ] `/app/contracts` su CTR-A-001: end_date = oggi+45gg, `auto_renew=true`
- [ ] Imposta `notice_period_days=60` → su `/app/alerts` o widget appare alert "contratto in scadenza"
- [ ] `/app/suppliers-compliance` lista DURC/HACCP/assicurazione (se valorizzati)

## 7. Magazzino & riordini
- [ ] `/app/inventory` `economatoA`: 2 articoli, "Lampada LED 9W" sotto-scorta (3 < 10)
- [ ] `/app/reorders` mostra 1 richiesta `da_approvare` per Lampada LED
- [ ] Approva → stato passa a `approvato`; trigger logga in `reorder_events`
- [ ] Crea un movimento manuale (scarico 2 pz su Filtro G4) → quantità 12 → 10

## 8. Bollette, contatori, prima nota
- [ ] `/app/utilities` come `economatoA`: vedi "Contatore generale" (kWh)
- [ ] Aggiungi una lettura odierna (es. 13500) → consumo 80 kWh dal precedente
- [ ] `/app/invoices`: vedi INV-A-2025-0001 da pagare; segnala "pagata" → `paid_at=oggi`
- [ ] `/app/cashbook` registra un movimento cassa di test

## 9. Housekeeping & camere
- [ ] `/app/housekeeping` `direttoreA`: 4 camere "clean"
- [ ] Imposta "Camera 101" → "dirty" → conta cambia in dashboard housekeeping
- [ ] Crea task pulizia → assegna a `manutA` → manutA vede in dashboard

## 10. Permessi & deleghe
- [ ] `/app/permissions` come `adminA`: crea regola "manutentore può vedere `assets`" → `manutA` non perde accesso
- [ ] `/app/delegations` come `ownerA`: delega `viewerA` a vedere modulo `tickets` per 1 ora → `viewerA` ora vede ticket
- [ ] `/app/permission-audit` mostra la delega + chi l'ha creata
- [ ] Revoca delega → `viewerA` torna a non vedere ticket

## 11. Abbonamento (super_admin)
- [ ] Login `info@dlginformatica.it`
- [ ] `/app/super-admin/plans` mostra "Hotel Demo A" tier large active, "Hotel Demo B" tier small trial
- [ ] Forza Hotel Demo B → status `readonly`. Login `ownerB` → banner sola lettura visibile, niente write
- [ ] `/app/super-admin/subscription-audit` mostra l'azione di override con motivo
- [ ] Estendi trial di B di +30 giorni → trial_ends_at aggiornato → `ownerB` torna in trial
- [ ] Esporta CSV/PDF audit abbonamenti

## 12. Backup, restore & schedule
- [ ] `ownerA` su `/app/backup`: clicca "Backup ora" → riga in audit con hash integrità e dimensione
- [ ] Verifica integrità → stato `verified`
- [ ] `/app/backup-schedules` crea schedule giornaliero alle 02:00 UTC retention 7
- [ ] `/app/backup-notification-prefs` disabilita email, mantieni in-app; aggiungi `direttoreA@demo.hotelops` come destinatario aggiuntivo
- [ ] Avvia restore point-in-time su data ieri → progress bar mostra steps, stato `success` o `partial`
- [ ] `/app/backup-audit` mostra backup + restore con durata
- [ ] Su `super_admin`: `/app/super-admin/reset-org` su "Hotel Demo B" → digita esattamente "Hotel Demo B" → reset OK (verifica B sia svuotata; org e owner restano)

## 13. Notifiche & alert
- [ ] Bell topbar mostra alert se ci sono ticket overdue
- [ ] `/app/notifications` configurare canale email + template SLA violato
- [ ] `/app/alerts` lista scadenze contratti/fatture/forniture

## 14. Reportistica & export
- [ ] `/app/reports` lancia "SLA compliance ultimi 30g" struttura A
- [ ] Esporta CSV → riga finale contiene `# HotelOps · build YYYY.MM.DD.HH.MM`
- [ ] Esporta PDF → footer di ogni pagina contiene `build YYYY.MM.DD.HH.MM`
- [ ] `/app/report-builder` crea template custom

## 15. PWA & offline
- [ ] Installa app come PWA da browser
- [ ] Apri offline → toast "offline" + bottoni readonly
- [ ] Crea ticket offline → outbox; torna online → flush automatico

## 16. Brochure, manuali, /features
- [ ] `/brochure` apre HTML stampabile + bottone download PDF
- [ ] `/features` mostra catalogo moduli
- [ ] `/features/backup` (o altro slug) mostra dettaglio modulo
- [ ] `/manual` vista "Manuale Utente" e "Manuale Operativo" affiancati; PDF scaricabile

---

## Difetti noti / da verificare manualmente
- `dashboard_structure_kpi` ritorna correttamente solo quando l'utente è loggato (filtra per `auth.uid()`).
- L'invio email reale dipende da provider non ancora configurato — verifica solo che la notifica in-app compaia.
- Reset organizzazione non rimuove i file in storage `org-backups`: vanno puliti dal pulsante "Pulisci storage" in `/app/super-admin/reset-org` dopo il reset DB.

