
CREATE OR REPLACE FUNCTION public.dashboard_structure_kpi(_structure uuid)
RETURNS TABLE (
  open_tickets bigint,
  overdue_tickets bigint,
  sla_resolve_30d_pct numeric,
  expiring_contracts_90d bigint,
  invoice_total_30d numeric,
  total_assets bigint,
  pending_maintenance bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT
    (SELECT count(*) FROM public.tickets t WHERE t.structure_id = _structure
       AND t.status NOT IN ('chiuso','annullato')
       AND has_structure_access(auth.uid(), t.structure_id)),
    (SELECT count(*) FROM public.tickets t WHERE t.structure_id = _structure
       AND t.resolved_at IS NULL AND t.status NOT IN ('chiuso','annullato')
       AND t.resolve_due_at IS NOT NULL AND t.resolve_due_at < now()
       AND has_structure_access(auth.uid(), t.structure_id)),
    (SELECT round(100.0 * count(*) FILTER (WHERE resolved_at IS NOT NULL AND resolve_due_at IS NOT NULL AND resolved_at <= resolve_due_at)
                  / NULLIF(count(*) FILTER (WHERE resolved_at IS NOT NULL), 0), 1)
     FROM public.tickets t WHERE t.structure_id = _structure
       AND t.created_at >= now() - interval '30 days'
       AND has_structure_access(auth.uid(), t.structure_id)),
    (SELECT count(*) FROM public.contracts c WHERE c.structure_id = _structure
       AND c.status = 'attivo' AND c.end_date IS NOT NULL
       AND (c.end_date - CURRENT_DATE) BETWEEN 0 AND 90
       AND has_structure_access(auth.uid(), c.structure_id)),
    (SELECT COALESCE(sum(amount_total), 0) FROM public.invoices i WHERE i.structure_id = _structure
       AND i.issue_date >= CURRENT_DATE - interval '30 days'
       AND has_structure_access(auth.uid(), i.structure_id)),
    (SELECT count(*) FROM public.assets a WHERE a.structure_id = _structure
       AND has_structure_access(auth.uid(), a.structure_id)),
    (SELECT count(*) FROM public.maintenance_tasks mt
       JOIN public.maintenance_plans mp ON mp.id = mt.plan_id
       WHERE mp.structure_id = _structure AND mt.status = 'pending'
       AND has_structure_access(auth.uid(), mp.structure_id));
$fn$;

CREATE OR REPLACE FUNCTION public.dashboard_weekly_tickets(_structure uuid)
RETURNS TABLE (week_start date, opened bigint, resolved bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  WITH weeks AS (
    SELECT generate_series(date_trunc('week', CURRENT_DATE)::date - interval '11 weeks',
                           date_trunc('week', CURRENT_DATE)::date, interval '1 week')::date AS w
  )
  SELECT w.w,
    (SELECT count(*) FROM public.tickets t WHERE t.structure_id = _structure
       AND t.created_at >= w.w AND t.created_at < w.w + interval '7 days'
       AND has_structure_access(auth.uid(), t.structure_id)),
    (SELECT count(*) FROM public.tickets t WHERE t.structure_id = _structure
       AND t.resolved_at >= w.w AND t.resolved_at < w.w + interval '7 days'
       AND has_structure_access(auth.uid(), t.structure_id))
  FROM weeks w ORDER BY w.w;
$fn$;

CREATE OR REPLACE FUNCTION public.dashboard_top_suppliers(_structure uuid)
RETURNS TABLE (supplier_id uuid, supplier_name text, tickets_count bigint, rating numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT s.id, s.name, count(t.id), s.rating
  FROM public.suppliers s
  LEFT JOIN public.tickets t ON t.structure_id = _structure
       AND t.created_at >= now() - interval '90 days'
  WHERE s.structure_id = _structure OR s.structure_id IS NULL
    AND has_structure_access(auth.uid(), _structure)
  GROUP BY s.id, s.name, s.rating
  ORDER BY count(t.id) DESC NULLS LAST, s.rating DESC NULLS LAST
  LIMIT 5;
$fn$;

CREATE OR REPLACE FUNCTION public.dashboard_tickets_by_category(_structure uuid)
RETURNS TABLE (category text, count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT COALESCE(t.category_id::text, 'altro'), count(*)
  FROM public.tickets t WHERE t.structure_id = _structure
    AND t.status NOT IN ('chiuso','annullato')
    AND has_structure_access(auth.uid(), t.structure_id)
  GROUP BY t.category_id ORDER BY count(*) DESC;
$fn$;
