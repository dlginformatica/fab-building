
CREATE TABLE public.asset_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  structure_id uuid,
  actor_id uuid,
  field text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_asset_history_asset ON public.asset_history(asset_id, created_at DESC);
GRANT SELECT, INSERT ON public.asset_history TO authenticated;
GRANT ALL ON public.asset_history TO service_role;
ALTER TABLE public.asset_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "asset_history_read" ON public.asset_history FOR SELECT TO authenticated
  USING (structure_id IS NULL OR public.has_structure_access(auth.uid(), structure_id));
CREATE POLICY "asset_history_insert" ON public.asset_history FOR INSERT TO authenticated WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.tg_asset_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_actor uuid := auth.uid();
  v_fields text[] := ARRAY['name','code','brand','model','serial_number','status','room_id','floor_id','install_date','warranty_until','notes','category_id','area','photo_url'];
  k text; old_v jsonb; new_v jsonb;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    FOREACH k IN ARRAY v_fields LOOP
      old_v := to_jsonb(OLD) -> k;
      new_v := to_jsonb(NEW) -> k;
      IF old_v IS DISTINCT FROM new_v THEN
        INSERT INTO public.asset_history(asset_id, structure_id, actor_id, field, old_value, new_value)
        VALUES (NEW.id, NEW.structure_id, v_actor, k, old_v, new_v);
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS tg_asset_history ON public.assets;
CREATE TRIGGER tg_asset_history AFTER UPDATE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.tg_asset_history();

CREATE OR REPLACE FUNCTION public.asset_maintenance_log(_asset uuid)
RETURNS TABLE (kind text, ref_id uuid, title text, status text, occurred_at timestamptz, closed_at timestamptz, hours numeric, notes text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT * FROM (
    SELECT 'preventiva'::text AS kind, mt.id AS ref_id, COALESCE(mp.name,'Manutenzione') AS title, mt.status::text AS status,
           COALESCE(mt.scheduled_for::timestamptz, mt.due_date::timestamptz) AS occurred_at,
           mt.completed_at AS closed_at, mt.actual_hours AS hours, mt.notes AS notes
    FROM public.maintenance_tasks mt
    JOIN public.maintenance_plans mp ON mp.id = mt.plan_id
    WHERE mp.asset_id = _asset
      AND (auth.uid() IS NULL OR mp.structure_id IS NULL OR public.has_structure_access(auth.uid(), mp.structure_id))
    UNION ALL
    SELECT 'correttiva'::text, t.id, t.title, t.status::text,
           t.created_at, t.resolved_at, NULL::numeric, t.description
    FROM public.tickets t
    WHERE t.asset_id = _asset
      AND (auth.uid() IS NULL OR t.structure_id IS NULL OR public.has_structure_access(auth.uid(), t.structure_id))
  ) u
  ORDER BY occurred_at DESC NULLS LAST;
$fn$;

CREATE OR REPLACE FUNCTION public.asset_maintenance_kpi(_asset uuid)
RETURNS TABLE (total_failures bigint, total_repairs bigint, mtbf_hours numeric, mttr_hours numeric, last_failure_at timestamptz, last_repair_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  WITH failures AS (
    SELECT t.created_at, t.resolved_at FROM public.tickets t
    WHERE t.asset_id = _asset
      AND (auth.uid() IS NULL OR t.structure_id IS NULL OR public.has_structure_access(auth.uid(), t.structure_id))
  ),
  ordered AS (SELECT created_at, LAG(created_at) OVER (ORDER BY created_at) AS prev_created FROM failures)
  SELECT
    (SELECT count(*) FROM failures),
    (SELECT count(*) FROM failures WHERE resolved_at IS NOT NULL),
    (SELECT round(avg(EXTRACT(EPOCH FROM (created_at - prev_created))/3600.0)::numeric, 1) FROM ordered WHERE prev_created IS NOT NULL),
    (SELECT round(avg(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600.0)::numeric, 1) FROM failures WHERE resolved_at IS NOT NULL),
    (SELECT max(created_at) FROM failures),
    (SELECT max(resolved_at) FROM failures);
$fn$;
