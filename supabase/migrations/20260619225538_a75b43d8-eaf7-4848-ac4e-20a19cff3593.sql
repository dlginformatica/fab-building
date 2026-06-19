
CREATE POLICY "contracts_bucket_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'contracts'
    AND EXISTS (
      SELECT 1 FROM public.contract_attachments a
      WHERE a.storage_path = name
        AND has_structure_access(auth.uid(), a.structure_id)
    )
  );

CREATE POLICY "contracts_bucket_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'contracts');

CREATE POLICY "contracts_bucket_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'contracts'
    AND EXISTS (
      SELECT 1 FROM public.contract_attachments a
      WHERE a.storage_path = name
        AND has_structure_access(auth.uid(), a.structure_id)
    )
  );

REVOKE EXECUTE ON FUNCTION public.contracts_due_for_notice() FROM anon, authenticated;
