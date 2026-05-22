-- Add contractor detail fields from CODICE XML section 4.35.2 / 4.35.3 / 4.35.7
ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS contractor_nif text,
  ADD COLUMN IF NOT EXISTS contractor_is_sme boolean,
  ADD COLUMN IF NOT EXISTS contractor_is_ute boolean,
  ADD COLUMN IF NOT EXISTS award_amount numeric(15,2),
  ADD COLUMN IF NOT EXISTS award_amount_with_taxes numeric(15,2),
  ADD COLUMN IF NOT EXISTS award_date date,
  ADD COLUMN IF NOT EXISTS contract_number text,
  ADD COLUMN IF NOT EXISTS received_tender_quantity integer;
