
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS tax_code text,
  ADD COLUMN IF NOT EXISTS sdi_code text,
  ADD COLUMN IF NOT EXISTS pec text,
  ADD COLUMN IF NOT EXISTS iban text,
  ADD COLUMN IF NOT EXISTS rea_number text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS billing_address text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS province text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS country text DEFAULT 'IT';

CREATE INDEX IF NOT EXISTS idx_suppliers_tax_code ON public.suppliers(tax_code);
CREATE INDEX IF NOT EXISTS idx_suppliers_vat ON public.suppliers(vat_number);
