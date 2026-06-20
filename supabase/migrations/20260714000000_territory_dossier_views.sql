-- W4: server-side aggregates for the territorial dossier "¿a dónde llega el dinero?".
--
-- The web layer must not pull thousands of rows (or pass thousands of UUIDs in a
-- URI) to compute "empresas de aquí" and "dinero que llega aquí". These matviews
-- pre-join the receptor org location (W2) with received totals so the dossier
-- reads one small, indexed query per section.

-- Top receptor organizations by location: each located org with the money it has
-- received as contractor (contracts) + beneficiary (subsidies). Ranked per query.
DROP MATERIALIZED VIEW IF EXISTS v_territory_receptor_orgs;
CREATE MATERIALIZED VIEW v_territory_receptor_orgs AS
SELECT
  o.id AS organization_id,
  o.name,
  o.organization_type,
  o.province_key,
  o.municipality_key,
  coalesce(c.cnt, 0)::bigint AS contract_count,
  coalesce(c.total, 0)::numeric AS contract_total,
  coalesce(s.cnt, 0)::bigint AS subsidy_count,
  coalesce(s.total, 0)::numeric AS subsidy_total,
  (coalesce(c.total, 0) + coalesce(s.total, 0))::numeric AS received_total
FROM organizations o
LEFT JOIN (
  SELECT contractor_organization_id AS oid, count(*) AS cnt, sum(amount) AS total
  FROM contracts WHERE contractor_organization_id IS NOT NULL
  GROUP BY contractor_organization_id
) c ON c.oid = o.id
LEFT JOIN (
  SELECT beneficiary_organization_id AS oid, count(*) AS cnt, sum(importe) AS total
  FROM subsidies WHERE beneficiary_organization_id IS NOT NULL
  GROUP BY beneficiary_organization_id
) s ON s.oid = o.id
WHERE o.province_key IS NOT NULL;

CREATE UNIQUE INDEX v_territory_receptor_orgs_id_idx ON v_territory_receptor_orgs (organization_id);
CREATE INDEX v_territory_receptor_orgs_province_idx
  ON v_territory_receptor_orgs (province_key, received_total DESC);
CREATE INDEX v_territory_receptor_orgs_muni_idx
  ON v_territory_receptor_orgs (municipality_key, received_total DESC);

-- Money landing in each province, by dataset (contracts/subsidies/eu_funds),
-- keyed on the receptor's province. One row per (dataset, province).
DROP MATERIALIZED VIEW IF EXISTS v_territory_money_in;
CREATE MATERIALIZED VIEW v_territory_money_in AS
SELECT 'contracts'::text AS dataset, contractor_province_key AS province_key,
       count(*)::bigint AS record_count, coalesce(sum(amount), 0)::numeric AS total_amount
FROM contracts WHERE contractor_province_key IS NOT NULL
GROUP BY contractor_province_key
UNION ALL
SELECT 'subsidies'::text, beneficiary_province_key,
       count(*)::bigint, coalesce(sum(importe), 0)::numeric
FROM subsidies WHERE beneficiary_province_key IS NOT NULL
GROUP BY beneficiary_province_key
UNION ALL
SELECT 'eu_funds'::text, o.province_key,
       count(*)::bigint, coalesce(sum(ef.eu_budget), 0)::numeric
FROM eu_funds ef
JOIN organizations o ON o.id = ef.beneficiary_organization_id
WHERE o.province_key IS NOT NULL
GROUP BY o.province_key;

CREATE UNIQUE INDEX v_territory_money_in_idx ON v_territory_money_in (dataset, province_key);
CREATE INDEX v_territory_money_in_province_idx ON v_territory_money_in (province_key);

-- Fold these into the daily atlas refresh.
CREATE OR REPLACE FUNCTION refresh_territory_atlas()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW v_territory_spend_yearly;
  REFRESH MATERIALIZED VIEW v_municipio_spend_yearly;
  REFRESH MATERIALIZED VIEW v_territory_receptor_orgs;
  REFRESH MATERIALIZED VIEW v_territory_money_in;
END;
$$;

GRANT SELECT ON v_territory_receptor_orgs, v_territory_money_in TO anon, authenticated;
