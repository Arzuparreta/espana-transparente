-- W1: INE municipality layer for /territorio.
--
-- Adds municipalities to the canonical territory_catalog (keyed by INE code),
-- a municipality_key on contracts/subsidies, and reuses territory_population
-- for municipal per-capita (no new population table).
--
-- Municipality resolution from free-text awarding/granting bodies is done in the
-- ETL (src.territorio.municipios), NOT in the canonical-territory trigger. Reason:
-- territory_aliases.alias_key is a unique PK and names like MADRID/SEVILLA/MURCIA/
-- VALENCIA already map to the *province*. Routing ~8.100 municipios through the
-- same alias table would clobber province resolution. Municipio names are also
-- not unique nationally, so resolution must be ambiguity-safe (unique match only).

ALTER TABLE territory_catalog ADD COLUMN IF NOT EXISTS ine_code text;

ALTER TABLE territory_catalog DROP CONSTRAINT IF EXISTS territory_catalog_territory_type_check;
ALTER TABLE territory_catalog ADD CONSTRAINT territory_catalog_territory_type_check
  CHECK (territory_type IN ('ccaa', 'province', 'municipality'));

-- INE municipal code (5 digits) is unique among municipalities; ccaa/province
-- rows leave it NULL.
CREATE UNIQUE INDEX IF NOT EXISTS territory_catalog_ine_code_idx
  ON territory_catalog (ine_code) WHERE ine_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS territory_catalog_type_parent_idx
  ON territory_catalog (territory_type, parent_key);

ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS municipality_key text REFERENCES territory_catalog(territory_key);
ALTER TABLE subsidies
  ADD COLUMN IF NOT EXISTS municipality_key text REFERENCES territory_catalog(territory_key);

CREATE INDEX IF NOT EXISTS contracts_municipality_idx ON contracts (municipality_key, date);
CREATE INDEX IF NOT EXISTS subsidies_municipality_idx ON subsidies (municipality_key, fecha_concesion);

-- Per-municipio resolved spend aggregate. Mirrors v_territory_spend_yearly but
-- keyed on the canonical municipality_key (set by the ETL), so the hub can show
-- "gasto de tu ayuntamiento" with per-capita against territory_population.
DROP MATERIALIZED VIEW IF EXISTS v_municipio_spend_yearly;
CREATE MATERIALIZED VIEW v_municipio_spend_yearly AS
WITH source_rows AS (
  SELECT
    'contracts'::text AS dataset,
    c.municipality_key,
    c.date AS record_date,
    c.amount::numeric AS amount
  FROM contracts c
  WHERE c.administration_level = 'municipal' AND c.municipality_key IS NOT NULL

  UNION ALL

  SELECT
    'subsidies'::text AS dataset,
    s.municipality_key,
    s.fecha_concesion AS record_date,
    s.importe::numeric AS amount
  FROM subsidies s
  WHERE s.administration_level = 'municipal' AND s.municipality_key IS NOT NULL
)
SELECT
  dataset,
  municipality_key,
  extract(year FROM record_date)::integer AS year,
  count(*)::bigint AS record_count,
  coalesce(sum(amount), 0)::numeric AS total_amount,
  max(record_date) AS latest_record_date
FROM source_rows
GROUP BY dataset, municipality_key, extract(year FROM record_date)::integer;

CREATE UNIQUE INDEX v_municipio_spend_yearly_identity_idx
  ON v_municipio_spend_yearly (dataset, municipality_key, year);
CREATE INDEX v_municipio_spend_yearly_muni_idx
  ON v_municipio_spend_yearly (municipality_key, year, dataset);

-- Refresh both atlas aggregates together so a single daily call keeps the
-- autonomic and municipal materialized views in sync.
CREATE OR REPLACE FUNCTION refresh_territory_atlas()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW v_territory_spend_yearly;
  REFRESH MATERIALIZED VIEW v_municipio_spend_yearly;
END;
$$;

GRANT SELECT ON v_municipio_spend_yearly TO anon, authenticated;
