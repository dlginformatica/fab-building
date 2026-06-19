
DO $$ BEGIN
  CREATE TYPE public.supplier_verification_status AS ENUM ('pending','in_review','verified','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS verification_status public.supplier_verification_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS verification_notes text;

DO $$ BEGIN
  CREATE TYPE public.supplier_doc_type AS ENUM ('visura','durc','insurance','sdi_certification','iban_proof','haccp','privacy','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.supplier_doc_status AS ENUM ('pending','confirmed','rejected','expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.supplier_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  doc_type public.supplier_doc_type NOT NULL,
  status public.supplier_doc_status NOT NULL DEFAULT 'pending',
  file_path text,
  file_name text,
  mime_type text,
  size_bytes bigint,
  issued_on date,
  expires_on date,
  notes text,
  uploaded_by uuid REFERENCES auth.users(id),
  confirmed_by uuid REFERENCES auth.users(id),
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_documents TO authenticated;
GRANT ALL ON public.supplier_documents TO service_role;

ALTER TABLE public.supplier_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "suppdocs_read_authenticated" ON public.supplier_documents
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "suppdocs_insert_staff" ON public.supplier_documents
  FOR INSERT TO authenticated WITH CHECK (
    public.has_role(auth.uid(),'super_admin') OR
    public.has_role(auth.uid(),'direttore') OR
    public.has_role(auth.uid(),'facility_manager') OR
    public.has_role(auth.uid(),'economato') OR
    public.has_role(auth.uid(),'fornitore')
  );

CREATE POLICY "suppdocs_update_staff" ON public.supplier_documents
  FOR UPDATE TO authenticated USING (
    public.has_role(auth.uid(),'super_admin') OR
    public.has_role(auth.uid(),'direttore') OR
    public.has_role(auth.uid(),'facility_manager') OR
    public.has_role(auth.uid(),'economato')
  );

CREATE POLICY "suppdocs_delete_admin" ON public.supplier_documents
  FOR DELETE TO authenticated USING (
    public.has_role(auth.uid(),'super_admin') OR
    public.has_role(auth.uid(),'direttore')
  );

CREATE TRIGGER trg_supplier_documents_updated_at
  BEFORE UPDATE ON public.supplier_documents
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_supplier_documents_supplier ON public.supplier_documents(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_documents_status ON public.supplier_documents(status);

CREATE POLICY "supplier_docs_read" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'supplier-docs');

CREATE POLICY "supplier_docs_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'supplier-docs' AND (
      public.has_role(auth.uid(),'super_admin') OR
      public.has_role(auth.uid(),'direttore') OR
      public.has_role(auth.uid(),'facility_manager') OR
      public.has_role(auth.uid(),'economato') OR
      public.has_role(auth.uid(),'fornitore')
    )
  );

CREATE POLICY "supplier_docs_update" ON storage.objects
  FOR UPDATE TO authenticated USING (
    bucket_id = 'supplier-docs' AND (
      public.has_role(auth.uid(),'super_admin') OR
      public.has_role(auth.uid(),'direttore') OR
      public.has_role(auth.uid(),'facility_manager') OR
      public.has_role(auth.uid(),'economato')
    )
  );

CREATE POLICY "supplier_docs_delete" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'supplier-docs' AND (
      public.has_role(auth.uid(),'super_admin') OR
      public.has_role(auth.uid(),'direttore')
    )
  );
