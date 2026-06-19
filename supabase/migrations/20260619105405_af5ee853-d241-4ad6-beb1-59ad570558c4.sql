
-- 1) has_structure_access: NULL structure_id bypass solo per super_admin
CREATE OR REPLACE FUNCTION public.has_structure_access(_user_id uuid, _structure_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND (
        role = 'super_admin'
        OR structure_id = _structure_id
      )
  )
$$;

-- 2) tickets update: WITH CHECK deve impedire cambio struttura
DROP POLICY IF EXISTS "tickets update" ON public.tickets;
CREATE POLICY "tickets update" ON public.tickets
FOR UPDATE
USING (
  assigned_to = auth.uid()
  OR reported_by = auth.uid()
  OR public.is_admin(auth.uid())
  OR public.has_structure_access(auth.uid(), structure_id)
)
WITH CHECK (
  public.has_structure_access(auth.uid(), structure_id)
);

-- 3) report_templates: rimuovi branch is_shared dal SELECT generico
DROP POLICY IF EXISTS "report tmpl read" ON public.report_templates;
CREATE POLICY "report tmpl read" ON public.report_templates
FOR SELECT
USING (
  owner_id = auth.uid()
  OR public.is_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.report_template_access a
    LEFT JOIN public.user_roles ur ON ur.user_id = auth.uid()
    WHERE a.template_id = report_templates.id
      AND ((a.user_id = auth.uid()) OR (a.role IS NOT NULL AND a.role = ur.role))
  )
);

-- 4) Restrictive INSERT policies su audit_log e report_delivery_queue
DROP POLICY IF EXISTS "audit_no_user_insert" ON public.audit_log;
CREATE POLICY "audit_no_user_insert" ON public.audit_log
AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (false);

DROP POLICY IF EXISTS "queue_no_user_insert" ON public.report_delivery_queue;
CREATE POLICY "queue_no_user_insert" ON public.report_delivery_queue
AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (false);

DROP POLICY IF EXISTS "queue_no_user_update" ON public.report_delivery_queue;
CREATE POLICY "queue_no_user_update" ON public.report_delivery_queue
AS RESTRICTIVE FOR UPDATE TO authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "queue_no_user_delete" ON public.report_delivery_queue;
CREATE POLICY "queue_no_user_delete" ON public.report_delivery_queue
AS RESTRICTIVE FOR DELETE TO authenticated USING (false);
