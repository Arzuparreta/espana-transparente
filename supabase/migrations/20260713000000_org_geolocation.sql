-- W2: recipient geolocation.
--
-- "¿A dónde llega el dinero?" needs the location of the receptor (the company /
-- beneficiary), not just the awarding administration. organizations gets a
-- location resolved by src.territorio.org_geolocation (CIF province heuristic +
-- public-body name match against the INE catalog). contracts/subsidies then
-- denormalize the receptor's province/municipio (via contractor_organization_id /
-- beneficiary_organization_id) so "dinero que llega aquí" and "empresas de aquí"
-- are index-able without recomputing.
--
-- Coverage is partial by nature (orgs without a NIF or a matchable name stay
-- NULL). The UI must label coverage and never imply completeness.

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS nif text,
  ADD COLUMN IF NOT EXISTS province_key text REFERENCES territory_catalog(territory_key),
  ADD COLUMN IF NOT EXISTS municipality_key text REFERENCES territory_catalog(territory_key),
  ADD COLUMN IF NOT EXISTS location_source text
    CHECK (location_source IN ('cif', 'borme', 'name_match', 'manual')),
  ADD COLUMN IF NOT EXISTS location_confidence numeric,
  -- set on every resolution attempt (resolved or not) so --resume can skip
  -- already-attempted orgs instead of retrying unresolvable ones every run.
  ADD COLUMN IF NOT EXISTS geolocated_at timestamptz;

CREATE INDEX IF NOT EXISTS organizations_province_idx ON organizations (province_key);
CREATE INDEX IF NOT EXISTS organizations_municipality_idx ON organizations (municipality_key);
CREATE INDEX IF NOT EXISTS organizations_geolocated_idx ON organizations (geolocated_at);

ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS contractor_province_key text REFERENCES territory_catalog(territory_key),
  ADD COLUMN IF NOT EXISTS contractor_municipality_key text REFERENCES territory_catalog(territory_key);

ALTER TABLE subsidies
  ADD COLUMN IF NOT EXISTS beneficiary_province_key text REFERENCES territory_catalog(territory_key),
  ADD COLUMN IF NOT EXISTS beneficiary_municipality_key text REFERENCES territory_catalog(territory_key);

CREATE INDEX IF NOT EXISTS contracts_contractor_province_idx ON contracts (contractor_province_key);
CREATE INDEX IF NOT EXISTS contracts_contractor_municipality_idx ON contracts (contractor_municipality_key);
CREATE INDEX IF NOT EXISTS subsidies_beneficiary_province_idx ON subsidies (beneficiary_province_key);
CREATE INDEX IF NOT EXISTS subsidies_beneficiary_municipality_idx ON subsidies (beneficiary_municipality_key);

-- Coverage signal for /estado-datos: how many organizations carry a resolved
-- location, split by source. security_invoker so RLS of the caller applies.
CREATE OR REPLACE VIEW v_org_geolocation_coverage
WITH (security_invoker = true) AS
SELECT
  count(*)::bigint AS total_orgs,
  count(*) FILTER (WHERE province_key IS NOT NULL)::bigint AS located_orgs,
  count(*) FILTER (WHERE municipality_key IS NOT NULL)::bigint AS municipality_located_orgs,
  count(*) FILTER (WHERE location_source = 'cif')::bigint AS via_cif,
  count(*) FILTER (WHERE location_source = 'name_match')::bigint AS via_name_match,
  count(*) FILTER (WHERE location_source = 'borme')::bigint AS via_borme
FROM organizations;

GRANT SELECT ON v_org_geolocation_coverage TO anon, authenticated;
