<!-- changelog 2026-06-20 -->
- **Tipologie camere**: aggiunte colonne `category` e `description`; UI con form di modifica completo (crea/edita/elimina), categoria scelta da elenco predefinito modificabile (Standard, Deluxe, Junior Suite, Suite, Garden Suite, Monolocale, Bilocale) con possibilità di aggiungere nuovi valori liberi.
- **Camere — Pianta & Arredi**: nuova scheda di dettaglio camera con upload pianta (bucket `structure-photos`, path `<structure_id>/rooms/<room_id>/...`), viewer con zoom/pan; nuova tabella `room_furnishings` (kind mobilio/arredo/accessorio, name, locale, quantity, notes, pos_x/pos_y) org-scoped via `has_structure_access`/`is_org_admin`; segnaposti percentuali sulla pianta, evidenziazione bidirezionale lista↔pianta.

<!-- changelog 2026-06-20 -->
- Nuova **gestione completa Strutture** (/app/structures/$id) con tab: Anagrafica editabile, Camere & Piani (CRUD + preset rapido), Tipologie camere (nuova tabella `room_types` org-scoped), Galleria foto (bucket privato `structure-photos`, RLS per struttura), Mappa OpenStreetMap (react-leaflet) con geocodifica Nominatim, marker draggable, salvataggio coordinate `lat`/`lng` su `structures`.

<!-- changelog 2026-06-20 -->
- Seed dati demo completo (2 organizzazioni Hotel Demo A/B isolate, 16 utenti uno per ruolo, strutture, asset, fornitori, contratti, magazzino, contatori, ticket con SLA, abbonamenti) e checklist passo-passo in `docs/CHECKLIST_TEST_UMANO.md` per il primo test umano. Password demo: `Demo1234!`.
- Verificato isolamento multi-tenant via `has_structure_access`: ogni utente vede solo i dati della propria struttura/org; super admin vede tutto.

<!-- changelog 2026-06-20 -->
- Numero di build (`yyyy.mm.dd.hh.mm`) ora presente anche nei footer di: CSV esportati (riga finale), PDF esportati (footer di ogni pagina), PDF Manuale Utente, anteprima HTML stampabile, e nuovo helper `emailFooterHtml/Text` per i template email.

<!-- changelog 2026-06-20 -->
- Nuova pagina **Notifiche backup** (/app/backup-notification-prefs): owner/admin gestiscono canali (email/in-app), eventi (start/success/failure/integrità), destinatari, frequenza (immediata/digest orario/giornaliero) e fascia oraria di silenzio.
- Build number visibile in basso a destra di ogni schermata nel formato `yyyy.mm.dd.hh.mm` (UTC) per supporto e tracciabilità versioni.

### Backup cloud, point-in-time & reset (2026-06-20)
- **Backup cloud** dell'organizzazione con archivio privato, audit completo (chi/quando/righe/dimensione/versione schema) e storico consultabile.
- **Pianificazione automatica** con frequenza configurabile (giornaliera/settimanale/mensile), ora e retention con auto-purge.
- **2026-06-20 — Fase 21.3 · Integrità backup, progress restore, notifiche backup/restore**: RF-BCK-16 ogni backup nel cloud calcola un **hash SHA-256** dello snapshot (`backup_runs.integrity_hash`, `integrity_status`, `verified_at`, `duration_ms`); pulsante "Verifica integrità" su ogni riga dello storico ricalcola l'hash dal file storage e marca lo stato (`verified` / `mismatch` / `missing` / `error`). I backup non ripristinabili (`mismatch`/`missing`) nascondono il bottone di restore. RF-BCK-17 il restore point-in-time mostra **barra di avanzamento** con step (Ricerca → Download → Pre-restore → Restore replace → Finalizzazione); ogni step viene salvato su `restore_runs.steps_total`, `steps_done`, `current_step` ed è consultabile in `/app/backup-audit`. RF-BCK-18 nuove notifiche in-app per owner/admin via RPC `notify_org_admins`: `backup_started`, `backup_completed` (con dimensione + durata + link audit), `backup_failed`, `restore_started`, `restore_completed`, `restore_failed`.
- **Restore point-in-time**: ripristina lo stato a una data/ora specifica usando lo snapshot più vicino, con backup di sicurezza preventivo.
- **Audit Backup & Restore** consultabile da admin e super admin con filtri data/organizzazione ed export **CSV/PDF**.
- **Schemi di mapping import versionati** scaricabili e ricaricabili per gestire cambi di formato dei file CSV/TXT.
- **Reset organizzazione** riservato al super admin: azzera tutti i dati di una qualunque organizzazione (compresa la propria) con doppia conferma.

