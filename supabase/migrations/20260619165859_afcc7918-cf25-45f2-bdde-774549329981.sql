
DROP POLICY IF EXISTS "report tmpl read" ON public.report_templates;
CREATE POLICY "report tmpl read"
ON public.report_templates
FOR SELECT
TO authenticated
USING (
  (owner_id = auth.uid())
  OR public.is_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.report_template_access a
    LEFT JOIN public.user_roles ur ON ur.user_id = auth.uid()
    WHERE a.template_id = report_templates.id
      AND ((a.user_id = auth.uid()) OR (a.role IS NOT NULL AND a.role = ur.role))
  )
);

CREATE POLICY "ticket_comments delete own or admin"
ON public.ticket_comments
FOR DELETE
TO authenticated
USING (author_id = auth.uid() OR public.is_admin(auth.uid()));

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_audit_qr() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_log_reorder_status() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.compute_sla_violation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_audit_log() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_inherit_area_from_asset() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_sla_violation_notify() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_asset_media_inherit_struct() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_asset_doc_inherit_struct() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_sla_on_ticket() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_report_layout_audit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_delegation_audit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_sla_warnings(integer) FROM PUBLIC, anon, authenticated;
