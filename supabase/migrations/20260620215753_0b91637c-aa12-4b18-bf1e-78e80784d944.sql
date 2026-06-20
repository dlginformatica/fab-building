
-- 1) room_types: category + description
ALTER TABLE public.room_types
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS description text;

-- 2) rooms: plan_path (foto pianta)
ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS plan_path text;

-- 3) room_furnishings
CREATE TABLE IF NOT EXISTS public.room_furnishings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  structure_id uuid NOT NULL REFERENCES public.structures(id) ON DELETE CASCADE,
  kind text CHECK (kind IN ('mobilio','arredo','accessorio')),
  name text NOT NULL,
  locale text,
  quantity int DEFAULT 1,
  notes text,
  pos_x numeric,
  pos_y numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.room_furnishings TO authenticated;
GRANT ALL ON public.room_furnishings TO service_role;

ALTER TABLE public.room_furnishings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "room_furnishings read" ON public.room_furnishings;
CREATE POLICY "room_furnishings read" ON public.room_furnishings
  FOR SELECT TO authenticated
  USING (public.has_structure_access(auth.uid(), structure_id));

DROP POLICY IF EXISTS "room_furnishings write" ON public.room_furnishings;
CREATE POLICY "room_furnishings write" ON public.room_furnishings
  FOR ALL TO authenticated
  USING (public.is_org_admin(auth.uid(), public.structure_org(structure_id)))
  WITH CHECK (public.is_org_admin(auth.uid(), public.structure_org(structure_id)));

CREATE INDEX IF NOT EXISTS room_furnishings_room_idx ON public.room_furnishings(room_id);
CREATE INDEX IF NOT EXISTS room_furnishings_struct_idx ON public.room_furnishings(structure_id);

DROP TRIGGER IF EXISTS room_furnishings_updated_at ON public.room_furnishings;
CREATE TRIGGER room_furnishings_updated_at BEFORE UPDATE ON public.room_furnishings
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
