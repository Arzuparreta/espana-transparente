-- Propagate responsibility_positions.official_id through the responsibility
-- view chain, alongside politician_id, so v_subsidy_responsibility /
-- v_contract_responsibility can expose it to web/src/lib/data/{subsidies,contracts}.ts.
--
-- official_id is appended as the LAST column in every SELECT list below to
-- avoid disturbing existing positional/explicit-column consumers.

CREATE OR REPLACE VIEW v_responsibility_position_lookup
WITH (security_invoker = true) AS
SELECT DISTINCT
  rp.id AS position_id,
  rp.administration_level,
  rp.position_type,
  rp.territory_name,
  rp.territory_code,
  rp.organization_name,
  rp.person_name,
  rp.politician_id,
  rp.political_party,
  rp.government,
  rp.start_date,
  rp.end_date,
  normalize_money_text(name_entry.lookup_name) AS lookup_name,
  rp.official_id
FROM responsibility_positions rp
CROSS JOIN LATERAL (
  SELECT rp.organization_name AS lookup_name
  UNION
  SELECT alias
  FROM unnest(coalesce(rp.organization_aliases, '{}'::text[])) AS alias
) AS name_entry;

CREATE OR REPLACE VIEW v_contract_responsibility_candidates
WITH (security_invoker = true) AS
SELECT
  base.record_id AS contract_id,
  lookup.position_id,
  lookup.person_name,
  lookup.politician_id,
  lookup.organization_name AS ministry,
  lookup.position_type,
  lookup.government,
  lookup.political_party,
  lookup.administration_level,
  lookup.territory_name,
  lookup.territory_code,
  lookup.start_date,
  lookup.end_date,
  'direct_department'::text AS match_method,
  0 AS match_rank,
  lookup.official_id
FROM v_contract_resolution_base base
JOIN v_responsibility_position_lookup lookup
  ON base.direct_department_normalized IS NOT NULL
 AND lookup.lookup_name = base.direct_department_normalized
 AND lookup.administration_level = 'state'
 AND base.record_date BETWEEN lookup.start_date AND coalesce(lookup.end_date, current_date)
UNION ALL
SELECT
  base.record_id AS contract_id,
  lookup.position_id,
  lookup.person_name,
  lookup.politician_id,
  lookup.organization_name AS ministry,
  lookup.position_type,
  lookup.government,
  lookup.political_party,
  lookup.administration_level,
  lookup.territory_name,
  lookup.territory_code,
  lookup.start_date,
  lookup.end_date,
  map.match_strategy AS match_method,
  1 AS match_rank,
  lookup.official_id
FROM v_contract_resolution_base base
JOIN public_body_responsibility_map map
  ON map.body_normalized = base.body_normalized
 AND (base.administration_level IS NULL OR map.administration_level = base.administration_level)
 AND base.record_date BETWEEN map.start_date AND coalesce(map.end_date, current_date)
JOIN v_responsibility_position_lookup lookup
  ON lookup.lookup_name = map.ministry_or_department_normalized
 AND lookup.administration_level = map.administration_level
 AND (
   coalesce(lookup.territory_code, '') = coalesce(map.territory_code, '')
   OR map.territory_code IS NULL
 )
 AND base.record_date BETWEEN lookup.start_date AND coalesce(lookup.end_date, current_date)
UNION ALL
SELECT
  base.record_id AS contract_id,
  lookup.position_id,
  lookup.person_name,
  lookup.politician_id,
  lookup.organization_name AS ministry,
  lookup.position_type,
  lookup.government,
  lookup.political_party,
  lookup.administration_level,
  lookup.territory_name,
  lookup.territory_code,
  lookup.start_date,
  lookup.end_date,
  'position_alias'::text AS match_method,
  2 AS match_rank,
  lookup.official_id
FROM v_contract_resolution_base base
JOIN v_responsibility_position_lookup lookup
  ON lookup.lookup_name = base.body_normalized
 AND (base.administration_level IS NULL OR lookup.administration_level = base.administration_level)
 AND base.record_date BETWEEN lookup.start_date AND coalesce(lookup.end_date, current_date)
UNION ALL
SELECT
  base.record_id AS contract_id,
  lookup.id AS position_id,
  lookup.person_name,
  lookup.politician_id,
  lookup.organization_name AS ministry,
  lookup.position_type,
  lookup.government,
  lookup.political_party,
  lookup.administration_level,
  lookup.territory_name,
  lookup.territory_code,
  lookup.start_date,
  lookup.end_date,
  'municipal_mayor_baseline'::text AS match_method,
  3 AS match_rank,
  lookup.official_id
FROM v_contract_resolution_base base
JOIN responsibility_positions lookup
  ON base.administration_level = 'municipal'
 AND lookup.administration_level = 'municipal'
 AND lookup.position_type = 'alcalde'
 AND normalize_money_text(lookup.territory_name) = base.inferred_territory_name
 AND base.record_date BETWEEN lookup.start_date AND coalesce(lookup.end_date, current_date);

CREATE OR REPLACE VIEW v_subsidy_responsibility_candidates
WITH (security_invoker = true) AS
SELECT
  base.record_id AS subsidy_id,
  lookup.position_id,
  lookup.person_name,
  lookup.politician_id,
  lookup.organization_name AS ministry,
  lookup.position_type,
  lookup.government,
  lookup.political_party,
  lookup.administration_level,
  lookup.territory_name,
  lookup.territory_code,
  lookup.start_date,
  lookup.end_date,
  'direct_department'::text AS match_method,
  0 AS match_rank,
  lookup.official_id
FROM v_subsidy_resolution_base base
JOIN v_responsibility_position_lookup lookup
  ON base.direct_department_normalized IS NOT NULL
 AND lookup.lookup_name = base.direct_department_normalized
 AND lookup.administration_level = 'state'
 AND base.record_date BETWEEN lookup.start_date AND coalesce(lookup.end_date, current_date)
UNION ALL
SELECT
  base.record_id AS subsidy_id,
  lookup.position_id,
  lookup.person_name,
  lookup.politician_id,
  lookup.organization_name AS ministry,
  lookup.position_type,
  lookup.government,
  lookup.political_party,
  lookup.administration_level,
  lookup.territory_name,
  lookup.territory_code,
  lookup.start_date,
  lookup.end_date,
  map.match_strategy AS match_method,
  1 AS match_rank,
  lookup.official_id
FROM v_subsidy_resolution_base base
JOIN public_body_responsibility_map map
  ON map.body_normalized = base.body_normalized
 AND (base.administration_level IS NULL OR map.administration_level = base.administration_level)
 AND base.record_date BETWEEN map.start_date AND coalesce(map.end_date, current_date)
JOIN v_responsibility_position_lookup lookup
  ON lookup.lookup_name = map.ministry_or_department_normalized
 AND lookup.administration_level = map.administration_level
 AND (
   coalesce(lookup.territory_code, '') = coalesce(map.territory_code, '')
   OR map.territory_code IS NULL
 )
 AND base.record_date BETWEEN lookup.start_date AND coalesce(lookup.end_date, current_date)
UNION ALL
SELECT
  base.record_id AS subsidy_id,
  lookup.position_id,
  lookup.person_name,
  lookup.politician_id,
  lookup.organization_name AS ministry,
  lookup.position_type,
  lookup.government,
  lookup.political_party,
  lookup.administration_level,
  lookup.territory_name,
  lookup.territory_code,
  lookup.start_date,
  lookup.end_date,
  'position_alias'::text AS match_method,
  2 AS match_rank,
  lookup.official_id
FROM v_subsidy_resolution_base base
JOIN v_responsibility_position_lookup lookup
  ON lookup.lookup_name = base.body_normalized
 AND (base.administration_level IS NULL OR lookup.administration_level = base.administration_level)
 AND base.record_date BETWEEN lookup.start_date AND coalesce(lookup.end_date, current_date)
UNION ALL
SELECT
  base.record_id AS subsidy_id,
  lookup.id AS position_id,
  lookup.person_name,
  lookup.politician_id,
  lookup.organization_name AS ministry,
  lookup.position_type,
  lookup.government,
  lookup.political_party,
  lookup.administration_level,
  lookup.territory_name,
  lookup.territory_code,
  lookup.start_date,
  lookup.end_date,
  'municipal_mayor_baseline'::text AS match_method,
  3 AS match_rank,
  lookup.official_id
FROM v_subsidy_resolution_base base
JOIN responsibility_positions lookup
  ON base.administration_level = 'municipal'
 AND lookup.administration_level = 'municipal'
 AND lookup.position_type = 'alcalde'
 AND normalize_money_text(lookup.territory_name) = base.inferred_territory_name
 AND base.record_date BETWEEN lookup.start_date AND coalesce(lookup.end_date, current_date);

CREATE OR REPLACE VIEW v_subsidy_responsibility
WITH (security_invoker = true) AS
SELECT
  ranked.subsidy_id,
  ranked.position_id,
  ranked.person_name,
  ranked.politician_id,
  ranked.ministry,
  ranked.position_type,
  ranked.government,
  ranked.political_party,
  ranked.administration_level,
  ranked.territory_name,
  ranked.territory_code,
  ranked.match_method,
  ranked.official_id
FROM (
  SELECT
    candidate.*,
    row_number() OVER (
      PARTITION BY candidate.subsidy_id
      ORDER BY candidate.match_rank, candidate.start_date DESC, candidate.position_id
    ) AS row_num
  FROM v_subsidy_responsibility_candidates candidate
) ranked
WHERE ranked.row_num = 1;

CREATE OR REPLACE VIEW v_contract_responsibility
WITH (security_invoker = true) AS
SELECT
  ranked.contract_id,
  ranked.position_id,
  ranked.person_name,
  ranked.politician_id,
  ranked.ministry,
  ranked.position_type,
  ranked.government,
  ranked.political_party,
  ranked.administration_level,
  ranked.territory_name,
  ranked.territory_code,
  ranked.match_method,
  ranked.official_id
FROM (
  SELECT
    candidate.*,
    row_number() OVER (
      PARTITION BY candidate.contract_id
      ORDER BY candidate.match_rank, candidate.start_date DESC, candidate.position_id
    ) AS row_num
  FROM v_contract_responsibility_candidates candidate
) ranked
WHERE ranked.row_num = 1;
