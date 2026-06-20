CREATE OR REPLACE FUNCTION public.audit_trigger_fn()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_struct uuid; v_entity_id uuid; v_action text; v_diff jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'insert'; v_entity_id := (to_jsonb(NEW)->>'id')::uuid;
    v_struct := NULLIF(to_jsonb(NEW)->>'structure_id','')::uuid;
    v_diff := jsonb_build_object('new', to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update'; v_entity_id := (to_jsonb(NEW)->>'id')::uuid;
    v_struct := NULLIF(to_jsonb(NEW)->>'structure_id','')::uuid;
    v_diff := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
  ELSE
    v_action := 'delete'; v_entity_id := (to_jsonb(OLD)->>'id')::uuid;
    v_struct := NULLIF(to_jsonb(OLD)->>'structure_id','')::uuid;
    v_diff := jsonb_build_object('old', to_jsonb(OLD));
  END IF;
  INSERT INTO public.audit_log(structure_id, user_id, entity_type, entity_id, action, diff)
  VALUES (v_struct, v_user, TG_TABLE_NAME, v_entity_id, v_action, v_diff);
  RETURN COALESCE(NEW, OLD);
END$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['invoices','cash_movements','integrations','supplier_documents','suppliers']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_%1$s ON public.%1$s', t);
    EXECUTE format('CREATE TRIGGER audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$s FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn()', t);
  END LOOP;
END$$;

CREATE OR REPLACE FUNCTION public.alerts_for_structure(_structure uuid)
RETURNS TABLE(kind text, severity text, title text, detail text, ref_id uuid, due_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM (
    SELECT 'sla_violation'::text AS kind, 'high'::text AS severity,
      'Violazione SLA: ' || COALESCE(t.title,'ticket') AS title,
      'Ticket ' || COALESCE(t.title,'') AS detail,
      v.id AS ref_id, v.created_at AS due_at
    FROM public.sla_violations v
    LEFT JOIN public.tickets t ON t.id = v.ticket_id
    WHERE v.structure_id = _structure AND COALESCE(v.status::text,'open') <> 'resolved'
    UNION ALL
    SELECT 'contract_expiry', CASE WHEN c.end_date <= current_date + 7 THEN 'high' ELSE 'medium' END,
      'Contratto in scadenza: ' || c.title,
      'Scade il ' || to_char(c.end_date,'DD/MM/YYYY'),
      c.id, c.end_date::timestamptz
    FROM public.contracts c
    WHERE c.structure_id = _structure AND c.end_date IS NOT NULL
      AND c.end_date BETWEEN current_date AND current_date + interval '30 days'
      AND c.status::text <> 'cessato'
    UNION ALL
    SELECT 'invoice_due', CASE WHEN i.due_date < current_date THEN 'high' ELSE 'medium' END,
      'Fattura ' || COALESCE(i.number,'#') || ' € ' || COALESCE(i.amount_total::text,'0'),
      CASE WHEN i.due_date < current_date THEN 'Scaduta il ' ELSE 'Scade il ' END || to_char(i.due_date,'DD/MM/YYYY'),
      i.id, i.due_date::timestamptz
    FROM public.invoices i
    WHERE i.structure_id = _structure AND i.status::text = 'da_pagare'
      AND i.due_date IS NOT NULL AND i.due_date <= current_date + interval '7 days'
    UNION ALL
    SELECT 'supplier_doc_expiry', CASE WHEN d.expires_on <= current_date THEN 'high' ELSE 'medium' END,
      'Documento fornitore in scadenza',
      'Doc ' || COALESCE(d.doc_type::text,'') || ' scade il ' || to_char(d.expires_on,'DD/MM/YYYY'),
      d.id, d.expires_on::timestamptz
    FROM public.supplier_documents d
    JOIN public.suppliers s ON s.id = d.supplier_id
    WHERE s.structure_id = _structure AND d.expires_on IS NOT NULL
      AND d.expires_on <= current_date + interval '30 days'
  ) x
  ORDER BY x.due_at NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.alerts_for_structure(uuid) TO authenticated;