
-- =========================================================
-- PHASE 0.14 — SECURITY HARDENING
-- =========================================================

-- 1) PROFILES: restrict read to owner/admin + expose safe public view
DROP POLICY IF EXISTS "profiles read all authenticated" ON public.profiles;
CREATE POLICY "profiles read own or admin" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin(auth.uid()));

CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = on) AS
  SELECT id, full_name, avatar_url FROM public.profiles;
GRANT SELECT ON public.public_profiles TO authenticated;

-- 2) USER_ROLES: admin-only writes
DROP POLICY IF EXISTS "user_roles admin insert" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles admin update" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles admin delete" ON public.user_roles;
CREATE POLICY "user_roles admin insert" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "user_roles admin update" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "user_roles admin delete" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- 3) SUPPLIERS: NULL structure_id only admins
DROP POLICY IF EXISTS "suppliers_access" ON public.suppliers;
CREATE POLICY "suppliers_select" ON public.suppliers FOR SELECT TO authenticated
  USING (
    (structure_id IS NOT NULL AND public.has_structure_access(auth.uid(), structure_id))
    OR (structure_id IS NULL AND public.is_admin(auth.uid()))
  );
CREATE POLICY "suppliers_insert" ON public.suppliers FOR INSERT TO authenticated
  WITH CHECK (
    (structure_id IS NOT NULL AND public.has_structure_access(auth.uid(), structure_id))
    OR (structure_id IS NULL AND public.is_admin(auth.uid()))
  );
CREATE POLICY "suppliers_update" ON public.suppliers FOR UPDATE TO authenticated
  USING (
    (structure_id IS NOT NULL AND public.has_structure_access(auth.uid(), structure_id))
    OR (structure_id IS NULL AND public.is_admin(auth.uid()))
  )
  WITH CHECK (
    (structure_id IS NOT NULL AND public.has_structure_access(auth.uid(), structure_id))
    OR (structure_id IS NULL AND public.is_admin(auth.uid()))
  );
CREATE POLICY "suppliers_delete" ON public.suppliers FOR DELETE TO authenticated
  USING (
    (structure_id IS NOT NULL AND public.has_structure_access(auth.uid(), structure_id) AND public.is_admin(auth.uid()))
    OR (structure_id IS NULL AND public.is_admin(auth.uid()))
  );

-- 4) SLA_VIOLATIONS: split ALL -> SELECT for members, write admin-only
DROP POLICY IF EXISTS "sla violations struct" ON public.sla_violations;
CREATE POLICY "sla_viol_select" ON public.sla_violations FOR SELECT TO authenticated
  USING (structure_id IS NULL OR public.has_structure_access(auth.uid(), structure_id));
CREATE POLICY "sla_viol_insert" ON public.sla_violations FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "sla_viol_update" ON public.sla_violations FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "sla_viol_delete" ON public.sla_violations FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- 5) PENALTY_RULES: same split
DROP POLICY IF EXISTS "penalty rules struct" ON public.penalty_rules;
CREATE POLICY "penalty_select" ON public.penalty_rules FOR SELECT TO authenticated
  USING (structure_id IS NULL OR public.has_structure_access(auth.uid(), structure_id));
CREATE POLICY "penalty_insert" ON public.penalty_rules FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "penalty_update" ON public.penalty_rules FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "penalty_delete" ON public.penalty_rules FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- 6) AUDIT_LOG: remove user inserts (triggers use SECURITY DEFINER)
DROP POLICY IF EXISTS "audit_insert_any" ON public.audit_log;
-- audit_select_admin remains

-- 7) MESSAGES: force sender_id = auth.uid(), no agent impersonation
DROP POLICY IF EXISTS "msg_insert_member" ON public.messages;
CREATE POLICY "msg_insert_member" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    public.is_conversation_member(conversation_id, auth.uid())
    AND sender_id = auth.uid()
    AND sender_kind = 'user'
  );

-- 8) REPORT_TEMPLATES: shared visibility limited to same structure
DROP POLICY IF EXISTS "report tmpl read" ON public.report_templates;
CREATE POLICY "report tmpl read" ON public.report_templates FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR public.is_admin(auth.uid())
    OR (
      is_shared = true
      AND structure_id IS NOT NULL
      AND public.has_structure_access(auth.uid(), structure_id)
    )
  );

-- 9) STORAGE: assets bucket — first folder = structure_id
DROP POLICY IF EXISTS "assets bucket auth read" ON storage.objects;
DROP POLICY IF EXISTS "assets bucket auth write" ON storage.objects;
DROP POLICY IF EXISTS "assets bucket auth update" ON storage.objects;
DROP POLICY IF EXISTS "assets bucket auth delete" ON storage.objects;

CREATE POLICY "assets struct read" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'assets'
    AND public.has_structure_access(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );
CREATE POLICY "assets struct write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'assets'
    AND public.has_structure_access(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );
CREATE POLICY "assets struct update" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'assets'
    AND public.has_structure_access(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );
CREATE POLICY "assets struct delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'assets'
    AND public.has_structure_access(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

-- 10) STORAGE: tickets bucket — first folder = ticket_id, derive structure
DROP POLICY IF EXISTS "tickets bucket auth read" ON storage.objects;
DROP POLICY IF EXISTS "tickets bucket auth write" ON storage.objects;
DROP POLICY IF EXISTS "tickets bucket auth update" ON storage.objects;
DROP POLICY IF EXISTS "tickets bucket auth delete" ON storage.objects;
DROP POLICY IF EXISTS "tickets_obj_select" ON storage.objects;
DROP POLICY IF EXISTS "tickets_obj_insert" ON storage.objects;
DROP POLICY IF EXISTS "tickets_obj_delete" ON storage.objects;

CREATE OR REPLACE FUNCTION public.user_has_ticket_access(_user uuid, _ticket_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = _ticket_id
      AND (t.structure_id IS NULL OR public.has_structure_access(_user, t.structure_id))
  )
$$;
REVOKE EXECUTE ON FUNCTION public.user_has_ticket_access(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_has_ticket_access(uuid, uuid) TO authenticated;

CREATE POLICY "tickets struct read" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'tickets'
    AND public.user_has_ticket_access(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );
CREATE POLICY "tickets struct write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'tickets'
    AND public.user_has_ticket_access(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );
CREATE POLICY "tickets struct update" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'tickets'
    AND public.user_has_ticket_access(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );
CREATE POLICY "tickets struct delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'tickets'
    AND public.user_has_ticket_access(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );
