
-- =========================================================================
-- SECURITY FIX: multi-tenant isolation per organization
-- =========================================================================

-- 1) is_org_admin
CREATE OR REPLACE FUNCTION public.is_org_admin(_user uuid, _org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.has_role(_user, 'super_admin')
    OR (
      _org IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.org_memberships m
        WHERE m.org_id = _org AND m.user_id = _user AND m.role IN ('owner','admin')
      )
    )
$$;

-- 2) structure_org helper
CREATE OR REPLACE FUNCTION public.structure_org(_structure uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT organization_id FROM public.structures WHERE id = _structure
$$;

-- 3) Extend has_structure_access to include org membership
CREATE OR REPLACE FUNCTION public.has_structure_access(_user_id uuid, _structure_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.has_role(_user_id, 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id AND structure_id = _structure_id
    )
    OR EXISTS (
      SELECT 1 FROM public.structures s
      JOIN public.org_memberships m ON m.org_id = s.organization_id
      WHERE s.id = _structure_id AND m.user_id = _user_id
    )
$$;

-- 4) handle_new_user: stop granting global 'direttore'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org uuid; v_name text; v_trial int;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email,
          COALESCE(NEW.raw_user_meta_data->>'full_name',
                   NEW.raw_user_meta_data->>'name',
                   split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;

  IF lower(NEW.email) = 'info@dlginformatica.it' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'super_admin'::app_role) ON CONFLICT DO NOTHING;
  END IF;

  -- Utente invitato: l'invito gestisce ruoli/org
  IF EXISTS (
    SELECT 1 FROM public.org_invitations
    WHERE lower(email) = lower(NEW.email)
      AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now()
  ) THEN
    RETURN NEW;
  END IF;

  v_name := COALESCE(NULLIF(NEW.raw_user_meta_data->>'org_name',''),
                     'Organizzazione di ' || split_part(NEW.email,'@',1));
  INSERT INTO public.organizations(name, owner_id) VALUES (v_name, NEW.id) RETURNING id INTO v_org;
  INSERT INTO public.org_memberships(org_id, user_id, role) VALUES (v_org, NEW.id, 'owner');
  UPDATE public.profiles SET organization_id = v_org WHERE id = NEW.id;
  -- NOTA: NON inseriamo più un ruolo 'direttore' globale: l'utente è admin
  -- della propria org via org_memberships(role='owner') e is_org_admin().

  SELECT trial_days INTO v_trial FROM public.subscription_plans WHERE tier='large' LIMIT 1;
  v_trial := COALESCE(v_trial, 30);
  INSERT INTO public.org_subscriptions(org_id, tier, status, trial_started_at, trial_ends_at)
  VALUES (v_org, 'small', 'trial', now(), now() + (v_trial || ' days')::interval)
  ON CONFLICT (org_id) DO NOTHING;

  RETURN NEW;
END $$;

-- 5) Cleanup: rimuovi ruoli globali residui che concedono admin cross-org
DELETE FROM public.user_roles ur
 WHERE ur.structure_id IS NULL
   AND ur.role IN ('direttore'::app_role,'facility_manager'::app_role)
   AND NOT EXISTS (SELECT 1 FROM public.user_roles s WHERE s.user_id = ur.user_id AND s.role = 'super_admin'::app_role);

-- =========================================================================
-- 6) STRUCTURES: drop legacy permissive policies
-- =========================================================================
DROP POLICY IF EXISTS "structures read accessible" ON public.structures;
DROP POLICY IF EXISTS "structures admin manage"   ON public.structures;

-- =========================================================================
-- 7) TICKETS: replace is_admin() with org-scoped admin
-- =========================================================================
DROP POLICY IF EXISTS "tickets delete admin" ON public.tickets;
CREATE POLICY "tickets delete org admin" ON public.tickets FOR DELETE
  USING (public.is_org_admin(auth.uid(), public.structure_org(structure_id)));

