
-- =============================================================
-- SUBSCRIPTION SYSTEM
-- =============================================================

-- Enum tier
DO $$ BEGIN
  CREATE TYPE public.subscription_tier AS ENUM ('small','medium','large');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.subscription_status AS ENUM ('trial','active','expired','readonly','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- subscription_plans ----------
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier subscription_tier NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  price_monthly_eur numeric(10,2) NOT NULL DEFAULT 0,
  price_yearly_eur numeric(10,2),
  max_users int NOT NULL DEFAULT 5,
  max_structures int NOT NULL DEFAULT 1,
  trial_days int NOT NULL DEFAULT 30,
  modules text[] NOT NULL DEFAULT '{}',
  features_highlight text[] NOT NULL DEFAULT '{}',
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscription_plans TO anon, authenticated;
GRANT ALL ON public.subscription_plans TO service_role;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "plans readable by all" ON public.subscription_plans;
CREATE POLICY "plans readable by all" ON public.subscription_plans FOR SELECT USING (true);
DROP POLICY IF EXISTS "plans managed by super admin" ON public.subscription_plans;
CREATE POLICY "plans managed by super admin" ON public.subscription_plans
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));

DROP TRIGGER IF EXISTS plans_set_updated_at ON public.subscription_plans;
CREATE TRIGGER plans_set_updated_at BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ---------- org_subscriptions ----------
CREATE TABLE IF NOT EXISTS public.org_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  tier subscription_tier NOT NULL DEFAULT 'small',
  status subscription_status NOT NULL DEFAULT 'trial',
  trial_started_at timestamptz NOT NULL DEFAULT now(),
  trial_ends_at timestamptz NOT NULL DEFAULT now() + interval '30 days',
  current_period_start timestamptz,
  current_period_end timestamptz,
  manual_payment_ref text,
  manual_payment_notes text,
  activated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  activated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.org_subscriptions TO authenticated;
GRANT ALL ON public.org_subscriptions TO service_role;
ALTER TABLE public.org_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subs visible to members and super" ON public.org_subscriptions;
CREATE POLICY "subs visible to members and super" ON public.org_subscriptions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.is_org_member(auth.uid(), org_id));

DROP POLICY IF EXISTS "subs managed by super" ON public.org_subscriptions;
CREATE POLICY "subs managed by super" ON public.org_subscriptions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));

DROP TRIGGER IF EXISTS subs_set_updated_at ON public.org_subscriptions;
CREATE TRIGGER subs_set_updated_at BEFORE UPDATE ON public.org_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ---------- functions ----------

-- effective tier (large during trial, else subscribed tier if active, else NULL meaning readonly)
CREATE OR REPLACE FUNCTION public.org_effective_tier(_org uuid)
RETURNS subscription_tier LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN s.status = 'trial' AND s.trial_ends_at > now() THEN 'large'::subscription_tier
    WHEN s.status = 'active' AND (s.current_period_end IS NULL OR s.current_period_end > now()) THEN s.tier
    ELSE NULL
  END
  FROM public.org_subscriptions s WHERE s.org_id = _org;
$$;

-- effective status: trial | active | readonly
CREATE OR REPLACE FUNCTION public.org_effective_status(_org uuid)
RETURNS subscription_status LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN s.status = 'trial' AND s.trial_ends_at > now() THEN 'trial'::subscription_status
    WHEN s.status = 'active' AND (s.current_period_end IS NULL OR s.current_period_end > now()) THEN 'active'::subscription_status
    WHEN s.status = 'cancelled' THEN 'cancelled'::subscription_status
    ELSE 'readonly'::subscription_status
  END
  FROM public.org_subscriptions s WHERE s.org_id = _org;
$$;

-- can write?
CREATE OR REPLACE FUNCTION public.org_can_write(_org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(),'super_admin') OR
    public.org_effective_status(_org) IN ('trial','active');
$$;

