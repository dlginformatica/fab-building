// Catalogo tabelle esposte dal Data Explorer.
// Sicurezza: solo le tabelle elencate qui sono interrogabili dal Data Explorer.
// L'accesso effettivo resta governato dalle RLS (super_admin vede tutto).

export type TableEntry = {
  name: string;
  label: string;
  group: string;
  readonly?: boolean;       // niente create/update/delete dalla UI
  hideDelete?: boolean;     // niente delete dalla UI
  hint?: string;
};

export const DATA_EXPLORER_TABLES: TableEntry[] = [
  // Strutture & spazi
  { name: "organizations", label: "Organizzazioni", group: "Strutture & spazi" },
  { name: "structures", label: "Strutture", group: "Strutture & spazi" },
  { name: "structure_photos", label: "Foto struttura", group: "Strutture & spazi" },
  { name: "floors", label: "Piani", group: "Strutture & spazi" },
  { name: "rooms", label: "Camere", group: "Strutture & spazi" },
  { name: "room_types", label: "Tipologie camere", group: "Strutture & spazi" },
  { name: "room_type_categories", label: "Categorie tipologie", group: "Strutture & spazi" },
  { name: "room_furnishings", label: "Arredi camera", group: "Strutture & spazi" },
  { name: "housekeeping_tasks", label: "Task housekeeping", group: "Strutture & spazi" },
  { name: "guest_issues", label: "Segnalazioni ospiti", group: "Strutture & spazi" },
  // Asset
  { name: "assets", label: "Asset & impianti", group: "Asset" },
  { name: "asset_categories", label: "Categorie asset", group: "Asset" },
  { name: "asset_documents", label: "Documenti asset", group: "Asset" },
  { name: "asset_media", label: "Media asset", group: "Asset" },
  { name: "asset_history", label: "Storico asset", group: "Asset", readonly: true },
  { name: "asset_scans", label: "Scansioni QR", group: "Asset", readonly: true },
  { name: "asset_qr_audit", label: "Audit QR asset", group: "Asset", readonly: true },
  // Ticket & SLA
  { name: "tickets", label: "Ticket", group: "Ticket & SLA" },
  { name: "ticket_attachments", label: "Allegati ticket", group: "Ticket & SLA" },
  { name: "ticket_comments", label: "Commenti ticket", group: "Ticket & SLA" },
  { name: "ticket_reports", label: "Report intervento", group: "Ticket & SLA" },
  { name: "sla_rules", label: "Regole SLA", group: "Ticket & SLA" },
  { name: "sla_escalation_rules", label: "Escalation SLA", group: "Ticket & SLA" },
  { name: "sla_notifications", label: "Notifiche SLA", group: "Ticket & SLA" },
  { name: "sla_violations", label: "Violazioni SLA", group: "Ticket & SLA" },
  { name: "sla_user_settings", label: "Preferenze SLA utente", group: "Ticket & SLA" },
  { name: "penalty_rules", label: "Regole penali", group: "Ticket & SLA" },
  // Fornitori
  { name: "suppliers", label: "Fornitori", group: "Fornitori" },
  { name: "supplier_documents", label: "Documenti fornitore", group: "Fornitori" },
  { name: "contracts", label: "Contratti", group: "Fornitori" },
  { name: "contract_attachments", label: "Allegati contratti", group: "Fornitori" },
  { name: "contract_renewals", label: "Rinnovi contratti", group: "Fornitori" },
  // Manutenzione & lavori
  { name: "maintenance_plans", label: "Piani manutenzione", group: "Manutenzione" },
  { name: "maintenance_tasks", label: "Task manutenzione", group: "Manutenzione" },
  { name: "work_orders", label: "Ordini di lavoro", group: "Manutenzione" },
  // Inventario & acquisti
  { name: "inventory_items", label: "Articoli magazzino", group: "Inventario" },
  { name: "inventory_movements", label: "Movimenti magazzino", group: "Inventario" },
  { name: "reorder_requests", label: "Richieste riordino", group: "Inventario" },
  { name: "reorder_events", label: "Eventi riordino", group: "Inventario", readonly: true },
  { name: "reorder_attachments", label: "Allegati riordino", group: "Inventario" },
  { name: "purchase_orders", label: "Ordini d'acquisto", group: "Inventario" },
  // Economato
  { name: "invoices", label: "Fatture", group: "Economato" },
  { name: "cash_movements", label: "Prima nota / cassa", group: "Economato" },
  { name: "utility_meters", label: "Contatori utenze", group: "Economato" },
  { name: "meter_readings", label: "Letture contatori", group: "Economato" },
  { name: "cost_centers", label: "Centri di costo", group: "Economato" },
  // Comunicazioni
  { name: "conversations", label: "Conversazioni", group: "Comunicazioni" },
  { name: "conversation_participants", label: "Partecipanti", group: "Comunicazioni" },
  { name: "messages", label: "Messaggi", group: "Comunicazioni" },
  { name: "notification_templates", label: "Template notifiche", group: "Comunicazioni" },
  { name: "notification_channels", label: "Canali notifiche", group: "Comunicazioni" },
  { name: "notification_log", label: "Log notifiche", group: "Comunicazioni", readonly: true },
  { name: "admin_alerts", label: "Avvisi admin", group: "Comunicazioni" },
  // Permessi & ruoli
  { name: "profiles", label: "Profili utente", group: "Permessi" },
  { name: "user_roles", label: "Ruoli utente", group: "Permessi" },
  { name: "org_memberships", label: "Membership org", group: "Permessi" },
  { name: "org_invitations", label: "Inviti org", group: "Permessi" },
  { name: "module_permissions", label: "Permessi modulo", group: "Permessi" },
  { name: "module_dependencies", label: "Dipendenze moduli", group: "Permessi" },
  { name: "module_dependency_versions", label: "Versioni dipendenze", group: "Permessi" },
  { name: "user_delegations", label: "Deleghe", group: "Permessi" },
  // Workflow
  { name: "workflows", label: "Workflow", group: "Workflow" },
  { name: "workflow_steps", label: "Step workflow", group: "Workflow" },
  { name: "workflow_transitions", label: "Transizioni", group: "Workflow" },
  { name: "workflow_instances", label: "Istanze workflow", group: "Workflow" },
  // Report
  { name: "report_templates", label: "Template report", group: "Report" },
  { name: "report_template_access", label: "Accesso template", group: "Report" },
  { name: "report_delivery_queue", label: "Coda invii report", group: "Report" },
  { name: "scheduled_exports", label: "Export schedulati", group: "Report" },
  { name: "scheduled_report_runs", label: "Esecuzioni report", group: "Report" },
  { name: "report_pdf_previews", label: "Anteprime PDF", group: "Report", readonly: true },
  { name: "report_template_layout_audit", label: "Audit layout report", group: "Report", readonly: true },
  // Abbonamento
  { name: "subscription_plans", label: "Piani abbonamento", group: "Abbonamento" },
  { name: "org_subscriptions", label: "Abbonamenti org", group: "Abbonamento" },
  { name: "subscription_sync_jobs", label: "Job sync abbonamenti", group: "Abbonamento", readonly: true },
  // Backup
  { name: "backup_runs", label: "Esecuzioni backup", group: "Backup", readonly: true },
  { name: "backup_schedules", label: "Pianificazioni backup", group: "Backup" },
  { name: "restore_runs", label: "Esecuzioni restore", group: "Backup", readonly: true },
  { name: "org_backup_notify_prefs", label: "Preferenze notifiche backup", group: "Backup" },
  { name: "import_mappings", label: "Mappature import", group: "Backup" },
  // Integrazioni & dashboard
  { name: "integrations", label: "Integrazioni", group: "Sistema" },
  { name: "dashboard_widgets", label: "Widget dashboard", group: "Sistema" },
  { name: "videocall_rooms", label: "Stanze videochiamata", group: "Sistema" },
  // Audit (sola lettura)
  { name: "audit_log", label: "Audit log", group: "Audit", readonly: true },
  { name: "permission_audit", label: "Audit permessi", group: "Audit", readonly: true },
  { name: "delegation_audit", label: "Audit deleghe", group: "Audit", readonly: true },
  { name: "access_denied_log", label: "Accessi negati", group: "Audit", readonly: true },
  { name: "org_notification_prefs", label: "Preferenze notifiche org", group: "Sistema" },
];

export const TABLES_BY_NAME = new Map(DATA_EXPLORER_TABLES.map((t) => [t.name, t]));

export function getTableEntry(name: string): TableEntry | undefined {
  return TABLES_BY_NAME.get(name);
}

export function isAllowedTable(name: string): boolean {
  return TABLES_BY_NAME.has(name);
}