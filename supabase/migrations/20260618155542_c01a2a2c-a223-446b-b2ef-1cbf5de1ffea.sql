
CREATE TYPE public.app_role AS ENUM ('super_admin','direttore','facility_manager','manutentore','fornitore','economato','viewer');
CREATE TYPE public.ticket_priority AS ENUM ('bassa','media','alta','critica');
CREATE TYPE public.ticket_status AS ENUM ('aperto','assegnato','in_corso','sospeso','risolto','chiuso','annullato');
CREATE TYPE public.asset_status AS ENUM ('attivo','in_manutenzione','guasto','dismesso');

CREATE OR REPLACE FUNCTION public.tg_set_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles read all authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles update own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles insert own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)));
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.structures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE,
  address text, city text, country text DEFAULT 'IT',
  rooms_count int, notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.structures TO authenticated;
GRANT ALL ON public.structures TO service_role;
ALTER TABLE public.structures ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER structures_updated_at BEFORE UPDATE ON public.structures FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  structure_id uuid REFERENCES public.structures(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role, structure_id)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles read own" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role, _structure_id uuid DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
      AND (_structure_id IS NULL OR structure_id IS NULL OR structure_id = _structure_id))
$$;

CREATE OR REPLACE FUNCTION public.has_structure_access(_user_id uuid, _structure_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND (structure_id = _structure_id OR structure_id IS NULL OR role = 'super_admin'))
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id
    AND role IN ('super_admin','direttore','facility_manager'))
$$;

CREATE POLICY "structures read accessible" ON public.structures FOR SELECT TO authenticated
  USING (public.has_structure_access(auth.uid(), id));
CREATE POLICY "structures admin manage" ON public.structures FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.floors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id uuid NOT NULL REFERENCES public.structures(id) ON DELETE CASCADE,
  name text NOT NULL, level int,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.floors TO authenticated;
GRANT ALL ON public.floors TO service_role;
ALTER TABLE public.floors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "floors access" ON public.floors FOR ALL TO authenticated
  USING (public.has_structure_access(auth.uid(), structure_id))
  WITH CHECK (public.has_structure_access(auth.uid(), structure_id));

CREATE TABLE public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id uuid NOT NULL REFERENCES public.structures(id) ON DELETE CASCADE,
  floor_id uuid REFERENCES public.floors(id) ON DELETE SET NULL,
  name text NOT NULL, room_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rooms TO authenticated;
GRANT ALL ON public.rooms TO service_role;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rooms access" ON public.rooms FOR ALL TO authenticated
  USING (public.has_structure_access(auth.uid(), structure_id))
  WITH CHECK (public.has_structure_access(auth.uid(), structure_id));

CREATE TABLE public.asset_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE, icon text, color text
);
GRANT SELECT ON public.asset_categories TO authenticated;
GRANT ALL ON public.asset_categories TO service_role;
ALTER TABLE public.asset_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "asset_categories read all" ON public.asset_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "asset_categories admin manage" ON public.asset_categories FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

INSERT INTO public.asset_categories (name, icon, color) VALUES
  ('HVAC / Climatizzazione','wind','#0ea5e9'),
  ('Idraulico','droplet','#06b6d4'),
  ('Elettrico','zap','#f59e0b'),
  ('Ascensori','arrow-up-down','#8b5cf6'),
  ('Cucine','chef-hat','#ef4444'),
  ('Lavanderia','shirt','#10b981'),
  ('Antincendio','flame','#dc2626'),
  ('Piscina & SPA','waves','#0891b2'),
  ('IT & Wi-Fi','wifi','#6366f1'),
  ('Mobilio','sofa','#a78bfa'),
  ('Altri','package','#64748b');

