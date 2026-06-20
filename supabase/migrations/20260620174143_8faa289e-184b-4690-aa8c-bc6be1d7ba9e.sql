
CREATE TABLE public.org_backup_notify_prefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  email_enabled boolean NOT NULL DEFAULT true,
  in_app_enabled boolean NOT NULL DEFAULT true,
  notify_on_start boolean NOT NULL DEFAULT false,
  notify_on_success boolean NOT NULL DEFAULT true,
  notify_on_failure boolean NOT NULL DEFAULT true,
  notify_on_integrity_issue boolean NOT NULL DEFAULT true,
  recipients text[] NOT NULL DEFAULT '{}',
  frequency text NOT NULL DEFAULT 'immediate' CHECK (frequency IN ('immediate','hourly_digest','daily_digest')),
  quiet_hours_start time,
  quiet_hours_end time,
  notes text,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_backup_notify_prefs TO authenticated;
GRANT ALL ON public.org_backup_notify_prefs TO service_role;

ALTER TABLE public.org_backup_notify_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "backup notify prefs read"
  ON public.org_backup_notify_prefs FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (SELECT 1 FROM public.org_memberships m
               WHERE m.org_id = org_backup_notify_prefs.organization_id
                 AND m.user_id = auth.uid()
                 AND m.role IN ('owner','admin'))
  );

CREATE POLICY "backup notify prefs insert"
  ON public.org_backup_notify_prefs FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (SELECT 1 FROM public.org_memberships m
               WHERE m.org_id = org_backup_notify_prefs.organization_id
                 AND m.user_id = auth.uid()
                 AND m.role IN ('owner','admin'))
  );

CREATE POLICY "backup notify prefs update"
  ON public.org_backup_notify_prefs FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (SELECT 1 FROM public.org_memberships m
               WHERE m.org_id = org_backup_notify_prefs.organization_id
                 AND m.user_id = auth.uid()
                 AND m.role IN ('owner','admin'))
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (SELECT 1 FROM public.org_memberships m
               WHERE m.org_id = org_backup_notify_prefs.organization_id
                 AND m.user_id = auth.uid()
                 AND m.role IN ('owner','admin'))
  );

CREATE POLICY "backup notify prefs delete"
  ON public.org_backup_notify_prefs FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (SELECT 1 FROM public.org_memberships m
               WHERE m.org_id = org_backup_notify_prefs.organization_id
                 AND m.user_id = auth.uid()
                 AND m.role IN ('owner','admin'))
  );

CREATE TRIGGER trg_org_backup_notify_prefs_updated_at
  BEFORE UPDATE ON public.org_backup_notify_prefs
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
