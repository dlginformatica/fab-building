# HotelOps — Schema Database

> Documento generato automaticamente. Rigenerato a ogni migration.

## Changelog

### 2026-06-19 — Fase 8.3
**Tabelle**
- `asset_history(id, asset_id→assets, structure_id, actor_id, field, old_value jsonb, new_value jsonb, created_at)` — trigger `tg_asset_history` after update su `assets`.

**Funzioni**
- `asset_maintenance_log(_asset uuid) → (kind, ref_id, title, status, occurred_at, closed_at, hours, notes)` — unione preventive + correttive.
- `asset_maintenance_kpi(_asset uuid) → (total_failures, total_repairs, mtbf_hours, mttr_hours, last_failure_at, last_repair_at)`.

### 2026-06-19 — Fase 8.2 SLA escalation & conformità
- Nuova tabella `sla_escalation_rules` (id, sla_rule_id FK, structure_id FK, level CHECK 1-5, after_minutes, notify_role app_role, notify_user_id, notify_channel_id, event notification_event, enabled, notes) + UNIQUE(sla_rule_id, level) + RLS (read: has_structure_access, manage: is_admin).
- `sla_violations`: nuove colonne `last_escalation_level INT NOT NULL DEFAULT 0`, `last_escalation_at TIMESTAMPTZ`.
- Nuova funzione `sla_compliance_report(_from,_to,_structure)` (SECURITY DEFINER, EXECUTE revocato ad anon).
- Nuova funzione `sla_pending_escalations()` (SECURITY DEFINER, EXECUTE revocato ad anon/authenticated).
- Enum `notification_event` esteso con `sla_escalation_l1`, `sla_escalation_l2`, `sla_escalation_l3`, `compliance_report_ready`.

### 2026-06-19 — Fase 8.1 Contratti
- `contracts`: nuovi campi `notice_period_days INT NOT NULL DEFAULT 30`, `renewal_terms TEXT`, `next_review_at DATE`, `attachments_count INT NOT NULL DEFAULT 0`, `last_notified_at TIMESTAMPTZ`.
- Nuova tabella `contract_renewals` (id, contract_id FK, structure_id FK, previous_end_date, new_end_date, amount, notes, renewed_by, renewed_at, created_at) + RLS `has_structure_access`.
- Nuova tabella `contract_attachments` (id, contract_id FK, structure_id FK, storage_path, file_name, mime_type, size_bytes, category, uploaded_by, created_at) + RLS `has_structure_access`.
- Trigger `tg_contract_attachments_count`, `tg_contract_apply_renewal`.
- Funzione `contracts_due_for_notice()` (SECURITY DEFINER, EXECUTE solo a `service_role`).
- Bucket privato `contracts` con policy su `storage.objects` join `contract_attachments`.
- Enum `notification_event` esteso con `contract_expiring`.

### 2026-06-19 — Fase 7.2 Workflow Engine
- Nuove tabelle: workflows, workflow_steps, workflow_instances, workflow_transitions (append-only).
- Editor procedure multi-step con tipi: approval, action, notification, wait, condition, form.
- Assegnatario per ruolo/utente, SLA per step in minuti, escalation su timeout (config).
- Istanze collegabili a ticket/asset/fornitore/fattura; transizioni con outcome (approved, rejected, completed, skipped, timeout, escalated, cancelled).
- RLS scoped per struttura; admin (super_admin/direttore/facility_manager) gestiscono definizioni; membri struttura avviano/avanzano istanze.
- Audit automatico via tg_audit_log su workflows e workflow_instances.
- UI: /app/workflows con tabs Procedure / Esecuzioni, editor step inline, dialog di avanzamento.


### 2026-06-19 — Fase 7.1
- Estesa `maintenance_tasks` (assigned_to, hours, outcome, photos, signature_url, signed_at, ticket_report_id, scheduled_for, updated_at).
- Nuova funzione `generate_maintenance_tasks(from,to)`.

## Tabelle (schema public)

### `asset_categories`

| Colonna | Tipo | Null |
|---|---|---|
| `id` | uuid | NO |
| `name` | text | NO |
| `icon` | text | YES |
| `color` | text | YES |

**RLS policies:**
- asset_categories admin manage [ALL]
- asset_categories read all [SELECT]

### `asset_documents`

| Colonna | Tipo | Null |
|---|---|---|
| `id` | uuid | NO |
| `asset_id` | uuid | NO |
| `structure_id` | uuid | YES |
| `category` | text | NO |
| `title` | text | NO |
| `description` | text | YES |
| `file_path` | text | NO |
| `mime` | text | YES |
| `file_size_kb` | integer | YES |
| `version` | integer | NO |
| `superseded_by` | uuid | YES |
| `issued_at` | date | YES |
| `expires_at` | date | YES |
| `uploaded_by` | uuid | YES |
| `created_at` | timestamp with time zone | NO |
| `updated_at` | timestamp with time zone | NO |

