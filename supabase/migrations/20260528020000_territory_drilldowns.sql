CREATE OR REPLACE VIEW v_subsidy_territory_records
WITH (security_invoker = true) AS
SELECT
  s.id,
  s.administration_level,
  normalize_money_text(s.nivel2) AS territory_key,
  btrim(s.nivel2) AS territory_name,
  s.beneficiario,
  s.convocatoria,
  s.importe,
  s.fecha_concesion,
  s.source_url,
  s.nivel3 AS granting_body
FROM subsidies s
WHERE s.administration_level IN ('autonomic', 'municipal')
  AND NULLIF(btrim(s.nivel2), '') IS NOT NULL;

CREATE OR REPLACE VIEW v_contract_territory_records
WITH (security_invoker = true) AS
SELECT
  c.id,
  c.administration_level,
  normalize_money_text(c.region) AS territory_key,
  btrim(c.region) AS territory_name,
  c.title,
  c.awarding_body,
  c.amount,
  c.date,
  c.source_url,
  c.contract_type
FROM contracts c
WHERE c.administration_level IN ('autonomic', 'municipal')
  AND NULLIF(btrim(c.region), '') IS NOT NULL;

CREATE OR REPLACE VIEW v_territory_money_rollups
WITH (security_invoker = true) AS
WITH subsidy_rollup AS (
  SELECT
    administration_level,
    territory_key,
    min(territory_name) AS territory_name,
    count(*)::bigint AS subsidy_count,
    coalesce(sum(importe), 0)::numeric AS subsidy_amount,
    max(fecha_concesion) AS subsidy_latest_date
  FROM v_subsidy_territory_records
  GROUP BY administration_level, territory_key
),
contract_rollup AS (
  SELECT
    administration_level,
    territory_key,
    min(territory_name) AS territory_name,
    count(*)::bigint AS contract_count,
    coalesce(sum(amount), 0)::numeric AS contract_amount,
    max(date) AS contract_latest_date
  FROM v_contract_territory_records
  GROUP BY administration_level, territory_key
)
SELECT
  coalesce(s.administration_level, c.administration_level) AS administration_level,
  coalesce(s.territory_key, c.territory_key) AS territory_key,
  coalesce(s.territory_name, c.territory_name) AS territory_name,
  coalesce(s.subsidy_count, 0)::bigint AS subsidy_count,
  coalesce(s.subsidy_amount, 0)::numeric AS subsidy_amount,
  s.subsidy_latest_date,
  coalesce(c.contract_count, 0)::bigint AS contract_count,
  coalesce(c.contract_amount, 0)::numeric AS contract_amount,
  c.contract_latest_date
FROM subsidy_rollup s
FULL OUTER JOIN contract_rollup c
  ON c.administration_level = s.administration_level
 AND c.territory_key = s.territory_key;

CREATE OR REPLACE VIEW v_territory_money_coverage
WITH (security_invoker = true) AS
SELECT
  base.administration_level,
  base.dataset,
  count(*) FILTER (WHERE base.territory_name IS NOT NULL)::bigint AS resolved_count,
  count(*) FILTER (WHERE base.territory_name IS NULL)::bigint AS unresolved_count
FROM (
  SELECT
    administration_level,
    'subsidies'::text AS dataset,
    NULLIF(btrim(nivel2), '') AS territory_name
  FROM subsidies
  WHERE administration_level IN ('autonomic', 'municipal')

  UNION ALL

  SELECT
    administration_level,
    'contracts'::text AS dataset,
    NULLIF(btrim(region), '') AS territory_name
  FROM contracts
  WHERE administration_level IN ('autonomic', 'municipal')
) base
GROUP BY base.administration_level, base.dataset;
