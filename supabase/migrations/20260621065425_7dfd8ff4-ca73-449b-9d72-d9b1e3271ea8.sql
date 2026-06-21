CREATE TABLE IF NOT EXISTS public.room_type_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id uuid NOT NULL REFERENCES public.structures(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (structure_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.room_type_categories TO authenticated;
GRANT ALL ON public.room_type_categories TO service_role;

ALTER TABLE public.room_type_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "room_type_categories read" ON public.room_type_categories;
CREATE POLICY "room_type_categories read" ON public.room_type_categories
  FOR SELECT TO authenticated
  USING (public.has_structure_access(auth.uid(), structure_id));

DROP POLICY IF EXISTS "room_type_categories write" ON public.room_type_categories;
CREATE POLICY "room_type_categories write" ON public.room_type_categories
  FOR ALL TO authenticated
  USING (public.is_org_admin(auth.uid(), public.structure_org(structure_id)))
  WITH CHECK (public.is_org_admin(auth.uid(), public.structure_org(structure_id)));

CREATE INDEX IF NOT EXISTS room_type_categories_struct_idx ON public.room_type_categories(structure_id);

DROP TRIGGER IF EXISTS room_type_categories_updated_at ON public.room_type_categories;
CREATE TRIGGER room_type_categories_updated_at BEFORE UPDATE ON public.room_type_categories
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.room_furnishings DROP CONSTRAINT IF EXISTS room_furnishings_pos_x_range;
ALTER TABLE public.room_furnishings ADD CONSTRAINT room_furnishings_pos_x_range
  CHECK (pos_x IS NULL OR (pos_x >= 0 AND pos_x <= 100));
ALTER TABLE public.room_furnishings DROP CONSTRAINT IF EXISTS room_furnishings_pos_y_range;
ALTER TABLE public.room_furnishings ADD CONSTRAINT room_furnishings_pos_y_range
  CHECK (pos_y IS NULL OR (pos_y >= 0 AND pos_y <= 100));
ALTER TABLE public.room_furnishings DROP CONSTRAINT IF EXISTS room_furnishings_qty_nonneg;
ALTER TABLE public.room_furnishings ADD CONSTRAINT room_furnishings_qty_nonneg
  CHECK (quantity IS NULL OR quantity >= 0);

ALTER TABLE public.room_furnishings REPLICA IDENTITY FULL;
ALTER TABLE public.room_type_categories REPLICA IDENTITY FULL;
ALTER TABLE public.room_types REPLICA IDENTITY FULL;
ALTER TABLE public.rooms REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.room_furnishings;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.room_type_categories;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.room_types;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;