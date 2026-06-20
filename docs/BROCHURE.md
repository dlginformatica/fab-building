# HotelOps — Brochure commerciale (sorgente)

> Documento sorgente per la brochure. La versione HTML stampabile e PDF è disponibile su `/brochure`.
> Aggiornato ad ogni iterazione (regola permanente).

## Changelog
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