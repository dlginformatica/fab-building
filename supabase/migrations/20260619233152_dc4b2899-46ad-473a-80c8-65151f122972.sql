
ALTER TABLE public.structures
  ADD COLUMN IF NOT EXISTS onboarded_at timestamptz,
  ADD COLUMN IF NOT EXISTS onboarding_preset text;

CREATE OR REPLACE FUNCTION public.seed_structure_preset(
  _structure uuid,
  _preset text,
  _floors_count int DEFAULT 2,
  _rooms_per_floor int DEFAULT 10
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  i int; j int;
  floor_rec record;
  created_floors int := 0;
  created_rooms int := 0;
  created_cats int := 0;
  created_sla int := 0;
  cats text[][] := ARRAY[
    ['Caldaia & ACS','flame','#f97316'],
    ['Climatizzazione','wind','#0ea5e9'],
    ['Idraulico','droplet','#3b82f6'],
    ['Elettrico','zap','#eab308'],
    ['Ascensori','arrow-up-down','#8b5cf6'],
    ['TV & Wi-Fi','wifi','#22c55e'],
    ['Mini-bar & Frigo','refrigerator','#06b6d4'],
    ['Lavanderia','shirt','#ec4899'],
    ['Cucina','utensils','#f59e0b'],
    ['Antincendio','fire-extinguisher','#dc2626'],
    ['Generico','wrench','#64748b']
  ];
  sla_defaults text[][] := ARRAY[
    ['critica','15','120'],
    ['alta','60','480'],
    ['media','240','1440'],
    ['bassa','480','4320']
  ];
BEGIN
  IF NOT (
    public.has_role(auth.uid(),'super_admin') OR
    public.has_role(auth.uid(),'direttore', _structure) OR
    public.has_role(auth.uid(),'facility_manager', _structure)
  ) THEN
    RAISE EXCEPTION 'Permesso negato per la struttura %', _structure USING ERRCODE = '42501';
  END IF;

  -- Floors
  FOR i IN 0.._floors_count-1 LOOP
    INSERT INTO public.floors(structure_id, name, level)
    SELECT _structure,
      CASE WHEN i = 0 THEN 'Piano terra' ELSE 'Piano ' || i END,
      i
    WHERE NOT EXISTS (
      SELECT 1 FROM public.floors WHERE structure_id = _structure AND level = i
    );
    GET DIAGNOSTICS j = ROW_COUNT;
    created_floors := created_floors + j;
  END LOOP;

  -- Rooms per floor
  FOR floor_rec IN SELECT id, level FROM public.floors WHERE structure_id = _structure ORDER BY level LOOP
    FOR i IN 1.._rooms_per_floor LOOP
      INSERT INTO public.rooms(structure_id, floor_id, name, room_type)
      SELECT _structure, floor_rec.id,
        (floor_rec.level * 100 + i)::text,
        'camera'
      WHERE NOT EXISTS (
        SELECT 1 FROM public.rooms
        WHERE structure_id = _structure
          AND floor_id = floor_rec.id
          AND name = (floor_rec.level * 100 + i)::text
      );
      GET DIAGNOSTICS j = ROW_COUNT;
      created_rooms := created_rooms + j;
    END LOOP;
  END LOOP;

  -- Asset categories (globali, solo se mancanti per nome)
  FOR i IN 1 .. array_length(cats, 1) LOOP
    INSERT INTO public.asset_categories(name, icon, color)
    SELECT cats[i][1], cats[i][2], cats[i][3]
    WHERE NOT EXISTS (SELECT 1 FROM public.asset_categories WHERE name = cats[i][1]);
    GET DIAGNOSTICS j = ROW_COUNT;
    created_cats := created_cats + j;
  END LOOP;

  -- SLA rules default per priorità (solo se mancanti per struttura+priorità)
  FOR i IN 1 .. array_length(sla_defaults, 1) LOOP
    INSERT INTO public.sla_rules(structure_id, priority, ack_minutes, resolve_minutes, enabled, name)
    SELECT _structure,
      sla_defaults[i][1]::ticket_priority,
      sla_defaults[i][2]::int,
      sla_defaults[i][3]::int,
      true,
      'Default ' || sla_defaults[i][1]
    WHERE NOT EXISTS (
      SELECT 1 FROM public.sla_rules
      WHERE structure_id = _structure
        AND priority = sla_defaults[i][1]::ticket_priority
        AND category_id IS NULL
        AND area IS NULL
    );
    GET DIAGNOSTICS j = ROW_COUNT;
    created_sla := created_sla + j;
  END LOOP;

  -- Update struttura
  UPDATE public.structures
     SET onboarded_at = now(),
         onboarding_preset = _preset,
         rooms_count = (SELECT count(*) FROM public.rooms WHERE structure_id = _structure)
   WHERE id = _structure;

  RETURN jsonb_build_object(
    'floors', created_floors,
    'rooms', created_rooms,
    'categories', created_cats,
    'sla_rules', created_sla,
    'preset', _preset
  );
END $$;

REVOKE EXECUTE ON FUNCTION public.seed_structure_preset(uuid,text,int,int) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.seed_structure_preset(uuid,text,int,int) TO authenticated;
