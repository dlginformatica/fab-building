
-- ============ FASE 2-10 HotelOps killer features ============

-- ROOMS: aggiungi QR guest token + stato pulizia
ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS qr_token text UNIQUE,
  ADD COLUMN IF NOT EXISTS housekeeping_status text NOT NULL DEFAULT 'clean'
    CHECK (housekeeping_status IN ('clean','dirty','in_progress','inspected','out_of_order')),
  ADD COLUMN IF NOT EXISTS occupancy_status text NOT NULL DEFAULT 'vacant'
    CHECK (occupancy_status IN ('vacant','occupied','arrival','departure','stayover'));

-- ============ HOUSEKEEPING TASKS ============
CREATE TABLE IF NOT EXISTS public.housekeeping_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id uuid NOT NULL REFERENCES public.structures(id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  task_date date NOT NULL DEFAULT CURRENT_DATE,
  task_type text NOT NULL DEFAULT 'pulizia' CHECK (task_type IN ('pulizia','cambio_completo','rifacimento','ispezione','blocco')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','done','skipped')),
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high')),
  notes text,
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.housekeeping_tasks TO authenticated;
GRANT ALL ON public.housekeeping_tasks TO service_role;
ALTER TABLE public.housekeeping_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hk_access" ON public.housekeeping_tasks FOR ALL TO authenticated
  USING (public.has_structure_access(auth.uid(), structure_id))
  WITH CHECK (public.has_structure_access(auth.uid(), structure_id));
CREATE TRIGGER tg_hk_upd BEFORE UPDATE ON public.housekeeping_tasks
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE INDEX IF NOT EXISTS idx_hk_struct_date ON public.housekeeping_tasks(structure_id, task_date);
CREATE INDEX IF NOT EXISTS idx_hk_assigned ON public.housekeeping_tasks(assigned_to, status);

-- ============ GUEST ISSUES (QR in camera) ============
CREATE TABLE IF NOT EXISTS public.guest_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id uuid NOT NULL REFERENCES public.structures(id) ON DELETE CASCADE,
  room_id uuid REFERENCES public.rooms(id) ON DELETE SET NULL,
  category text NOT NULL DEFAULT 'altro',
  description text NOT NULL,
  guest_name text,
  guest_contact text,
  language text DEFAULT 'it',
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','triaged','converted','dismissed')),
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'qr',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.guest_issues TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.guest_issues TO authenticated;
GRANT ALL ON public.guest_issues TO service_role;
ALTER TABLE public.guest_issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "guest_issue_anon_insert" ON public.guest_issues FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "guest_issue_staff_all" ON public.guest_issues FOR ALL TO authenticated
  USING (public.has_structure_access(auth.uid(), structure_id))
  WITH CHECK (public.has_structure_access(auth.uid(), structure_id));
CREATE TRIGGER tg_gi_upd BEFORE UPDATE ON public.guest_issues
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Lookup pubblico per QR camera (solo nome struttura + nome camera, niente PII)
CREATE OR REPLACE FUNCTION public.room_by_qr(_token text)
RETURNS TABLE(room_id uuid, room_name text, structure_id uuid, structure_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.name, s.id, s.name
  FROM public.rooms r JOIN public.structures s ON s.id = r.structure_id
  WHERE r.qr_token = _token LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.room_by_qr(text) TO anon, authenticated;

-- ============ INTEGRATIONS (PMS / Channel / WA / Fatture in Cloud) ============
CREATE TABLE IF NOT EXISTS public.integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id uuid NOT NULL REFERENCES public.structures(id) ON DELETE CASCADE,
  provider text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('pms','channel_manager','accounting','messaging','energy')),
  enabled boolean NOT NULL DEFAULT false,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_sync_at timestamptz,
  last_sync_status text,
  last_sync_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(structure_id, provider)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integrations TO authenticated;
GRANT ALL ON public.integrations TO service_role;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "integ_admin" ON public.integrations FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND public.has_structure_access(auth.uid(), structure_id))
  WITH CHECK (public.is_admin(auth.uid()) AND public.has_structure_access(auth.uid(), structure_id));
CREATE TRIGGER tg_integ_upd BEFORE UPDATE ON public.integrations
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ CASH MOVEMENTS (Prima Nota) ============
CREATE TABLE IF NOT EXISTS public.cash_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id uuid NOT NULL REFERENCES public.structures(id) ON DELETE CASCADE,
  movement_date date NOT NULL DEFAULT CURRENT_DATE,
  kind text NOT NULL CHECK (kind IN ('entrata','uscita')),
  category text NOT NULL DEFAULT 'altro',
  description text NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  payment_method text NOT NULL DEFAULT 'contanti' CHECK (payment_method IN ('contanti','pos','bonifico','assegno','altro')),
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_movements TO authenticated;
GRANT ALL ON public.cash_movements TO service_role;
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cash_access" ON public.cash_movements FOR ALL TO authenticated
  USING (public.has_structure_access(auth.uid(), structure_id))
  WITH CHECK (public.has_structure_access(auth.uid(), structure_id));
CREATE TRIGGER tg_cash_upd BEFORE UPDATE ON public.cash_movements
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE INDEX IF NOT EXISTS idx_cash_struct_date ON public.cash_movements(structure_id, movement_date DESC);

-- ============ STRUCTURES: campi fiscali per SDI ============
ALTER TABLE public.structures
  ADD COLUMN IF NOT EXISTS vat_number text,
  ADD COLUMN IF NOT EXISTS fiscal_code text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS province text,
  ADD COLUMN IF NOT EXISTS regime_fiscale text DEFAULT 'RF01';

-- ============ Helper: KPI housekeeping ============
CREATE OR REPLACE FUNCTION public.housekeeping_kpi(_structure uuid, _date date DEFAULT CURRENT_DATE)
RETURNS TABLE(total_rooms bigint, dirty bigint, in_progress bigint, clean bigint, ooo bigint, tasks_today bigint, tasks_done bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    (SELECT count(*) FROM public.rooms WHERE structure_id = _structure),
    (SELECT count(*) FROM public.rooms WHERE structure_id = _structure AND housekeeping_status = 'dirty'),
    (SELECT count(*) FROM public.rooms WHERE structure_id = _structure AND housekeeping_status = 'in_progress'),
    (SELECT count(*) FROM public.rooms WHERE structure_id = _structure AND housekeeping_status IN ('clean','inspected')),
    (SELECT count(*) FROM public.rooms WHERE structure_id = _structure AND housekeeping_status = 'out_of_order'),
    (SELECT count(*) FROM public.housekeeping_tasks WHERE structure_id = _structure AND task_date = _date),
    (SELECT count(*) FROM public.housekeeping_tasks WHERE structure_id = _structure AND task_date = _date AND status = 'done')
$$;
GRANT EXECUTE ON FUNCTION public.housekeeping_kpi(uuid, date) TO authenticated;