**RLS policies:**
- asset_docs_delete [DELETE]
- asset_docs_insert [INSERT]
- asset_docs_select [SELECT]
- asset_docs_update [UPDATE]

### `asset_media`

| Colonna | Tipo | Null |
|---|---|---|
| `id` | uuid | NO |
| `asset_id` | uuid | NO |
| `structure_id` | uuid | YES |
| `kind` | text | NO |
| `title` | text | YES |
| `caption` | text | YES |
| `file_path` | text | NO |
| `thumbnail_path` | text | YES |
| `mime` | text | YES |
| `file_size_kb` | integer | YES |
| `taken_at` | timestamp with time zone | YES |
| `uploaded_by` | uuid | YES |
| `created_at` | timestamp with time zone | NO |

**RLS policies:**
- asset_media_delete [DELETE]
- asset_media_insert [INSERT]
- asset_media_select [SELECT]
- asset_media_update [UPDATE]

### `asset_qr_audit`

| Colonna | Tipo | Null |
|---|---|---|
| `id` | uuid | NO |
| `asset_id` | uuid | NO |
| `structure_id` | uuid | YES |
| `actor_id` | uuid | YES |
| `action` | text | NO |
| `old_token` | text | YES |
| `new_token` | text | YES |
| `created_at` | timestamp with time zone | NO |

**RLS policies:**
- qr_audit_read [SELECT]

### `asset_scans`

| Colonna | Tipo | Null |
|---|---|---|
| `id` | uuid | NO |
| `asset_id` | uuid | NO |
| `structure_id` | uuid | YES |
| `scanned_by` | uuid | YES |
| `user_agent` | text | YES |
| `note` | text | YES |
| `created_at` | timestamp with time zone | NO |

**RLS policies:**
- asset_scans_insert [INSERT]
- asset_scans_select [SELECT]

### `assets`

| Colonna | Tipo | Null |
|---|---|---|
| `id` | uuid | NO |
| `structure_id` | uuid | NO |
| `category_id` | uuid | YES |
| `floor_id` | uuid | YES |
| `room_id` | uuid | YES |
| `code` | text | NO |
| `name` | text | NO |
| `brand` | text | YES |
| `model` | text | YES |
| `serial_number` | text | YES |
| `install_date` | date | YES |
| `warranty_until` | date | YES |
| `status` | USER-DEFINED | NO |
| `photo_url` | text | YES |
| `manual_url` | text | YES |
| `notes` | text | YES |
| `qr_token` | text | YES |
| `created_at` | timestamp with time zone | NO |
| `updated_at` | timestamp with time zone | NO |
| `area` | USER-DEFINED | YES |
| `qr_revoked_at` | timestamp with time zone | YES |
| `qr_generated_at` | timestamp with time zone | YES |

**RLS policies:**
- assets access [ALL]

### `audit_log`

| Colonna | Tipo | Null |
|---|---|---|
| `id` | uuid | NO |
| `structure_id` | uuid | YES |
| `user_id` | uuid | YES |
| `entity_type` | text | NO |
| `entity_id` | uuid | YES |
| `action` | text | NO |
| `diff` | jsonb | YES |
| `created_at` | timestamp with time zone | NO |

**RLS policies:**
- audit_no_user_insert [INSERT]
- audit_select_admin [SELECT]

### `contracts`

| Colonna | Tipo | Null |
|---|---|---|
| `id` | uuid | NO |
| `structure_id` | uuid | NO |
| `supplier_id` | uuid | NO |
| `code` | text | NO |
| `title` | text | NO |
| `type` | USER-DEFINED | NO |
| `status` | USER-DEFINED | NO |
| `start_date` | date | YES |
| `end_date` | date | YES |
| `auto_renew` | boolean | NO |
| `renewal_months` | integer | YES |
| `amount` | numeric | YES |
| `currency` | text | NO |
| `sla_ack_minutes` | integer | YES |
| `sla_resolve_minutes` | integer | YES |
| `document_url` | text | YES |
| `notes` | text | YES |
| `created_at` | timestamp with time zone | NO |
| `updated_at` | timestamp with time zone | NO |

**RLS policies:**
- contracts_access [ALL]

### `conversation_participants`