CREATE TABLE public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id uuid NOT NULL REFERENCES public.structures(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.asset_categories(id) ON DELETE SET NULL,
  floor_id uuid REFERENCES public.floors(id) ON DELETE SET NULL,
  room_id uuid REFERENCES public.rooms(id) ON DELETE SET NULL,
  code text NOT NULL, name text NOT NULL,
  brand text, model text, serial_number text,
  install_date date, warranty_until date,
  status public.asset_status NOT NULL DEFAULT 'attivo',
  photo_url text, manual_url text, notes text,
  qr_token text UNIQUE DEFAULT replace(gen_random_uuid()::text,'-',''),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (structure_id, code)
);
CREATE INDEX assets_structure_idx ON public.assets(structure_id);
CREATE INDEX assets_category_idx ON public.assets(category_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assets TO authenticated;
GRANT ALL ON public.assets TO service_role;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assets access" ON public.assets FOR ALL TO authenticated
  USING (public.has_structure_access(auth.uid(), structure_id))
  WITH CHECK (public.has_structure_access(auth.uid(), structure_id));
CREATE TRIGGER assets_updated_at BEFORE UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.sla_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id uuid REFERENCES public.structures(id) ON DELETE CASCADE,
  priority public.ticket_priority NOT NULL,
  category_id uuid REFERENCES public.asset_categories(id) ON DELETE CASCADE,
  ack_minutes int NOT NULL,
  resolve_minutes int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sla_rules TO authenticated;
GRANT ALL ON public.sla_rules TO service_role;
ALTER TABLE public.sla_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sla_rules read" ON public.sla_rules FOR SELECT TO authenticated
  USING (structure_id IS NULL OR public.has_structure_access(auth.uid(), structure_id));
CREATE POLICY "sla_rules admin manage" ON public.sla_rules FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

INSERT INTO public.sla_rules (priority, ack_minutes, resolve_minutes) VALUES
  ('critica', 15, 120),('alta', 60, 480),('media', 240, 1440),('bassa', 480, 4320);

CREATE TABLE public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number serial,
  structure_id uuid NOT NULL REFERENCES public.structures(id) ON DELETE CASCADE,
  asset_id uuid REFERENCES public.assets(id) ON DELETE SET NULL,
  category_id uuid REFERENCES public.asset_categories(id) ON DELETE SET NULL,
  room_id uuid REFERENCES public.rooms(id) ON DELETE SET NULL,
  title text NOT NULL, description text,
  priority public.ticket_priority NOT NULL DEFAULT 'media',
  status public.ticket_status NOT NULL DEFAULT 'aperto',
  reported_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  photo_url text,
  ack_due_at timestamptz, resolve_due_at timestamptz,
  ack_at timestamptz, resolved_at timestamptz, closed_at timestamptz,
  tts_announced boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tickets_structure_idx ON public.tickets(structure_id);
CREATE INDEX tickets_status_idx ON public.tickets(status);
CREATE INDEX tickets_assigned_idx ON public.tickets(assigned_to);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tickets TO authenticated;
GRANT ALL ON public.tickets TO service_role;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tickets read structure or assigned" ON public.tickets FOR SELECT TO authenticated
  USING (public.has_structure_access(auth.uid(), structure_id) OR assigned_to = auth.uid() OR reported_by = auth.uid());
CREATE POLICY "tickets insert structure" ON public.tickets FOR INSERT TO authenticated
  WITH CHECK (public.has_structure_access(auth.uid(), structure_id));
CREATE POLICY "tickets update" ON public.tickets FOR UPDATE TO authenticated
  USING (assigned_to = auth.uid() OR reported_by = auth.uid() OR public.is_admin(auth.uid()) OR public.has_structure_access(auth.uid(), structure_id))
  WITH CHECK (true);
CREATE POLICY "tickets delete admin" ON public.tickets FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));
CREATE TRIGGER tickets_updated_at BEFORE UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE OR REPLACE FUNCTION public.apply_sla_on_ticket() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rule record;
BEGIN
  IF NEW.ack_due_at IS NULL OR NEW.resolve_due_at IS NULL THEN
    SELECT ack_minutes, resolve_minutes INTO rule
    FROM public.sla_rules
    WHERE priority = NEW.priority
      AND (structure_id = NEW.structure_id OR structure_id IS NULL)
      AND (category_id = NEW.category_id OR category_id IS NULL)
    ORDER BY (structure_id IS NOT NULL) DESC, (category_id IS NOT NULL) DESC
    LIMIT 1;
    IF rule.ack_minutes IS NOT NULL THEN
      NEW.ack_due_at := COALESCE(NEW.ack_due_at, COALESCE(NEW.created_at, now()) + (rule.ack_minutes || ' minutes')::interval);
      NEW.resolve_due_at := COALESCE(NEW.resolve_due_at, COALESCE(NEW.created_at, now()) + (rule.resolve_minutes || ' minutes')::interval);
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tickets_sla_before_insert BEFORE INSERT ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.apply_sla_on_ticket();

CREATE TABLE public.ticket_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_comments TO authenticated;
GRANT ALL ON public.ticket_comments TO service_role;
ALTER TABLE public.ticket_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ticket_comments read" ON public.ticket_comments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_id
    AND (public.has_structure_access(auth.uid(), t.structure_id) OR t.assigned_to = auth.uid() OR t.reported_by = auth.uid())));
CREATE POLICY "ticket_comments insert own" ON public.ticket_comments FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid());