### Sincronizzazione robusta + audit abbonamenti (2026-06-20)
- Lock cooperativo sulla sincronizzazione automatica/manuale, coda visibile con stato e tasto Retry.
- Notifiche in-app a fine trial / scadenza abbonamento con link diretto alla pagina di gestione piano.
- Pagina di audit dedicata: ogni forzatura/proroga registrata (chi, quando, vecchio→nuovo, motivo).
- Trial personalizzato per organizzazione (0..3650 giorni) impostabile dal super admin con aggiornamento istantaneo del banner.
# HotelOps — Brochure commerciale (sorgente)

> Documento sorgente per la brochure. La versione HTML stampabile e PDF è disponibile su `/brochure`.
> Aggiornato ad ogni iterazione (regola permanente).

### Backup, Restore & Import guidato (2026-06-20)
- Backup completo dell'organizzazione in **JSON / ZIP-di-CSV / Excel** scaricabile direttamente dal browser.
- Restore da JSON in modalità **Merge** o **Replace** (con conferma testuale per evitare cancellazioni accidentali).
- **Wizard di import CSV/TXT** in 5 step (gestione → file → mappatura → preview/validazione → fine) con auto-detect del delimitatore, mapping automatico per nome e validazione dei tipi.
- Super_admin: backup globale di tutte le organizzazioni in un singolo file JSON.

**Novità 2026-06-20**: scadenze trial e abbonamenti gestite automaticamente da job orario (passaggio a sola lettura senza intervento). Il super admin può forzare attivazione/blocco/proroghe in qualsiasi momento.

## Changelog
- **2026-06-20** — Introdotti tre piani **Small / Medium / Large** (default 200/400/800 €/mese, configurabili dal super_admin) con **30 giorni di prova gratuita** in modalità Large; alla scadenza l'account passa in sola lettura fino al rinnovo. Pagamento manuale in Fase 1, integrazione Stripe in Fase 2.
- **2026-06-20** — Introdotto **Manuale Utente** completo (10 capitoli, FAQ, glossario, screenshot reali) accessibile da `/manual` con toggle Utente/Tecnico.
- **2026-06-20** — Screenshot reali completi per tutti i 13 moduli (compresi asset detail, ticket detail, TTS speaker panel, documenti, trend YoY, report builder). Routing detail pages risolto.
- **2026-06-20** — Prima edizione completa, 13 moduli documentati, pagine pubbliche `/features`, `/features/:slug`, `/manual`, `/brochure`.

## Visione
HotelOps unifica tutto il facility management di un hotel o di una catena alberghiera in una piattaforma multi-tenant, multi-struttura. Pensata per chi vive davvero il backoffice e la sala macchine: direttori, facility manager, manutentori, fornitori, economato.

## Pillar
- **Multi-tenant nativo** — organizzazioni isolate con RLS, fino a 6 utenti per organizzazione, deleghe granulari per modulo/struttura.
- **Mobile-first** — QR sugli asset, PWA installabile, modalità offline con outbox.
- **AI dove serve** — OCR bollette, classificazione, TTS speaker per emergenze.
- **Conformità IT** — fatturazione SDI, audit log completo, accessi negati tracciati.
- **Documenti vivi** — requisiti, manuale e brochure aggiornati ad ogni iterazione.

## Moduli (4 categorie)

### Operatività quotidiana
- Asset & Impianti
- Trouble Ticketing
- SLA Engine
- TTS Speaker
- Manutenzione preventiva
- Inventario & Riordini

### Governance & Sicurezza
- Multi-tenant, Organizzazioni & Ruoli
- Documenti vivi
- Fornitori & Contratti

### Finanza & Compliance
- Bollette & Fatture (OCR + SDI)

### Intelligenza & Reporting
- Smart Inbox & Notifiche
- Sostenibilità & ESG
- Report, Statistiche & Export

## Sicurezza & conformità
- Row-Level Security su tutte le tabelle pubbliche.
- Ruoli applicativi: super_admin, owner, admin, direttore, facility_manager, manutentore, fornitore, economato, viewer.
- Audit completo (permessi, deleghe, fatture, contratti, cassa).
- Fatturazione elettronica SDI nativa.

## Contatti & prossimi passi
1. Registrazione → crea organizzazione.
2. Onboarding guidato struttura in 5 minuti.
3. Invita team (max 5 membri) con ruoli e deleghe granulari.
4. Operatività in giornata.

_HotelOps · Building & Facility Management_