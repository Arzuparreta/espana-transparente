-- Link EU fund beneficiaries to organizations table via normalized name matching.
-- This closes the traceability gap: EU fund → organization (beneficiary).

ALTER TABLE eu_funds
  ADD COLUMN IF NOT EXISTS beneficiary_organization_id uuid
  REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_eu_funds_beneficiary_org
  ON eu_funds (beneficiary_organization_id);
