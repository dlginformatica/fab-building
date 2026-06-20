
DO $$ BEGIN
  CREATE POLICY "org-backups read" ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'org-backups' AND (
      public.has_role(auth.uid(),'super_admin')
      OR public.is_org_owner(auth.uid(), (split_part(name,'/',1))::uuid)
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "org-backups write" ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'org-backups' AND (
      public.has_role(auth.uid(),'super_admin')
      OR public.is_org_owner(auth.uid(), (split_part(name,'/',1))::uuid)
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "org-backups delete" ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'org-backups' AND (
      public.has_role(auth.uid(),'super_admin')
      OR public.is_org_owner(auth.uid(), (split_part(name,'/',1))::uuid)
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
