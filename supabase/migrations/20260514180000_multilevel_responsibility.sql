CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION normalize_money_text(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(
    trim(
      regexp_replace(
        upper(unaccent(coalesce(input, ''))),
        '\s+',
        ' ',
        'g'
      )
    ),
    ''
  )
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'government_positions'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.views
    WHERE table_schema = 'public'
      AND table_name = 'government_positions'
  ) THEN
    ALTER TABLE public.government_positions RENAME TO government_positions_legacy;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS responsibility_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  administration_level text NOT NULL CHECK (administration_level IN ('state', 'autonomic', 'municipal')),
  position_type text NOT NULL CHECK (
    position_type IN (
      'presidente_gobierno',
      'vicepresidente',
      'ministro',
      'presidente_autonomico',
      'consejero',
      'alcalde'
    )
  ),
  territory_name text,
  territory_code text,
  organization_name text NOT NULL,
  organization_aliases text[] DEFAULT '{}',
  person_name text NOT NULL,
  politician_id uuid REFERENCES politicians(id) ON DELETE SET NULL,
  political_party text,
  government text,
  start_date date NOT NULL,
  end_date date,
  source_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE responsibility_positions
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_responsibility_positions_level_org
  ON responsibility_positions (administration_level, organization_name);
CREATE INDEX IF NOT EXISTS idx_responsibility_positions_dates
  ON responsibility_positions (start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_responsibility_positions_territory
  ON responsibility_positions (territory_code, territory_name);
CREATE INDEX IF NOT EXISTS idx_responsibility_positions_politician
  ON responsibility_positions (politician_id);
CREATE UNIQUE INDEX IF NOT EXISTS responsibility_positions_identity_idx
  ON responsibility_positions (
    administration_level,
    position_type,
    coalesce(territory_code, ''),
    organization_name,
    person_name,
    start_date
  );

INSERT INTO responsibility_positions (
  administration_level,
  position_type,
  territory_name,
  territory_code,
  organization_name,
  organization_aliases,
  person_name,
  politician_id,
  political_party,
  government,
  start_date,
  end_date,
  source_url,
  created_at,
  updated_at
)
SELECT
  'state',
  legacy.position_type,
  'España',
  'ES',
  legacy.organization_name,
  coalesce(legacy.organization_aliases, '{}'::text[]),
  legacy.person_name,
  legacy.politician_id,
  legacy.political_party,
  legacy.government,
  legacy.start_date,
  legacy.end_date,
  legacy.source_url,
  coalesce(legacy.created_at, now()),
  now()
FROM government_positions_legacy legacy
ON CONFLICT DO NOTHING;

CREATE OR REPLACE VIEW government_positions AS
SELECT
  rp.id,
  rp.position_type,
  rp.organization_name,
  rp.organization_aliases,
  rp.person_name,
  rp.politician_id,
  rp.political_party,
  rp.government,
  rp.start_date,
  rp.end_date,
  rp.source_url,
  rp.created_at
FROM responsibility_positions rp
WHERE rp.administration_level = 'state';

CREATE TABLE IF NOT EXISTS public_body_responsibility_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  body_normalized text NOT NULL,
  administration_level text NOT NULL CHECK (administration_level IN ('state', 'autonomic', 'municipal')),
  territory_name text,
  territory_code text,
  ministry_or_department_normalized text NOT NULL,
  match_strategy text NOT NULL,
  start_date date NOT NULL DEFAULT DATE '2016-01-01',
  end_date date,
  source_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_public_body_map_body
  ON public_body_responsibility_map (body_normalized, administration_level);
CREATE UNIQUE INDEX IF NOT EXISTS public_body_responsibility_map_identity_idx
  ON public_body_responsibility_map (
    body_normalized,
    administration_level,
    coalesce(territory_code, ''),
    ministry_or_department_normalized,
    start_date
  );

CREATE TABLE IF NOT EXISTS etl_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline text NOT NULL,
  chunk_key text,
  window_start date,
  window_end date,
  status text NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
  rows_read integer NOT NULL DEFAULT 0,
  rows_inserted integer NOT NULL DEFAULT 0,
  rows_updated integer NOT NULL DEFAULT 0,
  error_summary text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_etl_runs_pipeline_window
  ON etl_runs (pipeline, window_start, window_end, status);

ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS awarding_body_normalized text,
  ADD COLUMN IF NOT EXISTS administration_level text CHECK (administration_level IN ('state', 'autonomic', 'municipal'));

ALTER TABLE subsidies
  ADD COLUMN IF NOT EXISTS ministry_normalized text,
  ADD COLUMN IF NOT EXISTS granting_body_normalized text,
  ADD COLUMN IF NOT EXISTS beneficiary_normalized text,
  ADD COLUMN IF NOT EXISTS administration_level text CHECK (administration_level IN ('state', 'autonomic', 'municipal'));

UPDATE contracts
SET
  awarding_body_normalized = coalesce(awarding_body_normalized, normalize_money_text(awarding_body)),
  administration_level = coalesce(
    administration_level,
    CASE
      WHEN ministry_normalized IS NOT NULL THEN 'state'
      WHEN normalize_money_text(awarding_body) LIKE 'AYUNTAMIENTO DE %' THEN 'municipal'
      WHEN normalize_money_text(awarding_body) LIKE '% AYUNTAMIENTO DE %' THEN 'municipal'
      WHEN normalize_money_text(awarding_body) LIKE 'CONSEJERIA %' THEN 'autonomic'
      WHEN normalize_money_text(awarding_body) LIKE 'JUNTA DE %' THEN 'autonomic'
      WHEN normalize_money_text(awarding_body) LIKE 'GOBIERNO DE %' THEN 'autonomic'
      WHEN normalize_money_text(awarding_body) LIKE 'GENERALITAT %' THEN 'autonomic'
      WHEN normalize_money_text(awarding_body) LIKE 'XUNTA DE %' THEN 'autonomic'
      ELSE NULL
    END
  );

UPDATE subsidies
SET
  granting_body_normalized = coalesce(granting_body_normalized, normalize_money_text(nivel3)),
  beneficiary_normalized = coalesce(beneficiary_normalized, normalize_money_text(beneficiario)),
  administration_level = coalesce(
    administration_level,
    CASE nivel1
      WHEN 'ESTADO' THEN 'state'
      WHEN 'AUTONOMICA' THEN 'autonomic'
      WHEN 'LOCAL' THEN 'municipal'
      ELSE NULL
    END
  );

CREATE INDEX IF NOT EXISTS idx_contracts_body_normalized
  ON contracts (awarding_body_normalized);
CREATE INDEX IF NOT EXISTS idx_contracts_administration_level
  ON contracts (administration_level);
CREATE INDEX IF NOT EXISTS idx_subsidies_granting_body_normalized
  ON subsidies (granting_body_normalized);
CREATE INDEX IF NOT EXISTS idx_subsidies_beneficiary_normalized
  ON subsidies (beneficiary_normalized);
CREATE INDEX IF NOT EXISTS idx_subsidies_administration_level
  ON subsidies (administration_level);

ALTER TABLE responsibility_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_body_responsibility_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE etl_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "responsibility_positions_public_read" ON responsibility_positions;
CREATE POLICY "responsibility_positions_public_read"
  ON responsibility_positions FOR SELECT USING (true);

DROP POLICY IF EXISTS "public_body_responsibility_map_public_read" ON public_body_responsibility_map;
CREATE POLICY "public_body_responsibility_map_public_read"
  ON public_body_responsibility_map FOR SELECT USING (true);

DROP VIEW IF EXISTS v_government_position_lookup CASCADE;
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
  normalize_money_text(name_entry.lookup_name) AS lookup_name
FROM responsibility_positions rp
CROSS JOIN LATERAL (
  SELECT rp.organization_name AS lookup_name
  UNION
  SELECT alias
  FROM unnest(coalesce(rp.organization_aliases, '{}'::text[])) AS alias
) AS name_entry;

CREATE OR REPLACE VIEW v_contract_resolution_base
WITH (security_invoker = true) AS
SELECT
  c.id AS record_id,
  c.date AS record_date,
  c.title AS display_title,
  c.source_url,
  c.awarding_body AS body_name,
  c.awarding_body_normalized AS body_normalized,
  c.ministry_normalized AS direct_department_normalized,
  c.administration_level,
  CASE
    WHEN c.awarding_body_normalized LIKE 'AYUNTAMIENTO DE %'
      THEN trim(replace(c.awarding_body_normalized, 'AYUNTAMIENTO DE ', ''))
    ELSE NULL
  END AS inferred_territory_name
FROM contracts c;

CREATE OR REPLACE VIEW v_subsidy_resolution_base
WITH (security_invoker = true) AS
SELECT
  s.id AS record_id,
  s.fecha_concesion AS record_date,
  s.beneficiario AS display_title,
  s.source_url,
  coalesce(s.nivel3, s.nivel2) AS body_name,
  coalesce(s.granting_body_normalized, normalize_money_text(s.nivel3)) AS body_normalized,
  s.ministry_normalized AS direct_department_normalized,
  s.administration_level,
  normalize_money_text(
    CASE
      WHEN s.administration_level = 'municipal' THEN s.nivel2
      ELSE NULL
    END
  ) AS inferred_territory_name
FROM subsidies s;

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
  0 AS match_rank
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
  1 AS match_rank
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
  2 AS match_rank
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
  3 AS match_rank
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
  0 AS match_rank
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
  1 AS match_rank
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
  2 AS match_rank
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
  3 AS match_rank
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
  ranked.match_method
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
  ranked.match_method
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

CREATE OR REPLACE VIEW v_subsidy_responsibility_conflicts
WITH (security_invoker = true) AS
SELECT
  subsidy_id,
  count(*)::integer AS candidate_count,
  array_agg(person_name ORDER BY match_rank, start_date DESC, position_id) AS candidate_people,
  array_agg(match_method ORDER BY match_rank, start_date DESC, position_id) AS candidate_methods
FROM v_subsidy_responsibility_candidates
GROUP BY subsidy_id
HAVING count(*) > 1;

CREATE OR REPLACE VIEW v_contract_responsibility_conflicts
WITH (security_invoker = true) AS
SELECT
  contract_id,
  count(*)::integer AS candidate_count,
  array_agg(person_name ORDER BY match_rank, start_date DESC, position_id) AS candidate_people,
  array_agg(match_method ORDER BY match_rank, start_date DESC, position_id) AS candidate_methods
FROM v_contract_responsibility_candidates
GROUP BY contract_id
HAVING count(*) > 1;

CREATE OR REPLACE VIEW v_money_data_internal
WITH (security_invoker = true) AS
SELECT
  'contracts'::text AS dataset,
  base.record_id,
  base.record_date,
  base.display_title,
  base.source_url,
  base.body_name,
  base.body_normalized,
  base.direct_department_normalized,
  base.administration_level,
  cr.person_name,
  cr.politician_id,
  cr.ministry,
  cr.position_type,
  cr.government,
  cr.political_party,
  cr.territory_name,
  cr.territory_code,
  cr.match_method,
  (cc.contract_id IS NOT NULL) AS has_conflict
FROM v_contract_resolution_base base
LEFT JOIN v_contract_responsibility cr ON cr.contract_id = base.record_id
LEFT JOIN v_contract_responsibility_conflicts cc ON cc.contract_id = base.record_id
UNION ALL
SELECT
  'subsidies'::text AS dataset,
  base.record_id,
  base.record_date,
  base.display_title,
  base.source_url,
  base.body_name,
  base.body_normalized,
  base.direct_department_normalized,
  base.administration_level,
  sr.person_name,
  sr.politician_id,
  sr.ministry,
  sr.position_type,
  sr.government,
  sr.political_party,
  sr.territory_name,
  sr.territory_code,
  sr.match_method,
  (sc.subsidy_id IS NOT NULL) AS has_conflict
FROM v_subsidy_resolution_base base
LEFT JOIN v_subsidy_responsibility sr ON sr.subsidy_id = base.record_id
LEFT JOIN v_subsidy_responsibility_conflicts sc ON sc.subsidy_id = base.record_id;

CREATE OR REPLACE VIEW v_money_data_public
WITH (security_invoker = true) AS
SELECT
  dataset,
  coalesce(administration_level, 'sin_clasificar') AS administration_level,
  count(*)::integer AS total_rows,
  count(*) FILTER (WHERE person_name IS NOT NULL)::integer AS resolved_rows,
  count(*) FILTER (WHERE person_name IS NULL)::integer AS unresolved_rows,
  count(*) FILTER (WHERE has_conflict)::integer AS conflict_rows,
  min(record_date) AS coverage_start_date,
  max(record_date) AS latest_record_date,
  CASE
    WHEN max(record_date) >= current_date - interval '7 days' THEN '7d'
    WHEN max(record_date) >= current_date - interval '30 days' THEN '30d'
    WHEN max(record_date) >= current_date - interval '90 days' THEN '90d'
    ELSE '90d+'
  END AS freshness_window
FROM v_money_data_internal
GROUP BY dataset, coalesce(administration_level, 'sin_clasificar');

CREATE OR REPLACE VIEW v_unresolved_money_examples
WITH (security_invoker = true) AS
SELECT
  dataset,
  record_id,
  record_date,
  body_name,
  body_normalized,
  administration_level,
  display_title,
  source_url,
  CASE
    WHEN has_conflict THEN 'conflict'
    ELSE 'unresolved'
  END AS issue_type
FROM v_money_data_internal
WHERE person_name IS NULL OR has_conflict;

CREATE OR REPLACE VIEW v_responsibility_coverage
WITH (security_invoker = true) AS
SELECT
  dataset,
  administration_level,
  freshness_window,
  total_rows,
  resolved_rows,
  unresolved_rows,
  conflict_rows,
  coverage_start_date,
  latest_record_date,
  CASE
    WHEN total_rows = 0 THEN 0
    ELSE round((resolved_rows::numeric / total_rows::numeric) * 100, 2)
  END AS resolved_pct
FROM v_money_data_public;

CREATE OR REPLACE VIEW v_money_resolution_conflicts
WITH (security_invoker = true) AS
SELECT
  dataset,
  record_id,
  body_name,
  administration_level,
  record_date
FROM v_unresolved_money_examples
WHERE issue_type = 'conflict';

CREATE OR REPLACE VIEW v_unresolved_money_bodies
WITH (security_invoker = true) AS
SELECT
  dataset,
  coalesce(administration_level, 'sin_clasificar') AS administration_level,
  body_normalized,
  count(*)::integer AS row_count
FROM v_money_data_internal
WHERE person_name IS NULL
GROUP BY dataset, coalesce(administration_level, 'sin_clasificar'), body_normalized
ORDER BY row_count DESC, body_normalized;

CREATE OR REPLACE VIEW v_missing_responsibility_aliases
WITH (security_invoker = true) AS
SELECT
  dataset,
  body_normalized,
  count(*)::integer AS row_count
FROM v_money_data_internal
WHERE person_name IS NULL
  AND body_normalized IS NOT NULL
  AND direct_department_normalized IS NULL
GROUP BY dataset, body_normalized
ORDER BY row_count DESC, body_normalized;

CREATE OR REPLACE VIEW v_money_backfill_coverage
WITH (security_invoker = true) AS
SELECT
  dataset,
  date_trunc('month', record_date)::date AS month,
  count(*)::integer AS total_rows,
  count(*) FILTER (WHERE person_name IS NOT NULL)::integer AS resolved_rows
FROM v_money_data_internal
WHERE record_date IS NOT NULL
GROUP BY dataset, date_trunc('month', record_date)::date
ORDER BY dataset, month DESC;

CREATE OR REPLACE VIEW v_organization_public AS
SELECT
  o.id,
  o.name,
  o.organization_type,
  o.sector,
  o.country,
  o.source_url,
  count(DISTINCT c.id)::integer AS contract_count,
  count(DISTINCT sb.id)::integer AS subsidy_beneficiary_count,
  count(DISTINCT sg.id)::integer AS subsidy_granting_count,
  count(DISTINCT rd.id)::integer AS revolving_door_count
FROM organizations o
LEFT JOIN contracts c ON c.awarding_body_organization_id = o.id
LEFT JOIN subsidies sb ON sb.beneficiary_organization_id = o.id
LEFT JOIN subsidies sg ON sg.granting_body_organization_id = o.id
LEFT JOIN revolving_door rd ON rd.organization_id = o.id AND rd.verification_status = 'verified'
GROUP BY o.id;

GRANT SELECT ON responsibility_positions TO anon, authenticated;
GRANT SELECT ON public_body_responsibility_map TO anon, authenticated;
GRANT SELECT ON government_positions TO anon, authenticated;
GRANT SELECT ON v_responsibility_position_lookup TO anon, authenticated;
GRANT SELECT ON v_contract_responsibility_candidates TO authenticated;
GRANT SELECT ON v_subsidy_responsibility_candidates TO authenticated;
GRANT SELECT ON v_contract_responsibility TO anon, authenticated;
GRANT SELECT ON v_subsidy_responsibility TO anon, authenticated;
GRANT SELECT ON v_contract_responsibility_conflicts TO authenticated;
GRANT SELECT ON v_subsidy_responsibility_conflicts TO authenticated;
GRANT SELECT ON v_money_data_internal TO authenticated;
GRANT SELECT ON v_money_data_public TO anon, authenticated;
GRANT SELECT ON v_unresolved_money_examples TO anon, authenticated;
GRANT SELECT ON v_responsibility_coverage TO anon, authenticated;
GRANT SELECT ON v_money_resolution_conflicts TO authenticated;
GRANT SELECT ON v_unresolved_money_bodies TO authenticated;
GRANT SELECT ON v_missing_responsibility_aliases TO authenticated;
GRANT SELECT ON v_money_backfill_coverage TO authenticated;
GRANT SELECT ON v_organization_public TO anon, authenticated;