| Colonna | Tipo | Null |
|---|---|---|
| `id` | uuid | NO |
| `conversation_id` | uuid | NO |
| `user_id` | uuid | YES |
| `supplier_id` | uuid | YES |
| `last_read_at` | timestamp with time zone | YES |
| `created_at` | timestamp with time zone | NO |

**RLS policies:**
- cp_delete [DELETE]
- cp_insert [INSERT]
- cp_select [SELECT]

### `conversations`

| Colonna | Tipo | Null |
|---|---|---|
| `id` | uuid | NO |
| `structure_id` | uuid | YES |
| `title` | text | YES |
| `is_group` | boolean | NO |
| `ticket_id` | uuid | YES |
| `contract_id` | uuid | YES |
| `agent_type` | text | YES |
| `created_by` | uuid | YES |
| `created_at` | timestamp with time zone | NO |
| `updated_at` | timestamp with time zone | NO |

**RLS policies:**
- conv_insert [INSERT]
- conv_member_select [SELECT]
- conv_update_creator [UPDATE]

### `cost_centers`

| Colonna | Tipo | Null |
|---|---|---|
| `id` | uuid | NO |
| `structure_id` | uuid | NO |
| `code` | text | NO |
| `name` | text | NO |
| `parent_id` | uuid | YES |
| `created_at` | timestamp with time zone | NO |
| `area` | USER-DEFINED | YES |

**RLS policies:**
- cost_centers_access [ALL]

### `dashboard_widgets`

| Colonna | Tipo | Null |
|---|---|---|
| `id` | uuid | NO |
| `user_id` | uuid | NO |
| `widget_key` | text | NO |
| `title` | text | YES |
| `position` | integer | NO |
| `size` | text | NO |
| `config` | jsonb | NO |
| `visible` | boolean | NO |
| `created_at` | timestamp with time zone | NO |
| `updated_at` | timestamp with time zone | NO |

**RLS policies:**
- dw_own [ALL]

### `delegation_audit`

| Colonna | Tipo | Null |
|---|---|---|
| `id` | uuid | NO |
| `delegation_id` | uuid | YES |
| `action` | text | NO |
| `actor_id` | uuid | YES |
| `delegator_id` | uuid | YES |
| `delegate_id` | uuid | YES |
| `structure_id` | uuid | YES |
| `modules` | ARRAY | YES |
| `old_row` | jsonb | YES |
| `new_row` | jsonb | YES |
| `reason` | text | YES |
| `created_at` | timestamp with time zone | NO |

**RLS policies:**
- delegation audit read [SELECT]

### `floors`

| Colonna | Tipo | Null |
|---|---|---|
| `id` | uuid | NO |
| `structure_id` | uuid | NO |
| `name` | text | NO |
| `level` | integer | YES |
| `created_at` | timestamp with time zone | NO |

**RLS policies:**
- floors access [ALL]

### `inventory_items`

| Colonna | Tipo | Null |
|---|---|---|
| `id` | uuid | NO |
| `structure_id` | uuid | NO |
| `sku` | text | NO |
| `name` | text | NO |
| `category` | text | YES |
| `unit` | text | NO |
| `quantity` | numeric | NO |
| `min_quantity` | numeric | NO |
| `unit_cost` | numeric | YES |
| `location` | text | YES |
| `supplier_id` | uuid | YES |
| `notes` | text | YES |
| `created_at` | timestamp with time zone | NO |
| `updated_at` | timestamp with time zone | NO |

**RLS policies:**
- inventory_items_access [ALL]

### `inventory_movements`

| Colonna | Tipo | Null |
|---|---|---|
| `id` | uuid | NO |
| `item_id` | uuid | NO |
| `movement_type` | text | NO |
| `quantity` | numeric | NO |
| `ticket_id` | uuid | YES |
| `work_order_id` | uuid | YES |
| `notes` | text | YES |
| `user_id` | uuid | YES |
| `created_at` | timestamp with time zone | NO |

**RLS policies:**
- inventory_movements_access [ALL]

### `invoices`

| Colonna | Tipo | Null |
|---|---|---|
| `id` | uuid | NO |
| `structure_id` | uuid | NO |
| `supplier_id` | uuid | YES |
| `contract_id` | uuid | YES |
| `cost_center_id` | uuid | YES |
| `utility_type` | USER-DEFINED | YES |
| `number` | text | NO |
| `issue_date` | date | NO |
| `due_date` | date | YES |
| `amount_net` | numeric | YES |
| `vat` | numeric | YES |
| `amount_total` | numeric | NO |
| `currency` | text | NO |
| `status` | USER-DEFINED | NO |
| `paid_at` | date | YES |
| `pdf_url` | text | YES |
| `ocr_data` | jsonb | YES |
| `notes` | text | YES |
| `created_at` | timestamp with time zone | NO |
| `updated_at` | timestamp with time zone | NO |
| `area` | USER-DEFINED | YES |

