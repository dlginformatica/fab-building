
-- Storage policies for report-previews bucket
CREATE POLICY "previews owner read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'report-previews' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "previews owner write" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'report-previews' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "previews owner delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'report-previews' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Metadati anteprime
CREATE TABLE public.report_pdf_previews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.report_templates(id) ON DELETE SET NULL,
  template_name text,
  recipient text,
  path text NOT NULL,
  size_bytes int,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_pdf_previews TO authenticated;
GRANT ALL ON public.report_pdf_previews TO service_role;
ALTER TABLE public.report_pdf_previews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "previews owner crud" ON public.report_pdf_previews FOR ALL TO authenticated
USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- Permessi per template
CREATE TABLE public.report_template_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.report_templates(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role,
  permission text NOT NULL DEFAULT 'viewer',
  granted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (user_id IS NOT NULL OR role IS NOT NULL),
  CHECK (permission IN ('viewer','editor','admin'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_template_access TO authenticated;
GRANT ALL ON public.report_template_access TO service_role;
ALTER TABLE public.report_template_access ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_manage_template(_user uuid, _template uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin(_user)
    OR EXISTS (SELECT 1 FROM public.report_templates WHERE id = _template AND owner_id = _user)
    OR EXISTS (
      SELECT 1 FROM public.report_template_access a
      LEFT JOIN public.user_roles ur ON ur.user_id = _user
      WHERE a.template_id = _template
        AND a.permission IN ('editor','admin')
        AND ((a.user_id = _user) OR (a.role IS NOT NULL AND a.role = ur.role))
    )
$$;

CREATE POLICY "tpl_access_select" ON public.report_template_access FOR SELECT TO authenticated
USING (public.can_manage_template(auth.uid(), template_id));
CREATE POLICY "tpl_access_insert" ON public.report_template_access FOR INSERT TO authenticated
WITH CHECK (public.can_manage_template(auth.uid(), template_id));
CREATE POLICY "tpl_access_update" ON public.report_template_access FOR UPDATE TO authenticated
USING (public.can_manage_template(auth.uid(), template_id))
WITH CHECK (public.can_manage_template(auth.uid(), template_id));
CREATE POLICY "tpl_access_delete" ON public.report_template_access FOR DELETE TO authenticated
USING (public.can_manage_template(auth.uid(), template_id));

-- Audit dei cambi layout
CREATE TABLE public.report_template_layout_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL,
  actor_id uuid,
  field text NOT NULL,
  recipient text,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.report_template_layout_audit TO authenticated;
GRANT ALL ON public.report_template_layout_audit TO service_role;
ALTER TABLE public.report_template_layout_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "layout audit read" ON public.report_template_layout_audit FOR SELECT TO authenticated
USING (public.can_manage_template(auth.uid(), template_id));

CREATE OR REPLACE FUNCTION public.tg_report_layout_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  old_layout jsonb := COALESCE(OLD.pdf_layout, OLD.layout, '{}'::jsonb);
  new_layout jsonb := COALESCE(NEW.pdf_layout, NEW.layout, '{}'::jsonb);
  old_rl jsonb := COALESCE(OLD.recipient_layouts, '[]'::jsonb);
  new_rl jsonb := COALESCE(NEW.recipient_layouts, '[]'::jsonb);
  k text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    FOREACH k IN ARRAY ARRAY['header','footer','signature','qr_url','subheader'] LOOP
      IF (old_layout->>k) IS DISTINCT FROM (new_layout->>k) THEN
        INSERT INTO public.report_template_layout_audit(template_id, actor_id, field, old_value, new_value)
        VALUES (NEW.id, auth.uid(), k, to_jsonb(old_layout->>k), to_jsonb(new_layout->>k));
      END IF;
    END LOOP;
    IF old_rl IS DISTINCT FROM new_rl THEN
      INSERT INTO public.report_template_layout_audit(template_id, actor_id, field, old_value, new_value)
      VALUES (NEW.id, auth.uid(), 'recipient_layouts', old_rl, new_rl);
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tg_report_templates_layout_audit ON public.report_templates;
CREATE TRIGGER tg_report_templates_layout_audit
AFTER UPDATE ON public.report_templates
FOR EACH ROW EXECUTE FUNCTION public.tg_report_layout_audit();
