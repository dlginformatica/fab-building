… (piano di lavoro)

# Piano: Fase 7 — Consolidamento + nuovi moduli

Lo scope richiesto è molto ampio. Propongo di spezzarlo in **6 sotto-fasi** consegnate in turni separati (un singolo turno non basta per qualità e test). Confermami l'ordine o riordina.

## 7.1 — Manutenzione programmata evoluta (1 turno)
- Vista **calendario** mensile/settimanale dei piani (drag & drop date)
- **Checklist operatore** runtime: apertura task da calendario, spunta voci, foto, firma, generazione automatica `maintenance_tasks` + `ticket_reports`
- **Storico interventi** per asset/piano con filtri (periodo, esito, operatore, fornitore)
- Notifiche scadenze + escalation se task non chiuso

## 7.2 — Workflow engine procedure (1 turno)
- Tabelle `workflows`, `workflow_steps`, `workflow_instances`, `workflow_transitions`
- Editor visuale step (tipo: approvazione, azione, attesa, condizione, notifica)
- Trigger: apertura ticket, scadenza contratto, fattura ricevuta, evento manuale
- Audit completo, SLA per step, deleghe

## 7.3 — OCR fatture + scadenzario (1 turno)
- Upload PDF/immagine fattura → Lovable AI Gateway (`google/gemini-2.5-flash`) per estrazione strutturata (fornitore, numero, data, importi, IVA, righe, IBAN)
- Matching automatico fornitore/contratto/centro costo
- Conferma manuale dei campi estratti, salvataggio in `invoices`
- Scadenzario pagamenti con alert

## 7.4 — Integrazioni Email + Microsoft Teams (1 turno)
- **Email**: Lovable Emails (dominio mittente, queue, templates) per notifiche ticket/SLA/fatture, digest giornaliero direttore
- **Teams**: connettore standard → invio messaggi a canale per ticket critici, SLA violati, ordini approvati
- Configurazione per struttura (canale Teams, indirizzi destinatari, eventi attivi)

## 7.5 — App mobile (PWA) role-aware (1 turno)
- PWA installabile (manifest + icone) con layout mobile-first dedicato a `/m/*`
- **Comportamento differenziato per ruolo**:
  - **Manutentore**: scansiona QR, vede task del giorno, apre/chiude ticket, firma rapportini, foto
  - **Fornitore**: portale ordini, accettazione interventi, upload documenti firmati
  - **Gestore/Direttore**: dashboard KPI, approvazioni rapide, alert SLA
  - **Agente AI**: chat assistant inline (concierge/sla/procurement)
- **Profilo configurabile**: scelta widget home, notifiche push, lingua, tema, scorciatoie preferite
- Push notifications via FCM (richiede config utente)

## 7.6 — Consolidamento + QA (1 turno)
- Audit UI completa: link rotti, route inesistenti, label incoerenti, viewport mobile, dark/light
- Suite test Vitest per server functions critiche (auth, SLA, workflow, OCR, scheduler, agent)
- Smoke test routing + permessi per ogni ruolo
- Fix di tutto quello che emerge

## Documenti (regola permanente)
Ad **ogni** sotto-fase aggiorno con changelog datato:
- `docs/REQUISITI_FUNZIONALI.md`
- `docs/REQUISITI_NON_FUNZIONALI.md`
- `docs/MANUALE_OPERATIVO.md`
- **NUOVO**: `docs/SCHEMA_DB.md` — schema completo (tabelle, colonne, FK, RLS, funzioni, trigger, bucket storage) rigenerato a ogni migration

## Domanda di scope
1. Confermi le 6 sotto-fasi nell'ordine proposto (7.1 → 7.6)?
2. Per Teams: usi già Microsoft 365 aziendale? Serve che configuri il connettore standard (richiede tue credenziali al momento dell'attivazione)?
3. Per Email: vuoi che attivi subito Lovable Emails con un sottodominio (es. `notify.tuodominio.it`) o partiamo con dominio di test?
4. Per OCR: ok usare Lovable AI (Gemini) gratuito incluso, oppure preferisci un servizio OCR dedicato (es. Mindee, AWS Textract)?

Dimmi "vai con 7.1" (o l'ordine che preferisci) e procedo turno per turno.