**RLS policies:**
- invoices_access [ALL]

### `maintenance_plans`

| Colonna | Tipo | Null |
|---|---|---|
| `id` | uuid | NO |
| `structure_id` | uuid | NO |
| `asset_id` | uuid | YES |
| `category_id` | uuid | YES |
| `name` | text | NO |
| `description` | text | YES |
| `frequency` | USER-DEFINED | NO |
| `interval_days` | integer | YES |
| `checklist` | jsonb | NO |
| `next_due` | date | YES |
| `active` | boolean | NO |
| `assigned_to` | uuid | YES |
| `supplier_id` | uuid | YES |
| `created_at` | timestamp with time zone | NO |
| `updated_at` | timestamp with time zone | NO |

**RLS policies:**
- maintenance_plans_access [ALL]

### `maintenance_tasks`

| Colonna | Tipo | Null |
|---|---|---|
| `id` | uuid | NO |
| `plan_id` | uuid | NO |
| `due_date` | date | NO |
| `status` | text | NO |
| `completed_at` | timestamp with time zone | YES |
| `completed_by` | uuid | YES |
| `notes` | text | YES |
| `checklist_result` | jsonb | YES |
| `created_at` | timestamp with time zone | NO |
| `assigned_to` | uuid | YES |
| `estimated_hours` | numeric | YES |
| `actual_hours` | numeric | YES |
| `outcome` | text | YES |
| `photos` | jsonb | NO |
| `signature_url` | text | YES |
| `signed_at` | timestamp with time zone | YES |
| `ticket_report_id` | uuid | YES |
| `scheduled_for` | date | YES |
| `updated_at` | timestamp with time zone | NO |

**RLS policies:**
- maintenance_tasks_access [ALL]

### `messages`

| Colonna | Tipo | Null |
|---|---|---|
| `id` | uuid | NO |
| `conversation_id` | uuid | NO |
| `sender_id` | uuid | YES |
| `sender_kind` | text | NO |
| `body` | text | NO |
| `attachments` | jsonb | YES |
| `agent_meta` | jsonb | YES |
| `created_at` | timestamp with time zone | NO |

**RLS policies:**
- msg_insert_member [INSERT]
- msg_select_member [SELECT]

### `meter_readings`

| Colonna | Tipo | Null |
|---|---|---|
| `id` | uuid | NO |
| `meter_id` | uuid | NO |
| `reading_date` | date | NO |
| `value` | numeric | NO |
| `notes` | text | YES |
| `user_id` | uuid | YES |
| `created_at` | timestamp with time zone | NO |

**RLS policies:**
- meter_readings_access [ALL]

### `module_permissions`

| Colonna | Tipo | Null |
|---|---|---|
| `id` | uuid | NO |
| `user_id` | uuid | YES |
| `role` | USER-DEFINED | YES |
| `module` | text | NO |
| `action` | text | NO |
| `structure_id` | uuid | YES |
| `allowed` | boolean | NO |
| `created_at` | timestamp with time zone | NO |

**RLS policies:**
- admins manage perms [ALL]
- users see own perms [SELECT]

### `penalty_rules`

| Colonna | Tipo | Null |
|---|---|---|
| `id` | uuid | NO |
| `structure_id` | uuid | YES |
| `supplier_id` | uuid | YES |
| `contract_id` | uuid | YES |
| `name` | text | NO |
| `trigger_type` | text | NO |
| `threshold_minutes` | integer | YES |
| `amount_eur` | numeric | NO |
| `amount_pct` | numeric | YES |
| `per_hour` | boolean | NO |
| `active` | boolean | NO |
| `created_at` | timestamp with time zone | NO |

**RLS policies:**
- penalty_delete [DELETE]
- penalty_insert [INSERT]
- penalty_select [SELECT]
- penalty_update [UPDATE]

### `profiles`

| Colonna | Tipo | Null |
|---|---|---|
| `id` | uuid | NO |
| `email` | text | NO |
| `full_name` | text | YES |
| `phone` | text | YES |
| `avatar_url` | text | YES |
| `created_at` | timestamp with time zone | NO |
| `updated_at` | timestamp with time zone | NO |

**RLS policies:**
- profiles insert own [INSERT]
- profiles read own or admin [SELECT]
- profiles update own [UPDATE]

### `purchase_orders`

