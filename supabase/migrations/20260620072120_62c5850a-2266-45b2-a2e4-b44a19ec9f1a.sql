
-- =========================================================
-- ORGANIZATIONS (multi-tenant)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  max_users int NOT NULL DEFAULT 6,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER organizations_updated_at BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================
-- ORG MEMBERSHIPS
-- =========================================================
DO $$ BEGIN
  CREATE TYPE public.org_member_role AS ENUM ('owner','admin','member');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.org_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.org_member_role NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_memberships TO authenticated;
GRANT ALL ON public.org_memberships TO service_role;
ALTER TABLE public.org_memberships ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_org_memberships_user ON public.org_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_org ON public.org_memberships(org_id);

-- =========================================================
-- ORG INVITATIONS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.org_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  invited_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_role public.org_member_role NOT NULL DEFAULT 'member',
  app_role public.app_role NOT NULL DEFAULT 'viewer',
  modules text[] NOT NULL DEFAULT ARRAY[]::text[],
  structure_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24),'hex'),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at timestamptz,
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_invitations TO authenticated;
GRANT ALL ON public.org_invitations TO service_role;
-- Need anon SELECT on token for invitation accept page (public link).
GRANT SELECT ON public.org_invitations TO anon;
ALTER TABLE public.org_invitations ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_org_invitations_org ON public.org_invitations(org_id);
CREATE INDEX IF NOT EXISTS idx_org_invitations_email ON public.org_invitations(lower(email));

-- =========================================================
-- MODULE DEPENDENCIES
-- =========================================================
CREATE TABLE IF NOT EXISTS public.module_dependencies (
  module text NOT NULL,
  depends_on text NOT NULL,
  PRIMARY KEY (module, depends_on)
);
GRANT SELECT ON public.module_dependencies TO authenticated, anon;
GRANT ALL ON public.module_dependencies TO service_role;
ALTER TABLE public.module_dependencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deps readable" ON public.module_dependencies FOR SELECT TO authenticated, anon USING (true);

INSERT INTO public.module_dependencies(module, depends_on) VALUES
  ('tickets','assets'),
  ('maintenance','assets'),
  ('work_orders','tickets'),
  ('work_orders','suppliers'),
  ('purchase_orders','suppliers'),
  ('purchase_orders','inventory'),
  ('invoices','suppliers'),
  ('sla','tickets'),
  ('penalties','sla'),
  ('housekeeping','assets'),
  ('guest_issues','tickets'),
  ('utilities','assets'),
  ('reports','statistics'),
  ('contracts','suppliers')
ON CONFLICT DO NOTHING;

-- =========================================================
-- ADD organization_id TO existing tables
-- =========================================================
ALTER TABLE public.profiles    ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.structures  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_profiles_org ON public.profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_structures_org ON public.structures(organization_id);

-- =========================================================
-- HELPER FUNCTIONS
-- =========================================================
CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_org_member(_user uuid, _org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.org_memberships WHERE user_id=_user AND org_id=_org)
$$;

CREATE OR REPLACE FUNCTION public.is_org_owner(_user uuid, _org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organizations WHERE id=_org AND owner_id=_user
  ) OR EXISTS (
    SELECT 1 FROM public.org_memberships WHERE org_id=_org AND user_id=_user AND role IN ('owner','admin')
  )
$$;

CREATE OR REPLACE FUNCTION public.org_user_count(_org uuid)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT count(*)::int FROM public.org_memberships WHERE org_id=_org
$$;

-- Expand list of modules with their mandatory dependencies (recursive)
CREATE OR REPLACE FUNCTION public.expand_modules_with_deps(_modules text[])
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  WITH RECURSIVE expanded(m) AS (
    SELECT unnest(_modules)
    UNION
    SELECT d.depends_on FROM public.module_dependencies d JOIN expanded e ON e.m = d.module
  )
  SELECT COALESCE(array_agg(DISTINCT m ORDER BY m), ARRAY[]::text[]) FROM expanded
$$;

