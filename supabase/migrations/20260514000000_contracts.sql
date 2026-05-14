-- Public procurement contracts from PCSP (Plataforma de Contratación del Sector Público)
-- Upgrades the lightweight contracts table created in the initial schema to the
-- canonical shape used by the ETL and frontend.

ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS contract_folder_id text,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS contract_type text,
  ADD COLUMN IF NOT EXISTS cpv_code text,
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS ministry_normalized text,
  ADD COLUMN IF NOT EXISTS awarding_body_organization_id uuid,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contracts_contract_folder_id_key'
  ) THEN
    ALTER TABLE contracts ADD CONSTRAINT contracts_contract_folder_id_key UNIQUE (contract_folder_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS contracts_amount_idx ON contracts (amount DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS contracts_date_idx ON contracts (date DESC);
CREATE INDEX IF NOT EXISTS contracts_authority_idx ON contracts (awarding_body);
CREATE INDEX IF NOT EXISTS contracts_status_idx ON contracts (status);
CREATE INDEX IF NOT EXISTS contracts_ministry_idx ON contracts (ministry_normalized);
CREATE INDEX IF NOT EXISTS contracts_awarding_org_idx ON contracts (awarding_body_organization_id);

ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "contracts_public_read" ON contracts;
CREATE POLICY "contracts_public_read" ON contracts FOR SELECT USING (true);