| Colonna | Tipo | Null |
|---|---|---|
| `id` | uuid | NO |
| `structure_id` | uuid | NO |
| `supplier_id` | uuid | YES |
| `number` | text | YES |
| `status` | text | NO |
| `order_date` | date | NO |
| `expected_delivery` | date | YES |
| `total` | numeric | YES |
| `notes` | text | YES |
| `items` | jsonb | NO |
| `created_by` | uuid | YES |
| `created_at` | timestamp with time zone | NO |
| `updated_at` | timestamp with time zone | NO |
| `area` | USER-DEFINED | YES |

**RLS policies:**
- purchase_orders_access [ALL]

### `reorder_attachments`

| Colonna | Tipo | Null |
|---|---|---|
| `id` | uuid | NO |
| `reorder_id` | uuid | NO |
| `structure_id` | uuid | NO |
| `kind` | text | NO |
| `file_path` | text | NO |
| `file_name` | text | YES |
| `mime_type` | text | YES |
| `uploaded_by` | uuid | YES |
| `created_at` | timestamp with time zone | NO |

**RLS policies:**
- reorder_att_access [ALL]

### `reorder_events`

| Colonna | Tipo | Null |
|---|---|---|
| `id` | uuid | NO |
| `reorder_id` | uuid | NO |
| `actor_id` | uuid | YES |
| `from_status` | USER-DEFINED | YES |
| `to_status` | USER-DEFINED | NO |
| `note` | text | YES |
| `created_at` | timestamp with time zone | NO |

**RLS policies:**
- reorder_events_insert [INSERT]
- reorder_events_read [SELECT]

### `reorder_requests`

| Colonna | Tipo | Null |
|---|---|---|
| `id` | uuid | NO |
| `structure_id` | uuid | NO |
| `item_id` | uuid | NO |
| `supplier_id` | uuid | YES |
| `quantity` | numeric | NO |
| `status` | USER-DEFINED | NO |
| `notes` | text | YES |
| `created_by` | uuid | YES |
| `created_at` | timestamp with time zone | NO |
| `updated_at` | timestamp with time zone | NO |

**RLS policies:**
- reorder_delete [DELETE]
- reorder_insert [INSERT]
- reorder_select [SELECT]
- reorder_update [UPDATE]

### `report_delivery_queue`

| Colonna | Tipo | Null |
|---|---|---|
| `id` | uuid | NO |
| `run_id` | uuid | YES |
| `template_id` | uuid | YES |
| `structure_id` | uuid | YES |
| `recipient` | text | NO |
| `subject` | text | YES |
| `status` | text | NO |
| `attempts` | integer | NO |
| `max_attempts` | integer | NO |
| `next_attempt_at` | timestamp with time zone | NO |
| `last_error` | text | YES |
| `payload` | jsonb | NO |
| `created_at` | timestamp with time zone | NO |
| `updated_at` | timestamp with time zone | NO |

**RLS policies:**
- queue read admin [SELECT]
- queue_no_user_delete [DELETE]
- queue_no_user_insert [INSERT]
- queue_no_user_update [UPDATE]

### `report_pdf_previews`

| Colonna | Tipo | Null |
|---|---|---|
| `id` | uuid | NO |
| `owner_id` | uuid | NO |
| `template_id` | uuid | YES |
| `template_name` | text | YES |
| `recipient` | text | YES |
| `path` | text | NO |
| `size_bytes` | integer | YES |
| `expires_at` | timestamp with time zone | NO |
| `created_at` | timestamp with time zone | NO |

**RLS policies:**
- previews owner crud [ALL]

### `report_template_access`

| Colonna | Tipo | Null |
|---|---|---|
| `id` | uuid | NO |
| `template_id` | uuid | NO |
| `user_id` | uuid | YES |
| `role` | USER-DEFINED | YES |
| `permission` | text | NO |
| `granted_by` | uuid | YES |
| `created_at` | timestamp with time zone | NO |

**RLS policies:**
- tpl_access_delete [DELETE]
- tpl_access_insert [INSERT]
- tpl_access_select [SELECT]
- tpl_access_update [UPDATE]

### `report_template_layout_audit`

| Colonna | Tipo | Null |
|---|---|---|
| `id` | uuid | NO |
| `template_id` | uuid | NO |
| `actor_id` | uuid | YES |
| `field` | text | NO |
| `recipient` | text | YES |
| `old_value` | jsonb | YES |
| `new_value` | jsonb | YES |
| `created_at` | timestamp with time zone | NO |

**RLS policies:**
- layout audit read [SELECT]

### `report_templates`

