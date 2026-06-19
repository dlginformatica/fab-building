
-- asset-docs
CREATE POLICY "asset_docs_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'asset-docs' AND public.has_structure_access(auth.uid(), ((storage.foldername(name))[1])::uuid));
CREATE POLICY "asset_docs_write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'asset-docs' AND public.has_structure_access(auth.uid(), ((storage.foldername(name))[1])::uuid) AND owner = auth.uid());
CREATE POLICY "asset_docs_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'asset-docs' AND (owner = auth.uid() OR public.is_admin(auth.uid())));
CREATE POLICY "asset_docs_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'asset-docs' AND (owner = auth.uid() OR public.is_admin(auth.uid())));

-- asset-media
CREATE POLICY "asset_media_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'asset-media' AND public.has_structure_access(auth.uid(), ((storage.foldername(name))[1])::uuid));
CREATE POLICY "asset_media_write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'asset-media' AND public.has_structure_access(auth.uid(), ((storage.foldername(name))[1])::uuid) AND owner = auth.uid());
CREATE POLICY "asset_media_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'asset-media' AND (owner = auth.uid() OR public.is_admin(auth.uid())));
CREATE POLICY "asset_media_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'asset-media' AND (owner = auth.uid() OR public.is_admin(auth.uid())));
