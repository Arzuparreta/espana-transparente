-- Public procurement contracts from PCSP (Plataforma de Contratación del Sector Público)
CREATE TABLE contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_folder_id text UNIQUE NOT NULL,
  title text NOT NULL,
  contracting_authority text,
  amount_eur numeric,         -- TaxExclusiveAmount (sin IVA)
  total_amount_eur numeric,   -- TotalAmount (con IVA)
  status text,                -- PUB, ADJ, RES, ANU, PRE, EV
  contract_type text,         -- 1=Obras, 2=Servicios, 3=Suministros, ...
  cpv_code text,
  region text,
  published_at timestamptz,
  source_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX contracts_amount_idx ON contracts (amount_eur DESC NULLS LAST);
CREATE INDEX contracts_published_idx ON contracts (published_at DESC);
CREATE INDEX contracts_authority_idx ON contracts (contracting_authority);
CREATE INDEX contracts_status_idx ON contracts (status);

ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contracts_public_read" ON contracts FOR SELECT USING (true);