| Colonna | Tipo | Null |
|---|---|---|
| `id` | uuid | NO |
| `name` | text | NO |
| `description` | text | YES |
| `source` | text | NO |
| `columns` | jsonb | NO |
| `filters` | jsonb | NO |
| `group_by` | text | YES |
| `owner_id` | uuid | YES |
| `structure_id` | uuid | YES |
| `is_shared` | boolean | NO |
| `created_at` | timestamp with time zone | NO |
| `updated_at` | timestamp with time zone | NO |
| `layout` | jsonb | NO |
| `schedule_cron` | text | YES |
| `last_run_at` | timestamp with time zone | YES |
| `last_export_url` | text | YES |
| `recipients` | ARRAY | NO |
| `next_run_at` | timestamp with time zone | YES |
| `pdf_layout` | jsonb | YES |
| `recipient_layouts` | jsonb | NO |
| `timezone` | text | YES |
| `max_retries` | integer | NO |
| `retry_backoff_minutes` | integer | NO |

**RLS policies:**
- report tmpl read [SELECT]
- report tmpl write own [ALL]

### `rooms`

| Colonna | Tipo | Null |
|---|---|---|
| `id` | uuid | NO |
| `structure_id` | uuid | NO |
| `floor_id` | uuid | YES |
| `name` | text | NO |
| `room_type` | text | YES |
| `created_at` | timestamp with time zone | NO |

**RLS policies:**
- rooms access [ALL]

### `scheduled_report_runs`

| Colonna | Tipo | Null |
|---|---|---|
| `id` | uuid | NO |
| `template_id` | uuid | NO |
| `structure_id` | uuid | YES |
| `status` | text | NO |
| `rows_count` | integer | YES |
| `recipients` | ARRAY | NO |
| `error` | text | YES |
| `started_at` | timestamp with time zone | NO |
| `finished_at` | timestamp with time zone | YES |
| `attempts` | integer | NO |
| `next_retry_at` | timestamp with time zone | YES |
| `last_error_at` | timestamp with time zone | YES |
| `recipient_logs` | jsonb | NO |
| `triggered_by` | text | NO |

**RLS policies:**
- admins manage scheduled runs [ALL]
- admins read scheduled runs [SELECT]

### `sla_notifications`

| Colonna | Tipo | Null |
|---|---|---|
| `id` | uuid | NO |
| `ticket_id` | uuid | NO |
| `structure_id` | uuid | YES |
| `kind` | text | NO |
| `due_at` | timestamp with time zone | YES |
| `delay_minutes` | integer | YES |
| `payload` | jsonb | NO |
| `channel` | text | NO |
| `acknowledged_at` | timestamp with time zone | YES |
| `acknowledged_by` | uuid | YES |
| `created_at` | timestamp with time zone | NO |

**RLS policies:**
- sla_notif_ack [UPDATE]
- sla_notif_select [SELECT]

### `sla_rules`

| Colonna | Tipo | Null |
|---|---|---|
| `id` | uuid | NO |
| `structure_id` | uuid | YES |
| `priority` | USER-DEFINED | NO |
| `category_id` | uuid | YES |
| `ack_minutes` | integer | NO |
| `resolve_minutes` | integer | NO |
| `created_at` | timestamp with time zone | NO |
| `name` | text | YES |
| `description` | text | YES |
| `area` | USER-DEFINED | YES |
| `enabled` | boolean | NO |

**RLS policies:**
- sla_rules admin manage [ALL]
- sla_rules read [SELECT]

### `sla_violations`

| Colonna | Tipo | Null |
|---|---|---|
| `id` | uuid | NO |
| `ticket_id` | uuid | NO |
| `structure_id` | uuid | YES |
| `supplier_id` | uuid | YES |
| `rule_id` | uuid | YES |
| `kind` | text | NO |
| `delay_minutes` | integer | NO |
| `penalty_eur` | numeric | NO |
| `status` | text | NO |
| `notes` | text | YES |
| `created_at` | timestamp with time zone | NO |

**RLS policies:**
- sla_viol_delete [DELETE]
- sla_viol_insert [INSERT]
- sla_viol_select [SELECT]
- sla_viol_update [UPDATE]

### `structures`

| Colonna | Tipo | Null |
|---|---|---|
| `id` | uuid | NO |
| `name` | text | NO |
| `code` | text | YES |
| `address` | text | YES |
| `city` | text | YES |
| `country` | text | YES |
| `rooms_count` | integer | YES |
| `notes` | text | YES |
| `created_at` | timestamp with time zone | NO |
| `updated_at` | timestamp with time zone | NO |
| `timezone` | text | NO |

**RLS policies:**
- structures admin manage [ALL]
- structures read accessible [SELECT]

### `suppliers`