-- Transfer organization ownership to another existing member
CREATE OR REPLACE FUNCTION public.transfer_org_ownership(_org uuid, _new_owner uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_old uuid;
BEGIN
  SELECT owner_id INTO v_old FROM public.organizations WHERE id=_org FOR UPDATE;
  IF v_old IS NULL THEN RAISE EXCEPTION 'Organizzazione inesistente'; END IF;
  IF v_old <> auth.uid() AND NOT public.has_role(auth.uid(),'super_admin') THEN
    RAISE EXCEPTION 'Solo il proprietario può trasferire la proprietà';
  END IF;
  IF NOT public.is_org_member(_new_owner, _org) THEN
    RAISE EXCEPTION 'Il nuovo proprietario deve essere già membro dell''organizzazione';
  END IF;
  UPDATE public.organizations SET owner_id=_new_owner, updated_at=now() WHERE id=_org;
  UPDATE public.org_memberships SET role='owner' WHERE org_id=_org AND user_id=_new_owner;
  UPDATE public.org_memberships SET role='admin' WHERE org_id=_org AND user_id=v_old;
END$$;

-- Accept an invitation
CREATE OR REPLACE FUNCTION public.accept_org_invitation(_token text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_inv public.org_invitations%ROWTYPE;
  v_user uuid := auth.uid();
  v_email text;
  v_count int;
  v_mods text[];
  v_sid uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Devi effettuare il login'; END IF;
  SELECT email INTO v_email FROM auth.users WHERE id=v_user;
  SELECT * INTO v_inv FROM public.org_invitations WHERE token=_token FOR UPDATE;
  IF v_inv.id IS NULL THEN RAISE EXCEPTION 'Invito non trovato'; END IF;
  IF v_inv.accepted_at IS NOT NULL THEN RAISE EXCEPTION 'Invito già accettato'; END IF;
  IF v_inv.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'Invito revocato'; END IF;
  IF v_inv.expires_at < now() THEN RAISE EXCEPTION 'Invito scaduto'; END IF;
  IF lower(v_inv.email) <> lower(v_email) THEN RAISE EXCEPTION 'Email non corrispondente'; END IF;

  SELECT public.org_user_count(v_inv.org_id) INTO v_count;
  IF v_count >= (SELECT max_users FROM public.organizations WHERE id=v_inv.org_id) THEN
    RAISE EXCEPTION 'Limite utenti organizzazione raggiunto';
  END IF;

  INSERT INTO public.org_memberships(org_id, user_id, role) VALUES (v_inv.org_id, v_user, v_inv.org_role)
    ON CONFLICT (org_id, user_id) DO NOTHING;
  UPDATE public.profiles SET organization_id = v_inv.org_id WHERE id = v_user;

  -- App role
  INSERT INTO public.user_roles(user_id, role, structure_id)
    SELECT v_user, v_inv.app_role, NULLIF(unnest(CASE WHEN array_length(v_inv.structure_ids,1) IS NULL THEN ARRAY[NULL::uuid] ELSE v_inv.structure_ids END), NULL)
  ON CONFLICT DO NOTHING;

  -- Delegations (with dependencies expanded)
  IF array_length(v_inv.modules,1) IS NOT NULL THEN
    v_mods := public.expand_modules_with_deps(v_inv.modules);
    IF array_length(v_inv.structure_ids,1) IS NULL THEN
      INSERT INTO public.user_delegations(delegator_id, delegate_id, structure_id, modules, reason)
        VALUES (v_inv.invited_by, v_user, NULL, v_mods, 'Da invito');
    ELSE
      FOREACH v_sid IN ARRAY v_inv.structure_ids LOOP
        INSERT INTO public.user_delegations(delegator_id, delegate_id, structure_id, modules, reason)
          VALUES (v_inv.invited_by, v_user, v_sid, v_mods, 'Da invito');
      END LOOP;
    END IF;
  END IF;

  UPDATE public.org_invitations SET accepted_at=now(), accepted_by=v_user WHERE id=v_inv.id;
  RETURN v_inv.org_id;
END$$;

-- =========================================================
-- handle_new_user: auto-create org for first-time users
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_org uuid;
  v_name text;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;

  IF lower(NEW.email) = 'info@dlginformatica.it' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'super_admin'::app_role) ON CONFLICT DO NOTHING;
  END IF;

  -- If invitation pending for this email, do NOT create a new org (user will accept it).
  IF EXISTS (SELECT 1 FROM public.org_invitations
             WHERE lower(email)=lower(NEW.email) AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now()) THEN
    RETURN NEW;
  END IF;

  -- Auto-create personal organization
  v_name := COALESCE(NULLIF(NEW.raw_user_meta_data->>'org_name',''), 'Organizzazione di ' || split_part(NEW.email,'@',1));
  INSERT INTO public.organizations(name, owner_id) VALUES (v_name, NEW.id) RETURNING id INTO v_org;
  INSERT INTO public.org_memberships(org_id, user_id, role) VALUES (v_org, NEW.id, 'owner');
  UPDATE public.profiles SET organization_id = v_org WHERE id = NEW.id;
  -- Give 'direttore' role globally for own org
  INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'direttore') ON CONFLICT DO NOTHING;

  RETURN NEW;
END$$;