-- validate modules against dependencies
CREATE OR REPLACE FUNCTION public.plan_validate_modules(_modules text[])
RETURNS TABLE(module text, missing_dependency text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT d.module, d.depends_on
  FROM public.module_dependencies d
  WHERE d.module = ANY(_modules)
    AND NOT (d.depends_on = ANY(_modules))
  ORDER BY d.module, d.depends_on;
$$;

-- updated has_module_access (tier gate)
CREATE OR REPLACE FUNCTION public.has_module_access(_user uuid, _module text, _structure uuid DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.has_role(_user,'super_admin')
    OR (
      -- module must be included in user's org effective tier
      EXISTS (
        SELECT 1
        FROM public.profiles p
        JOIN public.subscription_plans pl
          ON pl.tier = public.org_effective_tier(p.organization_id)
        WHERE p.id = _user
          AND _module = ANY(pl.modules)
      )
      AND (
        EXISTS (
          SELECT 1 FROM public.organizations o
          JOIN public.profiles p ON p.organization_id = o.id
          WHERE p.id = _user AND o.owner_id = _user
        )
        OR public.has_role(_user,'direttore', _structure)
        OR public.has_role(_user,'facility_manager', _structure)
        OR EXISTS (
          SELECT 1 FROM public.user_delegations d
          WHERE d.delegate_id = _user AND d.active = true
            AND (d.starts_at IS NULL OR d.starts_at <= now())
            AND (d.ends_at IS NULL OR d.ends_at > now())
            AND (d.structure_id IS NULL OR _structure IS NULL OR d.structure_id = _structure)
            AND (_module = ANY(d.modules) OR '*' = ANY(d.modules))
        )
        OR public.has_permission(_user, _module, 'view', _structure)
      )
    );
$$;

-- handle_new_user: create trial subscription
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org uuid; v_name text; v_trial int;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;

  IF lower(NEW.email) = 'info@dlginformatica.it' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'super_admin'::app_role) ON CONFLICT DO NOTHING;
  END IF;

  IF EXISTS (SELECT 1 FROM public.org_invitations
             WHERE lower(email)=lower(NEW.email) AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now()) THEN
    RETURN NEW;
  END IF;

  v_name := COALESCE(NULLIF(NEW.raw_user_meta_data->>'org_name',''), 'Organizzazione di ' || split_part(NEW.email,'@',1));
  INSERT INTO public.organizations(name, owner_id) VALUES (v_name, NEW.id) RETURNING id INTO v_org;
  INSERT INTO public.org_memberships(org_id, user_id, role) VALUES (v_org, NEW.id, 'owner');
  UPDATE public.profiles SET organization_id = v_org WHERE id = NEW.id;
  INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'direttore') ON CONFLICT DO NOTHING;

  -- Trial subscription (30 days large)
  SELECT trial_days INTO v_trial FROM public.subscription_plans WHERE tier='large' LIMIT 1;
  v_trial := COALESCE(v_trial, 30);
  INSERT INTO public.org_subscriptions(org_id, tier, status, trial_started_at, trial_ends_at)
  VALUES (v_org, 'small', 'trial', now(), now() + (v_trial || ' days')::interval)
  ON CONFLICT (org_id) DO NOTHING;

  RETURN NEW;
END $$;

-- ---------- seed plans ----------
INSERT INTO public.subscription_plans(tier, name, description, price_monthly_eur, max_users, max_structures, trial_days, sort_order, modules, features_highlight)
VALUES
('small','Small','Piccole strutture: B&B e hotel fino a 30 camere',200,5,1,30,1,
 ARRAY['tickets','assets','inventory','maintenance','housekeeping','guest_issues','rooms','docs','notifications','messages','users','settings','audit','overview'],
 ARRAY['Ticketing & manutenzione base','Inventario & camere','Fino a 5 utenti']
),
('medium','Medium','Medie strutture: hotel 30-150 camere e piccole catene',400,25,3,30,2,
 ARRAY['tickets','assets','inventory','maintenance','housekeeping','guest_issues','rooms','docs','notifications','messages','users','settings','audit','overview',
       'suppliers','contracts','purchase_orders','work_orders','sla','sla_settings','penalties','invoices','utilities','cashbook','reports','smart_inbox','alerts'],
 ARRAY['Tutto Small','Fornitori, contratti & SLA','Bollette OCR & cashbook','Fino a 25 utenti, 3 strutture']
),
('large','Large','Grandi strutture e catene multi-property',800,9999,9999,30,3,
 ARRAY['tickets','assets','inventory','maintenance','housekeeping','guest_issues','rooms','docs','notifications','messages','users','settings','audit','overview',
       'suppliers','contracts','purchase_orders','work_orders','sla','sla_settings','penalties','invoices','utilities','cashbook','reports','smart_inbox','alerts',
       'statistics','scheduled_exports','sustainability','delegations','permissions','integrations','organization'],
 ARRAY['Tutto Medium','Analytics, ESG & report builder','Deleghe, permessi granulari, workflow','Utenti e strutture illimitati']
)
ON CONFLICT (tier) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      features_highlight = EXCLUDED.features_highlight;

-- ---------- bootstrap subscriptions for existing organizations ----------
INSERT INTO public.org_subscriptions(org_id, tier, status, trial_started_at, trial_ends_at)
SELECT o.id, 'small', 'trial', now(), now() + interval '30 days'
FROM public.organizations o
LEFT JOIN public.org_subscriptions s ON s.org_id = o.id
WHERE s.id IS NULL;