| Colonna | Tipo | Null |
|---|---|---|
| `id` | uuid | NO |
| `structure_id` | uuid | YES |
| `name` | text | NO |
| `vat_number` | text | YES |
| `category` | text | YES |
| `email` | text | YES |
| `phone` | text | YES |
| `address` | text | YES |
| `contact_person` | text | YES |
| `status` | USER-DEFINED | NO |
| `durc_expiry` | date | YES |
| `insurance_expiry` | date | YES |
| `notes` | text | YES |
| `created_at` | timestamp with time zone | NO |
| `updated_at` | timestamp with time zone | NO |
| `haccp_expiry` | date | YES |
| `visura_expiry` | date | YES |
| `rating` | smallint | YES |
| `certifications` | jsonb | NO |
| `blocked` | boolean | NO |

**RLS policies:**
- suppliers_delete [DELETE]
- suppliers_insert [INSERT]
- suppliers_select [SELECT]
- suppliers_update [UPDATE]

### `ticket_attachments`

| Colonna | Tipo | Null |
|---|---|---|
| `id` | uuid | NO |
| `ticket_id` | uuid | NO |
| `uploaded_by` | uuid | YES |
| `storage_path` | text | NO |
| `file_name` | text | YES |
| `mime_type` | text | YES |
| `size_bytes` | bigint | YES |
| `kind` | text | NO |
| `caption` | text | YES |
| `created_at` | timestamp with time zone | NO |

**RLS policies:**
- att_delete [DELETE]
- att_insert [INSERT]
- att_select [SELECT]

### `ticket_comments`

| Colonna | Tipo | Null |
|---|---|---|
| `id` | uuid | NO |
| `ticket_id` | uuid | NO |
| `author_id` | uuid | YES |
| `body` | text | NO |
| `created_at` | timestamp with time zone | NO |

**RLS policies:**
- ticket_comments delete own or admin [DELETE]
- ticket_comments insert own [INSERT]
- ticket_comments read [SELECT]

### `ticket_reports`

| Colonna | Tipo | Null |
|---|---|---|
| `id` | uuid | NO |
| `ticket_id` | uuid | NO |
| `author_id` | uuid | YES |
| `summary` | text | NO |
| `materials_used` | jsonb | YES |
| `hours_worked` | numeric | YES |
| `signature_data_url` | text | YES |
| `signed_at` | timestamp with time zone | YES |
| `created_at` | timestamp with time zone | NO |

**RLS policies:**
- tr_insert [INSERT]
- tr_select [SELECT]
- tr_update [UPDATE]

### `tickets`

| Colonna | Tipo | Null |
|---|---|---|
| `id` | uuid | NO |
| `ticket_number` | integer | NO |
| `structure_id` | uuid | NO |
| `asset_id` | uuid | YES |
| `category_id` | uuid | YES |
| `room_id` | uuid | YES |
| `title` | text | NO |
| `description` | text | YES |
| `priority` | USER-DEFINED | NO |
| `status` | USER-DEFINED | NO |
| `reported_by` | uuid | YES |
| `assigned_to` | uuid | YES |
| `photo_url` | text | YES |
| `ack_due_at` | timestamp with time zone | YES |
| `resolve_due_at` | timestamp with time zone | YES |
| `ack_at` | timestamp with time zone | YES |
| `resolved_at` | timestamp with time zone | YES |
| `closed_at` | timestamp with time zone | YES |
| `tts_announced` | boolean | NO |
| `created_at` | timestamp with time zone | NO |
| `updated_at` | timestamp with time zone | NO |
| `area` | USER-DEFINED | YES |

**RLS policies:**
- tickets delete admin [DELETE]
- tickets insert structure [INSERT]
- tickets read structure or assigned [SELECT]
- tickets update [UPDATE]

### `user_delegations`

| Colonna | Tipo | Null |
|---|---|---|
| `id` | uuid | NO |
| `delegator_id` | uuid | NO |
| `delegate_id` | uuid | NO |
| `structure_id` | uuid | YES |
| `modules` | ARRAY | NO |
| `starts_at` | timestamp with time zone | NO |
| `ends_at` | timestamp with time zone | YES |
| `active` | boolean | NO |
| `reason` | text | YES |
| `created_at` | timestamp with time zone | NO |

**RLS policies:**
- delegations own or admin [ALL]

### `user_roles`

| Colonna | Tipo | Null |
|---|---|---|
| `id` | uuid | NO |
| `user_id` | uuid | NO |
| `role` | USER-DEFINED | NO |
| `structure_id` | uuid | YES |
| `created_at` | timestamp with time zone | NO |

