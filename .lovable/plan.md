## Obiettivo

1. **Undo arredi**: cronologia locale per modifiche pos_x/pos_y/quantità con ripristino immediato resistente al realtime.
2. **Data Explorer generico**: pagina super-admin che genera CRUD list/detail per tutte le tabelle `public` (80+), con ricerca, paginazione, export CSV/JSON e stampa.

Realistico essere onesti: un CRUD "completo come quello strutture" su 80 tabelle non è fattibile in un'iterazione (form personalizzati, FK, validazioni di dominio). Costruisco invece un **generatore data-driven** che funziona per tutte le tabelle, con edit JSON form sicuro per i tipi base. Le pagine specializzate già esistenti (strutture, asset, ticket, ecc.) restano la via "ricca", il Data Explorer è la via "universale".

---

## Parte A — Undo arredi (RoomDetailDialog)

**Comportamento**
- Ogni modifica di `pos_x`, `pos_y`, `quantity` su `room_furnishings` viene tracciata in uno stack locale (max 50 voci) con `{id, field, prevValue, newValue, ts}`.
- Bottone "Annulla ultima modifica" (icona Undo + scorciatoia Ctrl/Cmd+Z) nella tab "Pianta" e in "Arredi & Mobilio".
- L'undo applica una mutation che ripristina il valore precedente. Il valore ripristinato viene anch'esso loggato come step undo (così è ripetibile in avanti tramite Redo, Ctrl+Shift+Z, stack a parte).
- **Resistente al realtime**: lo stack vive in `useRef`+`useState` locale, non viene resettato dalle invalidazioni di query. La mutation di ripristino sovrascrive il valore arrivato via realtime perché è una UPDATE successiva.
- Guardrail già esistenti (clamp 0–100, quantità ≥ 0) si applicano anche al ripristino.

**File**
- `src/components/structures/RoomDetailDialog.tsx`: aggiunta hook `useUndoStack`, wrapper sulle mutation `setPos` e `upd(quantity)`, UI bottoni Undo/Redo, listener tastiera.

Nessuna migrazione necessaria (storico solo client-side, scelta voluta per istantaneità; chi vuole storico persistente usa `audit_log`).

---

## Parte B — Data Explorer universale

**Rotte**
- `src/routes/_authenticated/app.data-explorer.index.tsx` — elenco tabelle (gruppi: Strutture & spazi, Asset, Ticket & SLA, Fornitori, Manutenzione, Inventario, Fatture, Sicurezza/Permessi, Notifiche, Sistema). Solo `super_admin`.
- `src/routes/_authenticated/app.data-explorer.$table.tsx` — list view con ricerca full-text su colonne testo, paginazione (50/pag), filtri per `structure_id` se presente, export CSV/JSON, stampa lista (window.print con stile dedicato), bottoni "Nuova riga" / "Modifica" / "Elimina".
- `src/routes/_authenticated/app.data-explorer.$table.$id.tsx` — detail/edit view: form generato da introspezione colonne (text/number/boolean/timestamp/uuid/jsonb=textarea JSON), bottone Stampa scheda, Elimina.

**Backend**
- Server functions in `src/lib/data-explorer.functions.ts` con `requireSupabaseAuth`:
  - `listTables()`: ritorna whitelist tabelle con metadati (colonne, tipi, PK, FK, has_structure_id).
  - `listRows({ table, q, page, pageSize, structureId, orderBy })`.
  - `getRow({ table, id })`.
  - `upsertRow({ table, id?, values })`.
  - `deleteRow({ table, id })`.
- Tutte controllano `has_role(auth.uid(),'super_admin')`. Tabelle e colonne validate contro whitelist statica per impedire SQL injection (uso solo `supabase.from(table)` con `table` ∈ whitelist).
- Metadati colonne letti via query a `information_schema.columns` (server-only) e cache in memoria.

**UI**
- Componente `<DataTable>` riutilizzabile (Tailwind + shadcn Table) con header sortable, search input debounced, paginator.
- Export CSV: utility in `src/lib/data-explorer-export.ts` (papaparse-style manuale, già abbiamo `csv-export.ts` da riusare).
- Stampa: classe `print:` Tailwind + `@media print` minimale in `src/styles.css`.

**Sidebar**
- Voce "Data Explorer" sotto sezione Sistema, visibile solo a super_admin.

**Limiti dichiarati nell'header della pagina**
- Editing JSON-form generico: niente validazioni di dominio (date format libero, enum come testo). Per workflow ricchi usare le pagine dedicate.
- RLS rispettata: il super_admin vede tutto comunque per via di `has_role(super_admin)` nelle policy esistenti.
- Tabelle di sistema sensibili (`audit_log`, `permission_audit`, `delegation_audit`, `backup_runs`) in sola lettura.

---

## Dettagli tecnici

```text
src/
├── components/
│   ├── data-explorer/
│   │   ├── DataTable.tsx          # tabella + ricerca + paginazione
│   │   ├── RowForm.tsx            # form generato da metadati
│   │   ├── PrintView.tsx          # layout stampa lista/scheda
│   │   └── tables-catalog.ts      # whitelist + raggruppamento + read-only flags
│   └── structures/
│       └── RoomDetailDialog.tsx   # +useUndoStack, bottoni Undo/Redo, Ctrl+Z
├── lib/
│   ├── data-explorer.functions.ts # serverFn list/get/upsert/delete
│   └── data-explorer-export.ts    # CSV/JSON export
└── routes/_authenticated/
    ├── app.data-explorer.index.tsx
    ├── app.data-explorer.$table.tsx
    └── app.data-explorer.$table.$id.tsx
```

Aggiorno docs (REQUISITI_FUNZIONALI, MANUALE_OPERATIVO, MANUALE_UTENTE, BROCHURE, features-catalog) come da regola permanente.

Nessuna migrazione SQL: tutto passa per RLS esistenti + ruolo super_admin. Se in fase di test scopro tabelle che mancano di GRANT sulle policy super_admin, aggiungo migrazione minima.

---

## Conferma necessaria

Procedo come sopra? Due note:
- L'Undo è solo in sessione (non sopravvive al refresh). Se vuoi undo persistente cross-sessione lo costruiamo dopo su `audit_log`.
- Il Data Explorer è uno strumento da super-admin: non lo esponiamo ai ruoli operativi per evitare bypass delle UI dedicate.
