
-- ============ FASE 2: Fornitori, Contratti, Ordini di Lavoro ============
CREATE TYPE public.supplier_status AS ENUM ('attivo','sospeso','dismesso');
CREATE TYPE public.contract_type AS ENUM ('canone','consumo','intervento','misto');
CREATE TYPE public.contract_status AS ENUM ('bozza','attivo','scaduto','disdetto');
CREATE TYPE public.work_order_status AS ENUM ('aperto','programmato','in_corso','completato','annullato');

CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id UUID REFERENCES public.structures(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  vat_number TEXT,
  category TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  contact_person TEXT,
  status public.supplier_status NOT NULL DEFAULT 'attivo',
  durc_expiry DATE,
  insurance_expiry DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "suppliers_access" ON public.suppliers FOR ALL TO authenticated
  USING (structure_id IS NULL OR public.has_structure_access(auth.uid(), structure_id))
  WITH CHECK (structure_id IS NULL OR public.has_structure_access(auth.uid(), structure_id));
CREATE TRIGGER suppliers_updated BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id UUID NOT NULL REFERENCES public.structures(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  type public.contract_type NOT NULL DEFAULT 'canone',
  status public.contract_status NOT NULL DEFAULT 'bozza',
  start_date DATE,
  end_date DATE,
  auto_renew BOOLEAN NOT NULL DEFAULT false,
  renewal_months INT,
  amount NUMERIC(12,2),
  currency TEXT NOT NULL DEFAULT 'EUR',
  sla_ack_minutes INT,
  sla_resolve_minutes INT,
  document_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contracts TO authenticated;
GRANT ALL ON public.contracts TO service_role;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contracts_access" ON public.contracts FOR ALL TO authenticated
  USING (public.has_structure_access(auth.uid(), structure_id))
  WITH CHECK (public.has_structure_access(auth.uid(), structure_id));
CREATE TRIGGER contracts_updated BEFORE UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id UUID NOT NULL REFERENCES public.structures(id) ON DELETE CASCADE,
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL,
  asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  contract_id UUID REFERENCES public.contracts(id) ON DELETE SET NULL,
  number TEXT,
  title TEXT NOT NULL,
  description TEXT,
  status public.work_order_status NOT NULL DEFAULT 'aperto',
  scheduled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cost NUMERIC(12,2),
  report_text TEXT,
  signature_url TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_orders TO authenticated;
GRANT ALL ON public.work_orders TO service_role;
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "work_orders_access" ON public.work_orders FOR ALL TO authenticated
  USING (public.has_structure_access(auth.uid(), structure_id))
  WITH CHECK (public.has_structure_access(auth.uid(), structure_id));
CREATE TRIGGER work_orders_updated BEFORE UPDATE ON public.work_orders FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ FASE 3: Manutenzione programmata + Magazzino ============
CREATE TYPE public.maintenance_frequency AS ENUM ('giornaliera','settimanale','mensile','trimestrale','semestrale','annuale','custom');

CREATE TABLE public.maintenance_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id UUID NOT NULL REFERENCES public.structures(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES public.assets(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.asset_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  frequency public.maintenance_frequency NOT NULL DEFAULT 'mensile',
  interval_days INT,
  checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
  next_due DATE,
  active BOOLEAN NOT NULL DEFAULT true,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_plans TO authenticated;
GRANT ALL ON public.maintenance_plans TO service_role;
ALTER TABLE public.maintenance_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "maintenance_plans_access" ON public.maintenance_plans FOR ALL TO authenticated
  USING (public.has_structure_access(auth.uid(), structure_id))
  WITH CHECK (public.has_structure_access(auth.uid(), structure_id));
CREATE TRIGGER maintenance_plans_updated BEFORE UPDATE ON public.maintenance_plans FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.maintenance_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.maintenance_plans(id) ON DELETE CASCADE,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'da_eseguire',
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  checklist_result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_tasks TO authenticated;
GRANT ALL ON public.maintenance_tasks TO service_role;
ALTER TABLE public.maintenance_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "maintenance_tasks_access" ON public.maintenance_tasks FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.maintenance_plans p WHERE p.id = plan_id AND public.has_structure_access(auth.uid(), p.structure_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.maintenance_plans p WHERE p.id = plan_id AND public.has_structure_access(auth.uid(), p.structure_id)));

CREATE TABLE public.inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id UUID NOT NULL REFERENCES public.structures(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  unit TEXT NOT NULL DEFAULT 'pz',
  quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
  min_quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
  unit_cost NUMERIC(12,2),
  location TEXT,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(structure_id, sku)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_items TO authenticated;
GRANT ALL ON public.inventory_items TO service_role;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inventory_items_access" ON public.inventory_items FOR ALL TO authenticated
  USING (public.has_structure_access(auth.uid(), structure_id))
  WITH CHECK (public.has_structure_access(auth.uid(), structure_id));
CREATE TRIGGER inventory_items_updated BEFORE UPDATE ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL,
  quantity NUMERIC(12,2) NOT NULL,
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL,
  work_order_id UUID REFERENCES public.work_orders(id) ON DELETE SET NULL,
  notes TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_movements TO authenticated;
GRANT ALL ON public.inventory_movements TO service_role;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inventory_movements_access" ON public.inventory_movements FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.inventory_items i WHERE i.id = item_id AND public.has_structure_access(auth.uid(), i.structure_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.inventory_items i WHERE i.id = item_id AND public.has_structure_access(auth.uid(), i.structure_id)));

CREATE TABLE public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id UUID NOT NULL REFERENCES public.structures(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  number TEXT,
  status TEXT NOT NULL DEFAULT 'bozza',
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery DATE,
  total NUMERIC(12,2),
  notes TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_orders TO authenticated;
GRANT ALL ON public.purchase_orders TO service_role;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "purchase_orders_access" ON public.purchase_orders FOR ALL TO authenticated
  USING (public.has_structure_access(auth.uid(), structure_id))
  WITH CHECK (public.has_structure_access(auth.uid(), structure_id));
CREATE TRIGGER purchase_orders_updated BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ FASE 4: Utenze, Bollette, Fatture ============
CREATE TYPE public.utility_type AS ENUM ('elettricita','gas','acqua','gasolio','teleriscaldamento','altro');
CREATE TYPE public.invoice_status AS ENUM ('da_pagare','pagata','scaduta','contestata','annullata');

CREATE TABLE public.utility_meters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id UUID NOT NULL REFERENCES public.structures(id) ON DELETE CASCADE,
  type public.utility_type NOT NULL,
  name TEXT NOT NULL,
  serial_number TEXT,
  pod_pdr TEXT,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  unit TEXT NOT NULL DEFAULT 'kWh',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.utility_meters TO authenticated;
GRANT ALL ON public.utility_meters TO service_role;
ALTER TABLE public.utility_meters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "utility_meters_access" ON public.utility_meters FOR ALL TO authenticated
  USING (public.has_structure_access(auth.uid(), structure_id))
  WITH CHECK (public.has_structure_access(auth.uid(), structure_id));
CREATE TRIGGER utility_meters_updated BEFORE UPDATE ON public.utility_meters FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.meter_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meter_id UUID NOT NULL REFERENCES public.utility_meters(id) ON DELETE CASCADE,
  reading_date DATE NOT NULL,
  value NUMERIC(14,3) NOT NULL,
  notes TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meter_readings TO authenticated;
GRANT ALL ON public.meter_readings TO service_role;
ALTER TABLE public.meter_readings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "meter_readings_access" ON public.meter_readings FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.utility_meters m WHERE m.id = meter_id AND public.has_structure_access(auth.uid(), m.structure_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.utility_meters m WHERE m.id = meter_id AND public.has_structure_access(auth.uid(), m.structure_id)));

CREATE TABLE public.cost_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id UUID NOT NULL REFERENCES public.structures(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(structure_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cost_centers TO authenticated;
GRANT ALL ON public.cost_centers TO service_role;
ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cost_centers_access" ON public.cost_centers FOR ALL TO authenticated
  USING (public.has_structure_access(auth.uid(), structure_id))
  WITH CHECK (public.has_structure_access(auth.uid(), structure_id));

CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id UUID NOT NULL REFERENCES public.structures(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  contract_id UUID REFERENCES public.contracts(id) ON DELETE SET NULL,
  cost_center_id UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  utility_type public.utility_type,
  number TEXT NOT NULL,
  issue_date DATE NOT NULL,
  due_date DATE,
  amount_net NUMERIC(12,2),
  vat NUMERIC(12,2),
  amount_total NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  status public.invoice_status NOT NULL DEFAULT 'da_pagare',
  paid_at DATE,
  pdf_url TEXT,
  ocr_data JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invoices_access" ON public.invoices FOR ALL TO authenticated
  USING (public.has_structure_access(auth.uid(), structure_id))
  WITH CHECK (public.has_structure_access(auth.uid(), structure_id));
CREATE TRIGGER invoices_updated BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ FASE 5: Messaggistica (adattata da Penelope) ============
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id UUID REFERENCES public.structures(id) ON DELETE CASCADE,
  title TEXT,
  is_group BOOLEAN NOT NULL DEFAULT false,
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL,
  contract_id UUID REFERENCES public.contracts(id) ON DELETE SET NULL,
  agent_type TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER conversations_updated BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, user_id),
  UNIQUE (conversation_id, supplier_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_participants TO authenticated;
GRANT ALL ON public.conversation_participants TO service_role;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_conversation_member(_conv UUID, _user UUID)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.conversation_participants WHERE conversation_id = _conv AND user_id = _user)
$$;

CREATE POLICY "conv_member_select" ON public.conversations FOR SELECT TO authenticated
  USING (public.is_conversation_member(id, auth.uid()) OR created_by = auth.uid());
CREATE POLICY "conv_insert" ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "conv_update_creator" ON public.conversations FOR UPDATE TO authenticated
  USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

CREATE POLICY "cp_select" ON public.conversation_participants FOR SELECT TO authenticated
  USING (public.is_conversation_member(conversation_id, auth.uid()));
CREATE POLICY "cp_insert" ON public.conversation_participants FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND c.created_by = auth.uid())
              OR user_id = auth.uid());
CREATE POLICY "cp_delete" ON public.conversation_participants FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND c.created_by = auth.uid())
         OR user_id = auth.uid());

CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_kind TEXT NOT NULL DEFAULT 'user',
  body TEXT NOT NULL,
  attachments JSONB,
  agent_meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "msg_select_member" ON public.messages FOR SELECT TO authenticated
  USING (public.is_conversation_member(conversation_id, auth.uid()));
CREATE POLICY "msg_insert_member" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (public.is_conversation_member(conversation_id, auth.uid()) AND (sender_id = auth.uid() OR sender_kind = 'agent'));

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;

-- ============ FASE 6: Audit log ============
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id UUID REFERENCES public.structures(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  action TEXT NOT NULL,
  diff JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_select_admin" ON public.audit_log FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));
CREATE POLICY "audit_insert_self" ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Indexes
CREATE INDEX idx_suppliers_structure ON public.suppliers(structure_id);
CREATE INDEX idx_contracts_structure ON public.contracts(structure_id, status);
CREATE INDEX idx_work_orders_structure ON public.work_orders(structure_id, status);
CREATE INDEX idx_inventory_structure ON public.inventory_items(structure_id);
CREATE INDEX idx_invoices_structure ON public.invoices(structure_id, status, due_date);
CREATE INDEX idx_messages_conv ON public.messages(conversation_id, created_at DESC);
CREATE INDEX idx_maintenance_due ON public.maintenance_tasks(due_date, status);
