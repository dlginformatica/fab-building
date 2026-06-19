
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS notice_period_days integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS renewal_terms text,
  ADD COLUMN IF NOT EXISTS next_review_at date,
  ADD COLUMN IF NOT EXISTS attachments_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_notified_at timestamptz;

CREATE TABLE IF NOT EXISTS public.contract_renewals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  structure_id uuid NOT NULL REFERENCES public.structures(id) ON DELETE CASCADE,
  previous_end_date date,
  new_end_date date NOT NULL,
  amount numeric(12,2),
  notes text,
  renewed_by uuid REFERENCES auth.users(id),
  renewed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_renewals TO authenticated;
GRANT ALL ON public.contract_renewals TO service_role;
ALTER TABLE public.contract_renewals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contract_renewals_access" ON public.contract_renewals
  FOR ALL TO authenticated
  USING (has_structure_access(auth.uid(), structure_id))
  WITH CHECK (has_structure_access(auth.uid(), structure_id));

CREATE TABLE IF NOT EXISTS public.contract_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  structure_id uuid NOT NULL REFERENCES public.structures(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  size_bytes bigint,
  category text,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_attachments TO authenticated;
GRANT ALL ON public.contract_attachments TO service_role;
ALTER TABLE public.contract_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contract_attachments_access" ON public.contract_attachments
  FOR ALL TO authenticated
  USING (has_structure_access(auth.uid(), structure_id))
  WITH CHECK (has_structure_access(auth.uid(), structure_id));

CREATE INDEX IF NOT EXISTS idx_contract_renewals_contract ON public.contract_renewals(contract_id, renewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_contract_attachments_contract ON public.contract_attachments(contract_id);
CREATE INDEX IF NOT EXISTS idx_contracts_expiry ON public.contracts(end_date) WHERE status = 'attivo';

CREATE OR REPLACE FUNCTION public.tg_contract_attachments_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.contracts SET attachments_count = attachments_count + 1 WHERE id = NEW.contract_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.contracts SET attachments_count = GREATEST(attachments_count - 1, 0) WHERE id = OLD.contract_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
DROP TRIGGER IF EXISTS contract_attach_count ON public.contract_attachments;
CREATE TRIGGER contract_attach_count
  AFTER INSERT OR DELETE ON public.contract_attachments
  FOR EACH ROW EXECUTE FUNCTION public.tg_contract_attachments_count();

CREATE OR REPLACE FUNCTION public.tg_contract_apply_renewal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.contracts
     SET end_date = NEW.new_end_date,
         status = 'attivo',
         last_notified_at = NULL,
         amount = COALESCE(NEW.amount, amount)
   WHERE id = NEW.contract_id;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS contract_apply_renewal ON public.contract_renewals;
CREATE TRIGGER contract_apply_renewal
  AFTER INSERT ON public.contract_renewals
  FOR EACH ROW EXECUTE FUNCTION public.tg_contract_apply_renewal();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid
                 WHERE t.typname = 'notification_event' AND e.enumlabel = 'contract_expiring') THEN
    ALTER TYPE public.notification_event ADD VALUE 'contract_expiring';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.contracts_due_for_notice()
RETURNS TABLE(
  contract_id uuid,
  structure_id uuid,
  code text,
  title text,
  supplier_name text,
  end_date date,
  days_left int,
  auto_renew boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.structure_id, c.code, c.title, s.name,
         c.end_date, (c.end_date - CURRENT_DATE)::int,
         c.auto_renew
  FROM public.contracts c
  JOIN public.suppliers s ON s.id = c.supplier_id
  WHERE c.status = 'attivo'
    AND c.end_date IS NOT NULL
    AND (c.end_date - CURRENT_DATE) BETWEEN 0 AND COALESCE(c.notice_period_days, 30)
    AND (c.last_notified_at IS NULL OR c.last_notified_at < now() - interval '24 hours');
$$;
