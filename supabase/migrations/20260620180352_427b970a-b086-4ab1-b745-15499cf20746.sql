
-- 1) asset_history INSERT: require structure access and actor=auth.uid()
DROP POLICY IF EXISTS "asset_history_insert" ON public.asset_history;
CREATE POLICY "asset_history_insert" ON public.asset_history
  FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND (structure_id IS NULL OR public.has_structure_access(auth.uid(), structure_id))
  );

-- 2) notification_templates: restrict writes to admins with structure access
DROP POLICY IF EXISTS "auth manage templates" ON public.notification_templates;
DROP POLICY IF EXISTS "auth read templates" ON public.notification_templates;

CREATE POLICY "notification_templates_read" ON public.notification_templates
  FOR SELECT TO authenticated
  USING (
    structure_id IS NULL
    OR public.has_structure_access(auth.uid(), structure_id)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

CREATE POLICY "notification_templates_write" ON public.notification_templates
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR (
      structure_id IS NOT NULL
      AND public.has_structure_access(auth.uid(), structure_id)
      AND (
        public.has_role(auth.uid(), 'direttore'::public.app_role)
        OR public.has_role(auth.uid(), 'facility_manager'::public.app_role)
      )
    )
  );

CREATE POLICY "notification_templates_update" ON public.notification_templates
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR (structure_id IS NOT NULL AND public.has_structure_access(auth.uid(), structure_id)
        AND (public.has_role(auth.uid(), 'direttore'::public.app_role)
             OR public.has_role(auth.uid(), 'facility_manager'::public.app_role)))
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR (structure_id IS NOT NULL AND public.has_structure_access(auth.uid(), structure_id)
        AND (public.has_role(auth.uid(), 'direttore'::public.app_role)
             OR public.has_role(auth.uid(), 'facility_manager'::public.app_role)))
  );

CREATE POLICY "notification_templates_delete" ON public.notification_templates
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR (structure_id IS NOT NULL AND public.has_structure_access(auth.uid(), structure_id)
        AND public.has_role(auth.uid(), 'direttore'::public.app_role))
  );

-- 3) org_invitations: remove broad anon SELECT, expose token lookup via SECURITY DEFINER fn
DROP POLICY IF EXISTS "invitations anon by token" ON public.org_invitations;

CREATE OR REPLACE FUNCTION public.get_invitation_by_token(_token text)
RETURNS TABLE (
  id uuid, org_id uuid, email text, org_role text, app_role text,
  modules text[], structure_ids uuid[], expires_at timestamptz,
  accepted_at timestamptz, revoked_at timestamptz, org_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT i.id, i.org_id, i.email, i.org_role::text, i.app_role::text,
         i.modules, i.structure_ids, i.expires_at,
         i.accepted_at, i.revoked_at, o.name AS org_name
  FROM public.org_invitations i
  LEFT JOIN public.organizations o ON o.id = i.org_id
  WHERE i.token = _token
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_invitation_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(text) TO anon, authenticated;

-- 4) permission_audit: block direct API inserts (keep trigger-based writes via SECURITY DEFINER)
DROP POLICY IF EXISTS "system can insert audit" ON public.permission_audit;

-- 5) supplier_documents SELECT: scope to users with access to supplier's structure
DROP POLICY IF EXISTS "suppdocs_read_authenticated" ON public.supplier_documents;
CREATE POLICY "suppdocs_read_scoped" ON public.supplier_documents
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.suppliers s
      WHERE s.id = supplier_documents.supplier_id
        AND (s.structure_id IS NULL OR public.has_structure_access(auth.uid(), s.structure_id))
    )
  );

-- 6) storage.contracts INSERT: require structure access via contract_attachments path
DROP POLICY IF EXISTS "contracts_bucket_write" ON storage.objects;
CREATE POLICY "contracts_bucket_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'contracts'
    AND EXISTS (
      SELECT 1 FROM public.structures s
      WHERE public.has_structure_access(auth.uid(), s.id)
        AND (storage.foldername(name))[1] = s.id::text
    )
  );

-- 7) storage.supplier-docs SELECT: restrict to users with structure access
DROP POLICY IF EXISTS "supplier_docs_read" ON storage.objects;
CREATE POLICY "supplier_docs_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'supplier-docs'
    AND (
      public.has_role(auth.uid(), 'super_admin'::public.app_role)
      OR EXISTS (
        SELECT 1 FROM public.suppliers s
        WHERE (storage.foldername(name))[1] = s.id::text
          AND (s.structure_id IS NULL OR public.has_structure_access(auth.uid(), s.structure_id))
      )
    )
  );
