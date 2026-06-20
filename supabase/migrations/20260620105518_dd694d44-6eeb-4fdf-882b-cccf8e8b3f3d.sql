DO $$
DECLARE
  v_org uuid := 'e30fe6ef-6121-4bf2-b8de-4b974d95027c';
  v_user uuid := 'bfd8e163-cfea-4946-97cd-99f229e6445c';
  v_struct uuid;
  v_cat_hvac uuid := '4da9d809-e8d0-406c-99fc-a1f30c53d7d7';
  v_cat_elec uuid := '75fb80e4-4480-4cef-a37a-18985cb72b50';
  v_cat_idr  uuid := '4ff3782c-c114-48e8-bcdc-b64418dc30b9';
  v_a1 uuid; v_a2 uuid; v_a3 uuid; v_s1 uuid; v_s2 uuid;
BEGIN
  SELECT id INTO v_struct FROM public.structures WHERE organization_id = v_org AND code = 'RIV-DEMO';
  IF v_struct IS NULL THEN
    INSERT INTO public.structures (organization_id, name, code, address, city, country, rooms_count, timezone, onboarded_at, onboarding_preset, vat_number)
    VALUES (v_org, 'Hotel Riviera Demo', 'RIV-DEMO', 'Lungomare Caboto 12', 'Rimini', 'IT', 84, 'Europe/Rome', now(), 'hotel_4_stelle', 'IT01234567890')
    RETURNING id INTO v_struct;
  END IF;

  INSERT INTO public.assets (structure_id, category_id, code, name, brand, model, status, notes)
  SELECT v_struct, c, code, name, brand, model, status::asset_status, notes FROM (VALUES
    (v_cat_hvac, 'HVAC-001', 'Chiller centrale 250 kW', 'Carrier', '30HXC-260', 'attivo', 'Servizio piscina + lobby'),
    (v_cat_hvac, 'HVAC-002', 'Split camera 312', 'Daikin', 'FTXM35', 'attivo', NULL),
    (v_cat_hvac, 'HVAC-003', 'UTA piano interrato', 'Mitsubishi', 'GUF-100', 'in_manutenzione', 'In manutenzione preventiva'),
    (v_cat_elec, 'ELE-001', 'Quadro generale BT', 'ABB', 'XT4', 'attivo', NULL),
    (v_cat_elec, 'ELE-002', 'UPS reception 6 kVA', 'Riello', 'Sentinel Dual', 'attivo', NULL),
    (v_cat_idr,  'IDR-001', 'Caldaia gas 120 kW', 'Vaillant', 'ecoTEC pro', 'attivo', NULL),
    (v_cat_idr,  'IDR-002', 'Pompa ricircolo ACS', 'Grundfos', 'Magna3', 'guasto', 'Da sostituire entro 7g'),
    (v_cat_idr,  'IDR-003', 'Addolcitore acqua', 'Culligan', 'Medallist', 'attivo', NULL)
  ) AS t(c, code, name, brand, model, status, notes)
  WHERE NOT EXISTS (SELECT 1 FROM public.assets a WHERE a.structure_id = v_struct AND a.code = t.code);

  SELECT id INTO v_a1 FROM public.assets WHERE structure_id = v_struct AND code = 'HVAC-001';
  SELECT id INTO v_a2 FROM public.assets WHERE structure_id = v_struct AND code = 'IDR-002';
  SELECT id INTO v_a3 FROM public.assets WHERE structure_id = v_struct AND code = 'ELE-001';

  INSERT INTO public.suppliers (structure_id, name, vat_number, email, phone, category)
  SELECT v_struct, name, vat, email, phone, cat FROM (VALUES
    ('Termo Service S.r.l.', 'IT09876543210', 'assistenza@termoservice.it', '+39 0541 123456', 'hvac'),
    ('Idro Plus S.n.c.', 'IT09988776655', 'info@idroplus.it', '+39 0541 654321', 'idraulica')
  ) AS t(name, vat, email, phone, cat)
  WHERE NOT EXISTS (SELECT 1 FROM public.suppliers s WHERE s.structure_id = v_struct AND s.vat_number = t.vat);

  SELECT id INTO v_s1 FROM public.suppliers WHERE structure_id = v_struct AND vat_number = 'IT09876543210';
  SELECT id INTO v_s2 FROM public.suppliers WHERE structure_id = v_struct AND vat_number = 'IT09988776655';

  INSERT INTO public.tickets (structure_id, asset_id, title, description, priority, status, reported_by, ack_due_at, resolve_due_at)
  SELECT v_struct, aid, title, descr, pr::ticket_priority, st::ticket_status, v_user, ack, res FROM (VALUES
    (v_a2, 'Pompa ricircolo ACS non parte', 'Acqua calda assente nelle camere 401-415', 'critica', 'aperto', now() + interval '15 minutes', now() + interval '2 hours'),
    (v_a1, 'Chiller errore E04', 'Allarme bassa pressione gas refrigerante', 'alta', 'in_corso', now() - interval '1 hour', now() + interval '4 hours'),
    (v_a3, 'Quadro BT - manutenzione semestrale', 'Termografia e serraggi periodici', 'media', 'assegnato', now() + interval '1 day', now() + interval '5 days'),
    (NULL::uuid, 'Camera 218: tapparella bloccata', 'Tapparella elettrica camera 218 non sale', 'media', 'risolto', now() - interval '1 day', now() - interval '2 hours'),
    (NULL::uuid, 'Lobby: lampada faretto fulminata', 'Faretto LED ingresso lato sinistro', 'bassa', 'chiuso', now() - interval '3 days', now() - interval '2 days'),
    (v_a1, 'Rumore anomalo compressore', 'Compressore #2 emette rumore metallico', 'alta', 'aperto', now() + interval '30 minutes', now() + interval '6 hours')
  ) AS t(aid, title, descr, pr, st, ack, res)
  WHERE NOT EXISTS (SELECT 1 FROM public.tickets x WHERE x.structure_id = v_struct AND x.title = t.title);

  INSERT INTO public.invoices (structure_id, supplier_id, number, issue_date, due_date, amount_net, vat, amount_total, status, utility_type, notes)
  SELECT v_struct, sid, num, isd, dud, an, vt, at, st::invoice_status, ut::utility_type, nt FROM (VALUES
    (v_s1, 'FT2026-0142', current_date - 20, current_date + 10, 1820.00, 400.40, 2220.40, 'da_pagare', NULL, 'Intervento straordinario chiller'),
    (v_s2, 'FT2026-0089', current_date - 35, current_date - 5,  480.00,  105.60,  585.60, 'pagata',    NULL, 'Sostituzione valvole'),
    (NULL::uuid, 'ENEL-2026-Q1', current_date - 10, current_date + 20, 6240.00, 1372.80, 7612.80, 'da_pagare', 'elettricita', 'Bolletta energia Q1')
  ) AS t(sid, num, isd, dud, an, vt, at, st, ut, nt)
  WHERE NOT EXISTS (SELECT 1 FROM public.invoices i WHERE i.structure_id = v_struct AND i.number = t.num);

  INSERT INTO public.inventory_items (structure_id, sku, name, unit, quantity, min_quantity, unit_cost, supplier_id)
  SELECT v_struct, sku, name, unit, qty, thr, cost, sid FROM (VALUES
    ('FIL-G4', 'Filtro G4 UTA 595x595', 'pz', 12, 8, 18.50, v_s1),
    ('GUARN-IDR-25', 'Guarnizione idraulica DN25', 'pz', 4, 10, 2.30, v_s2),
    ('LED-9W', 'Lampada LED 9W E27', 'pz', 24, 20, 4.80, NULL::uuid),
    ('OLIO-COMP', 'Olio compressore frigo 1L', 'lt', 6, 3, 28.00, v_s1)
  ) AS t(sku, name, unit, qty, thr, cost, sid)
  WHERE NOT EXISTS (SELECT 1 FROM public.inventory_items x WHERE x.structure_id = v_struct AND x.sku = t.sku);
END $$;