**RLS policies:**
- user_roles admin delete [DELETE]
- user_roles admin insert [INSERT]
- user_roles admin update [UPDATE]
- user_roles read own [SELECT]

### `utility_meters`

| Colonna | Tipo | Null |
|---|---|---|
| `id` | uuid | NO |
| `structure_id` | uuid | NO |
| `type` | USER-DEFINED | NO |
| `name` | text | NO |
| `serial_number` | text | YES |
| `pod_pdr` | text | YES |
| `supplier_id` | uuid | YES |
| `unit` | text | NO |
| `notes` | text | YES |
| `created_at` | timestamp with time zone | NO |
| `updated_at` | timestamp with time zone | NO |

**RLS policies:**
- utility_meters_access [ALL]

### `videocall_rooms`

| Colonna | Tipo | Null |
|---|---|---|
| `id` | uuid | NO |
| `ticket_id` | uuid | YES |
| `structure_id` | uuid | YES |
| `room_name` | text | NO |
| `topic` | text | YES |
| `created_by` | uuid | YES |
| `started_at` | timestamp with time zone | NO |
| `ended_at` | timestamp with time zone | YES |

**RLS policies:**
- vc_insert [INSERT]
- vc_select [SELECT]
- vc_update [UPDATE]

### `work_orders`

| Colonna | Tipo | Null |
|---|---|---|
| `id` | uuid | NO |
| `structure_id` | uuid | NO |
| `ticket_id` | uuid | YES |
| `asset_id` | uuid | YES |
| `supplier_id` | uuid | YES |
| `contract_id` | uuid | YES |
| `number` | text | YES |
| `title` | text | NO |
| `description` | text | YES |
| `status` | USER-DEFINED | NO |
| `scheduled_at` | timestamp with time zone | YES |
| `completed_at` | timestamp with time zone | YES |
| `cost` | numeric | YES |
| `report_text` | text | YES |
| `signature_url` | text | YES |
| `created_by` | uuid | YES |
| `created_at` | timestamp with time zone | NO |
| `updated_at` | timestamp with time zone | NO |
| `area` | USER-DEFINED | YES |

**RLS policies:**
- work_orders_access [ALL]

## Funzioni (security definer e helper)

- `apply_sla_on_ticket`
- `can_manage_template`
- `compute_sla_violation`
- `enqueue_sla_warnings`
- `generate_maintenance_tasks`
- `handle_new_user`
- `has_permission`
- `has_role`
- `has_structure_access`
- `is_admin`
- `is_conversation_member`
- `tg_asset_doc_inherit_struct`
- `tg_asset_media_inherit_struct`
- `tg_audit_log`
- `tg_audit_qr`
- `tg_delegation_audit`
- `tg_inherit_area_from_asset`
- `tg_log_reorder_status`
- `tg_report_layout_audit`
- `tg_set_updated_at`
- `tg_sla_violation_notify`
- `user_has_ticket_access`

## Bucket storage

- `asset-docs` — privato
- `asset-media` — privato
- `assets` — privato
- `reorders` — privato
- `report-previews` — privato
- `tickets` — privato

## Tabelle Fase 7.2 — Workflow Engine

### workflows
Definizione procedure. Colonne: structure_id (FK structures), name, description, trigger_type (enum: manual, ticket_opened, ticket_resolved, contract_expiring, invoice_received, asset_created, maintenance_due, custom), trigger_config (jsonb), active, version, created_by.
RLS: SELECT membri struttura · INSERT/UPDATE/DELETE solo is_admin().
Trigger: tg_set_updated_at, tg_audit_log.

### workflow_steps
Step ordinati di una procedura. Colonne: workflow_id, position (UNIQUE per workflow), name, step_type (enum: approval, action, notification, wait, condition, form), config (jsonb), assignee_role (app_role), assignee_user, sla_minutes, on_timeout, next_step_id.
RLS: SELECT membri struttura del workflow · ALL solo is_admin().

### workflow_instances
Esecuzione di una procedura. Colonne: workflow_id, structure_id, status (enum: running, completed, cancelled, failed, waiting), current_step_id, context (jsonb), ticket_id, asset_id, supplier_id, invoice_id, started_by, started_at, due_at, completed_at.
RLS scoped per struttura. Indici su (status), (structure_id), (ticket_id). Trigger audit.

### workflow_transitions (append-only)
Storico transizioni. Colonne: instance_id, from_step_id, to_step_id, actor_id, outcome (enum: approved, rejected, completed, skipped, timeout, escalated, cancelled), note, duration_seconds, payload (jsonb).
RLS: SELECT/INSERT solo membri struttura. No UPDATE/DELETE.
