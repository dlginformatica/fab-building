
-- Aree operative (camere / SPA / ristorante / cucina / aree_comuni / esterno / uffici / altro)
DO $$ BEGIN
  CREATE TYPE public.cost_area AS ENUM ('camere','spa','ristorante','cucina','aree_comuni','esterno','uffici','altro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.assets        ADD COLUMN IF NOT EXISTS area public.cost_area;
ALTER TABLE public.tickets       ADD COLUMN IF NOT EXISTS area public.cost_area;
ALTER TABLE public.work_orders   ADD COLUMN IF NOT EXISTS area public.cost_area;
ALTER TABLE public.invoices      ADD COLUMN IF NOT EXISTS area public.cost_area;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS area public.cost_area;

-- Trigger: se ticket/work_order non hanno area, eredita da asset
CREATE OR REPLACE FUNCTION public.tg_inherit_area_from_asset()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE a public.cost_area;
BEGIN
  IF NEW.area IS NULL AND NEW.asset_id IS NOT NULL THEN
    SELECT area INTO a FROM public.assets WHERE id = NEW.asset_id;
    NEW.area := a;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tg_tickets_area ON public.tickets;
CREATE TRIGGER tg_tickets_area BEFORE INSERT OR UPDATE OF asset_id ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.tg_inherit_area_from_asset();
DROP TRIGGER IF EXISTS tg_wo_area ON public.work_orders;
CREATE TRIGGER tg_wo_area BEFORE INSERT OR UPDATE OF asset_id ON public.work_orders
  FOR EACH ROW EXECUTE FUNCTION public.tg_inherit_area_from_asset();

-- Suppliers: certificazioni + rating + scadenze extra
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS haccp_expiry date;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS visura_expiry date;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS rating smallint CHECK (rating BETWEEN 1 AND 5);
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS certifications jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS blocked boolean NOT NULL DEFAULT false;

-- View compliance fornitori
CREATE OR REPLACE VIEW public.supplier_compliance AS
SELECT s.*,
  CASE WHEN s.blocked THEN 'bloccato'
       WHEN s.durc_expiry      IS NOT NULL AND s.durc_expiry      < CURRENT_DATE THEN 'durc_scaduto'
       WHEN s.insurance_expiry IS NOT NULL AND s.insurance_expiry < CURRENT_DATE THEN 'assicurazione_scaduta'
       WHEN s.haccp_expiry     IS NOT NULL AND s.haccp_expiry     < CURRENT_DATE THEN 'haccp_scaduto'
       WHEN s.visura_expiry    IS NOT NULL AND s.visura_expiry    < CURRENT_DATE THEN 'visura_scaduta'
       WHEN COALESCE(s.durc_expiry, CURRENT_DATE+365)      < CURRENT_DATE + 30
         OR COALESCE(s.insurance_expiry, CURRENT_DATE+365) < CURRENT_DATE + 30
         OR COALESCE(s.haccp_expiry, CURRENT_DATE+365)     < CURRENT_DATE + 30
         OR COALESCE(s.visura_expiry, CURRENT_DATE+365)    < CURRENT_DATE + 30
         THEN 'in_scadenza'
       ELSE 'ok'
  END AS compliance_status,
  LEAST(
    COALESCE(s.durc_expiry, DATE '9999-01-01'),
    COALESCE(s.insurance_expiry, DATE '9999-01-01'),
    COALESCE(s.haccp_expiry, DATE '9999-01-01'),
    COALESCE(s.visura_expiry, DATE '9999-01-01')
  ) AS next_expiry
FROM public.suppliers s;
GRANT SELECT ON public.supplier_compliance TO authenticated;

-- Asset scans (log scansioni QR)
CREATE TABLE IF NOT EXISTS public.asset_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  structure_id uuid REFERENCES public.structures(id) ON DELETE CASCADE,
  scanned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_agent text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_asset_scans_asset ON public.asset_scans(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_scans_struct ON public.asset_scans(structure_id);
GRANT SELECT, INSERT ON public.asset_scans TO authenticated;
GRANT ALL ON public.asset_scans TO service_role;
ALTER TABLE public.asset_scans ENABLE ROW LEVEL SECURITY;
CREATE POLICY asset_scans_select ON public.asset_scans FOR SELECT TO authenticated
  USING (structure_id IS NULL OR public.has_structure_access(auth.uid(), structure_id));
CREATE POLICY asset_scans_insert ON public.asset_scans FOR INSERT TO authenticated
  WITH CHECK (scanned_by = auth.uid()
    AND (structure_id IS NULL OR public.has_structure_access(auth.uid(), structure_id)));

-- Reorder requests (riordini magazzino)
DO $$ BEGIN
  CREATE TYPE public.reorder_status AS ENUM ('da_approvare','approvato','ordinato','ricevuto','annullato');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.reorder_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id uuid NOT NULL REFERENCES public.structures(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  quantity numeric(12,2) NOT NULL CHECK (quantity > 0),
  status public.reorder_status NOT NULL DEFAULT 'da_approvare',
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reorder_struct ON public.reorder_requests(structure_id);
CREATE INDEX IF NOT EXISTS idx_reorder_status ON public.reorder_requests(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reorder_requests TO authenticated;
GRANT ALL ON public.reorder_requests TO service_role;
ALTER TABLE public.reorder_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY reorder_select ON public.reorder_requests FOR SELECT TO authenticated
  USING (public.has_structure_access(auth.uid(), structure_id));
CREATE POLICY reorder_insert ON public.reorder_requests FOR INSERT TO authenticated
  WITH CHECK (public.has_structure_access(auth.uid(), structure_id));
CREATE POLICY reorder_update ON public.reorder_requests FOR UPDATE TO authenticated
  USING (public.has_structure_access(auth.uid(), structure_id))
  WITH CHECK (public.has_structure_access(auth.uid(), structure_id));
CREATE POLICY reorder_delete ON public.reorder_requests FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) AND public.has_structure_access(auth.uid(), structure_id));
CREATE TRIGGER reorder_updated BEFORE UPDATE ON public.reorder_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- View per articoli sotto scorta (KPI riordini)
CREATE OR REPLACE VIEW public.low_stock_items AS
SELECT i.id, i.structure_id, i.sku, i.name, i.quantity, i.min_quantity, i.unit,
       i.supplier_id, i.unit_cost,
       GREATEST(i.min_quantity - i.quantity, 0) AS shortage,
       GREATEST(i.min_quantity - i.quantity, 0) * COALESCE(i.unit_cost,0) AS estimated_cost
FROM public.inventory_items i
WHERE i.quantity <= i.min_quantity;
GRANT SELECT ON public.low_stock_items TO authenticated;
