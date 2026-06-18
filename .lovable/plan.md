# Piano: HotelOps — Building & Facility Management

Applicazione completa per la gestione di impianti, facilities, fornitori, contratti, SLA, asset, bollette/fatture e ticketing di strutture alberghiere. Multi-tenant (più hotel), ruoli, TTS sul Trouble Ticketing, modulo messaggistica adattato da "Penelope Course Manager".

Visto lo scope enorme, lavoreremo in **fasi incrementali**. In questa prima iterazione costruisco le fondamenta + i 2 moduli core; gli altri seguono nei turni successivi (puoi sempre dirmi "passa alla Fase X" o "prima fai Y").

---

## Stack & fondamenta (Fase 0 — adesso)

- TanStack Start + Tailwind v4 + shadcn (già nel template)
- **Lovable Cloud** abilitato → DB Postgres, Auth (email/password + Google), Storage per documenti/foto asset, server functions
- Design system: palette professionale "facility ops" (blu petrolio + ambra per alert SLA), font Inter/Space Grotesk, dark mode
- Auth multi-tenant: tabella `organizations` (hotel/gruppi), `memberships` (user↔org↔ruolo)
- Ruoli (tabella `user_roles` separata): `super_admin`, `direttore`, `facility_manager`, `manutentore`, `fornitore`, `economato`, `viewer`
- Layout: sidebar con switcher struttura, topbar con notifiche/messaggi/profilo

## Moduli applicativi

**Fase 1 — Asset & Trouble Ticketing + TTS** *(prima release operativa)*
- **Asset & Impianti**: anagrafica, categorie (HVAC, idraulico, elettrico, ascensori, cucine, lavanderia, antincendio, piscine, TV/Wi-Fi…), ubicazione (struttura→piano→stanza/area), QR code stampabile, foto, schede tecniche, manuali, garanzie, lifecycle
- **Trouble Ticketing**: apertura ticket (anche via QR), priorità, assegnazione, stati workflow, foto, commenti, timeline, escalation
- **TTS** (Lovable AI Gateway `openai/gpt-4o-mini-tts`): lettura vocale automatica di ticket urgenti/critici, alert SLA in violazione, notifiche turno; pannello "speaker" con coda audio + voce configurabile per ruolo
- **SLA engine**: regole per priorità/categoria/contratto, tempi di presa in carico e risoluzione, countdown live, alert pre-violazione, KPI

**Fase 2 — Fornitori, Contratti, SLA contrattuali**
- Anagrafica fornitori (categorie servizio, referenti, documenti DURC/assicurazioni con scadenze)
- Contratti (canone/consumo/intervento, allegati, rinnovi automatici, SLA legati)
- Portale fornitore (login dedicato, vede solo i suoi ticket/ordini)
- Ordini di lavoro & rapportini intervento firmabili

**Fase 3 — Manutenzione programmata & Materiali**
- Piani manutenzione preventiva (calendario ricorrente, checklist)
- Magazzino ricambi (giacenze, minimi, movimenti, scarico su intervento)
- Ordini d'acquisto

**Fase 4 — Bollette & Fatture**
- Utenze (luce, gas, acqua, gasolio) con letture contatori
- Fatture passive (OCR upload PDF → estrazione), scadenzario pagamenti
- Centri di costo per struttura/reparto, report consumi & spending

**Fase 5 — Messaggistica multi-agente** (adattata da Penelope)
- Porting di `pages/admin/Messaggistica.tsx` + componenti correlati dal progetto Penelope (stack classico → TanStack), riadattando entità: destinatari = membri struttura, fornitori, gruppi per ruolo
- Conversazioni 1:1 e di gruppo legate a ticket/contratto
- Agenti AI multi-ruolo (Concierge tecnico, SLA Watcher, Procurement assistant) con tools per cercare asset, aprire ticket, leggere contratti

**Fase 6 — Dashboard direzionale, report PDF/Excel, mobile-friendly, audit log**

---

## Documenti vivi (impegno permanente)

Memorizzo come regola permanente: **a ogni interazione** (anche micro-modifica) aggiorno i tre documenti:
- `docs/REQUISITI_FUNZIONALI.md`
- `docs/REQUISITI_NON_FUNZIONALI.md`
- `docs/MANUALE_OPERATIVO.md`

Versionati con changelog in testa (data + sintesi modifica). Li creo subito in Fase 0 con il contenuto iniziale e li mantengo allineati.

---

## Cosa faccio in questo turno (Fase 0 + 1)

1. Abilito Lovable Cloud
2. Salvo la regola permanente in memoria progetto
3. Creo design system + layout app con sidebar/topbar
4. Auth (email/password + Google) + multi-tenant + ruoli
5. Modulo **Asset & Impianti** (CRUD + QR + foto + filtri)
6. Modulo **Trouble Ticketing** con SLA engine base
7. **TTS** integrato sui ticket urgenti / alert SLA (Lovable AI Gateway)
8. I 3 documenti `docs/*.md` inizializzati

Fasi 2–6 nei turni successivi. Confermi questo piano e procedo?