DROP POLICY IF EXISTS "tickets update" ON public.tickets;
CREATE POLICY "tickets update" ON public.tickets FOR UPDATE
  USING (
    assigned_to = auth.uid()
    OR reported_by = auth.uid()
    OR public.has_structure_access(auth.uid(), structure_id)
    OR public.is_org_admin(auth.uid(), public.structure_org(structure_id))
  )
  WITH CHECK (public.has_structure_access(auth.uid(), structure_id));

-- =========================================================================
-- 8) SLA_VIOLATIONS: org-scoped
-- =========================================================================
DROP POLICY IF EXISTS "sla_viol_select" ON public.sla_violations;
DROP POLICY IF EXISTS "sla_viol_insert" ON public.sla_violations;
DROP POLICY IF EXISTS "sla_viol_update" ON public.sla_violations;
DROP POLICY IF EXISTS "sla_viol_delete" ON public.sla_violations;

CREATE POLICY "sla_viol_select" ON public.sla_violations FOR SELECT
  USING (
    public.has_role(auth.uid(),'super_admin')
    OR (structure_id IS NOT NULL AND public.has_structure_access(auth.uid(), structure_id))
  );
CREATE POLICY "sla_viol_insert" ON public.sla_violations FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(),'super_admin')
    OR (structure_id IS NOT NULL AND public.is_org_admin(auth.uid(), public.structure_org(structure_id)))
  );
CREATE POLICY "sla_viol_update" ON public.sla_violations FOR UPDATE
  USING (
    public.has_role(auth.uid(),'super_admin')
    OR (structure_id IS NOT NULL AND public.is_org_admin(auth.uid(), public.structure_org(structure_id)))
  ) WITH CHECK (
    public.has_role(auth.uid(),'super_admin')
    OR (structure_id IS NOT NULL AND public.is_org_admin(auth.uid(), public.structure_org(structure_id)))
  );
CREATE POLICY "sla_viol_delete" ON public.sla_violations FOR DELETE
  USING (
    public.has_role(auth.uid(),'super_admin')
    OR (structure_id IS NOT NULL AND public.is_org_admin(auth.uid(), public.structure_org(structure_id)))
  );

-- =========================================================================
-- 9) PENALTY_RULES: org-scoped, NULL structure_id solo super_admin
-- =========================================================================
DROP POLICY IF EXISTS "penalty_select" ON public.penalty_rules;
DROP POLICY IF EXISTS "penalty_insert" ON public.penalty_rules;
DROP POLICY IF EXISTS "penalty_update" ON public.penalty_rules;
DROP POLICY IF EXISTS "penalty_delete" ON public.penalty_rules;

CREATE POLICY "penalty_select" ON public.penalty_rules FOR SELECT
  USING (
    public.has_role(auth.uid(),'super_admin')
    OR (structure_id IS NOT NULL AND public.has_structure_access(auth.uid(), structure_id))
  );
CREATE POLICY "penalty_insert" ON public.penalty_rules FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(),'super_admin')
    OR (structure_id IS NOT NULL AND public.is_org_admin(auth.uid(), public.structure_org(structure_id)))
  );
CREATE POLICY "penalty_update" ON public.penalty_rules FOR UPDATE
  USING (
    public.has_role(auth.uid(),'super_admin')
    OR (structure_id IS NOT NULL AND public.is_org_admin(auth.uid(), public.structure_org(structure_id)))
  ) WITH CHECK (
    public.has_role(auth.uid(),'super_admin')
    OR (structure_id IS NOT NULL AND public.is_org_admin(auth.uid(), public.structure_org(structure_id)))
  );
CREATE POLICY "penalty_delete" ON public.penalty_rules FOR DELETE
  USING (
    public.has_role(auth.uid(),'super_admin')
    OR (structure_id IS NOT NULL AND public.is_org_admin(auth.uid(), public.structure_org(structure_id)))
  );

-- =========================================================================
-- 10) AUDIT_LOG: lettura ristretta a super_admin o org admin della riga
-- =========================================================================
DROP POLICY IF EXISTS "audit_select_admin" ON public.audit_log;
CREATE POLICY "audit_select_org_admin" ON public.audit_log FOR SELECT
  USING (
    public.has_role(auth.uid(),'super_admin')
    OR (structure_id IS NOT NULL AND public.is_org_admin(auth.uid(), public.structure_org(structure_id)))
  );