-- =========================================================
-- RLS POLICIES (organizations / memberships / invitations)
-- =========================================================
DROP POLICY IF EXISTS "orgs select members" ON public.organizations;
CREATE POLICY "orgs select members" ON public.organizations FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), id) OR public.has_role(auth.uid(),'super_admin'));
DROP POLICY IF EXISTS "orgs update owner" ON public.organizations;
CREATE POLICY "orgs update owner" ON public.organizations FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(),'super_admin'));
DROP POLICY IF EXISTS "orgs insert any" ON public.organizations;
CREATE POLICY "orgs insert any" ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
DROP POLICY IF EXISTS "orgs delete owner" ON public.organizations;
CREATE POLICY "orgs delete owner" ON public.organizations FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'super_admin'));

DROP POLICY IF EXISTS "memberships select org" ON public.org_memberships;
CREATE POLICY "memberships select org" ON public.org_memberships FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), org_id) OR public.has_role(auth.uid(),'super_admin'));
DROP POLICY IF EXISTS "memberships manage owner" ON public.org_memberships;
CREATE POLICY "memberships manage owner" ON public.org_memberships FOR ALL TO authenticated
  USING (public.is_org_owner(auth.uid(), org_id) OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.is_org_owner(auth.uid(), org_id) OR public.has_role(auth.uid(),'super_admin'));

DROP POLICY IF EXISTS "invitations select" ON public.org_invitations;
CREATE POLICY "invitations select" ON public.org_invitations FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), org_id) OR lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid())) OR public.has_role(auth.uid(),'super_admin'));
DROP POLICY IF EXISTS "invitations anon by token" ON public.org_invitations;
CREATE POLICY "invitations anon by token" ON public.org_invitations FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "invitations manage owner" ON public.org_invitations;
CREATE POLICY "invitations manage owner" ON public.org_invitations FOR ALL TO authenticated
  USING (public.is_org_owner(auth.uid(), org_id) OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.is_org_owner(auth.uid(), org_id) OR public.has_role(auth.uid(),'super_admin'));

-- =========================================================
-- BACKFILL: organizations for existing users
-- =========================================================
DO $$
DECLARE r record; v_org uuid;
BEGIN
  FOR r IN SELECT p.id, p.email FROM public.profiles p WHERE p.organization_id IS NULL LOOP
    INSERT INTO public.organizations(name, owner_id)
      VALUES ('Organizzazione di ' || split_part(r.email,'@',1), r.id) RETURNING id INTO v_org;
    INSERT INTO public.org_memberships(org_id, user_id, role) VALUES (v_org, r.id, 'owner') ON CONFLICT DO NOTHING;
    UPDATE public.profiles SET organization_id = v_org WHERE id = r.id;
  END LOOP;

  -- Assign structures to the owner's org if missing
  UPDATE public.structures s SET organization_id = p.organization_id
    FROM public.profiles p
    WHERE s.organization_id IS NULL
      AND p.id = (
        SELECT user_id FROM public.user_roles ur WHERE ur.structure_id = s.id
          AND ur.role IN ('direttore','super_admin') LIMIT 1
      );

  -- Fallback: any orphan structure to first org
  UPDATE public.structures SET organization_id = (SELECT id FROM public.organizations ORDER BY created_at LIMIT 1)
    WHERE organization_id IS NULL;
END$$;

-- =========================================================
-- RLS update: structures scoped to org
-- =========================================================
DROP POLICY IF EXISTS "structures org scoped" ON public.structures;
CREATE POLICY "structures org scoped" ON public.structures FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'super_admin')
    OR public.is_org_member(auth.uid(), organization_id)
  );

-- New structures: only org owners/admins can create, scoped to their org
DROP POLICY IF EXISTS "structures insert org owner" ON public.structures;
CREATE POLICY "structures insert org owner" ON public.structures FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(),'super_admin')
    OR public.is_org_owner(auth.uid(), organization_id)
  );
DROP POLICY IF EXISTS "structures update org owner" ON public.structures;
CREATE POLICY "structures update org owner" ON public.structures FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.is_org_owner(auth.uid(), organization_id))
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.is_org_owner(auth.uid(), organization_id));
DROP POLICY IF EXISTS "structures delete org owner" ON public.structures;
CREATE POLICY "structures delete org owner" ON public.structures FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.is_org_owner(auth.uid(), organization_id));

-- Enforce user limit when adding memberships
CREATE OR REPLACE FUNCTION public.tg_enforce_org_user_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_count int; v_max int;
BEGIN
  SELECT max_users INTO v_max FROM public.organizations WHERE id=NEW.org_id;
  SELECT count(*) INTO v_count FROM public.org_memberships WHERE org_id=NEW.org_id;
  IF v_count >= v_max THEN RAISE EXCEPTION 'Limite utenti organizzazione raggiunto (%/%).', v_count, v_max; END IF;
  RETURN NEW;
END$$;
DROP TRIGGER IF EXISTS tg_org_membership_limit ON public.org_memberships;
CREATE TRIGGER tg_org_membership_limit BEFORE INSERT ON public.org_memberships
  FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_org_user_limit();
