
-- 1. Add lat/lng to structures
ALTER TABLE public.structures
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision;

-- 2. room_types
CREATE TABLE IF NOT EXISTS public.room_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id uuid NOT NULL REFERENCES public.structures(id) ON DELETE CASCADE,
  name text NOT NULL,
  beds int,
  capacity int,
  base_price numeric(10,2),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.room_types TO authenticated;
GRANT ALL ON public.room_types TO service_role;
ALTER TABLE public.room_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "room_types read" ON public.room_types;
CREATE POLICY "room_types read" ON public.room_types
  FOR SELECT TO authenticated
  USING (public.has_structure_access(auth.uid(), structure_id));

DROP POLICY IF EXISTS "room_types write" ON public.room_types;
CREATE POLICY "room_types write" ON public.room_types
  FOR ALL TO authenticated
  USING (public.is_org_admin(auth.uid(), public.structure_org(structure_id)))
  WITH CHECK (public.is_org_admin(auth.uid(), public.structure_org(structure_id)));

-- 3. rooms.room_type_id
ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS room_type_id uuid REFERENCES public.room_types(id) ON DELETE SET NULL;

-- 4. structure_photos
CREATE TABLE IF NOT EXISTS public.structure_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id uuid NOT NULL REFERENCES public.structures(id) ON DELETE CASCADE,
  path text NOT NULL,
  caption text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.structure_photos TO authenticated;
GRANT ALL ON public.structure_photos TO service_role;
ALTER TABLE public.structure_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "structure_photos read" ON public.structure_photos;
CREATE POLICY "structure_photos read" ON public.structure_photos
  FOR SELECT TO authenticated
  USING (public.has_structure_access(auth.uid(), structure_id));

DROP POLICY IF EXISTS "structure_photos write" ON public.structure_photos;
CREATE POLICY "structure_photos write" ON public.structure_photos
  FOR ALL TO authenticated
  USING (public.is_org_admin(auth.uid(), public.structure_org(structure_id)))
  WITH CHECK (public.is_org_admin(auth.uid(), public.structure_org(structure_id)));

-- 5. Storage policies for bucket 'structure-photos' (created via tool below).
-- Path layout: <structure_id>/<filename>
DROP POLICY IF EXISTS "structure-photos read" ON storage.objects;
CREATE POLICY "structure-photos read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'structure-photos'
    AND public.has_structure_access(auth.uid(), (split_part(name, '/', 1))::uuid)
  );

DROP POLICY IF EXISTS "structure-photos write" ON storage.objects;
CREATE POLICY "structure-photos write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'structure-photos'
    AND public.is_org_admin(auth.uid(), public.structure_org((split_part(name, '/', 1))::uuid))
  );

DROP POLICY IF EXISTS "structure-photos update" ON storage.objects;
CREATE POLICY "structure-photos update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'structure-photos'
    AND public.is_org_admin(auth.uid(), public.structure_org((split_part(name, '/', 1))::uuid))
  );

DROP POLICY IF EXISTS "structure-photos delete" ON storage.objects;
CREATE POLICY "structure-photos delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'structure-photos'
    AND public.is_org_admin(auth.uid(), public.structure_org((split_part(name, '/', 1))::uuid))
  );