-- =========================================================================
-- 11) MODULE_PERMISSIONS: solo super_admin o admin dell'org della struttura
-- =========================================================================
DROP POLICY IF EXISTS "admins manage perms" ON public.module_permissions;
CREATE POLICY "org admins manage perms" ON public.module_permissions FOR ALL
  USING (
    public.has_role(auth.uid(),'super_admin')
    OR (structure_id IS NOT NULL AND public.is_org_admin(auth.uid(), public.structure_org(structure_id)))
  )
  WITH CHECK (
    public.has_role(auth.uid(),'super_admin')
    OR (structure_id IS NOT NULL AND public.is_org_admin(auth.uid(), public.structure_org(structure_id)))
  );

-- =========================================================================
-- 12) USER_DELEGATIONS: scoped
-- =========================================================================
DROP POLICY IF EXISTS "delegations own or admin" ON public.user_delegations;

CREATE POLICY "delegations select" ON public.user_delegations FOR SELECT
  USING (
    delegator_id = auth.uid()
    OR delegate_id = auth.uid()
    OR public.has_role(auth.uid(),'super_admin')
    OR (structure_id IS NOT NULL AND public.is_org_admin(auth.uid(), public.structure_org(structure_id)))
  );
CREATE POLICY "delegations insert" ON public.user_delegations FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(),'super_admin')
    OR (structure_id IS NOT NULL AND public.is_org_admin(auth.uid(), public.structure_org(structure_id)))
  );
CREATE POLICY "delegations update" ON public.user_delegations FOR UPDATE
  USING (
    public.has_role(auth.uid(),'super_admin')
    OR delegator_id = auth.uid()
    OR (structure_id IS NOT NULL AND public.is_org_admin(auth.uid(), public.structure_org(structure_id)))
  ) WITH CHECK (
    public.has_role(auth.uid(),'super_admin')
    OR (structure_id IS NOT NULL AND public.is_org_admin(auth.uid(), public.structure_org(structure_id)))
  );
CREATE POLICY "delegations delete" ON public.user_delegations FOR DELETE
  USING (
    public.has_role(auth.uid(),'super_admin')
    OR (structure_id IS NOT NULL AND public.is_org_admin(auth.uid(), public.structure_org(structure_id)))
  );

-- =========================================================================
-- 13) GUEST_ISSUES: rimuovi insert anonimo, usa RPC SECURITY DEFINER
-- =========================================================================
DROP POLICY IF EXISTS "guest_issue_anon_insert" ON public.guest_issues;

CREATE OR REPLACE FUNCTION public.submit_guest_issue(
  _qr_token text,
  _category text,
  _description text,
  _guest_name text DEFAULT NULL,
  _guest_contact text DEFAULT NULL,
  _language text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_room_id uuid; v_struct uuid; v_id uuid;
BEGIN
  IF _qr_token IS NULL OR length(_qr_token) < 8 THEN
    RAISE EXCEPTION 'QR non valido';
  END IF;
  IF _description IS NULL OR length(btrim(_description)) < 2 THEN
    RAISE EXCEPTION 'Descrizione mancante';
  END IF;

  SELECT id, structure_id INTO v_room_id, v_struct
    FROM public.rooms WHERE qr_token = _qr_token LIMIT 1;
  IF v_room_id IS NULL THEN
    RAISE EXCEPTION 'QR camera non trovato';
  END IF;

  INSERT INTO public.guest_issues(
    structure_id, room_id, category, description,
    guest_name, guest_contact, language, source, status
  ) VALUES (
    v_struct, v_room_id,
    COALESCE(NULLIF(btrim(_category),''),'altro'),
    btrim(_description),
    NULLIF(btrim(COALESCE(_guest_name,'')),''),
    NULLIF(btrim(COALESCE(_guest_contact,'')),''),
    NULLIF(btrim(COALESCE(_language,'')),''),
    'qr', 'new'
  ) RETURNING id INTO v_id;

  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.submit_guest_issue(text,text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_guest_issue(text,text,text,text,text,text) TO anon, authenticated;
