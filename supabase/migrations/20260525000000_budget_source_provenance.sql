-- Track whether budget rows are directly published for a year or carried
-- forward from the in-force approved budget during a prórroga.

ALTER TABLE budget_lines
  ADD COLUMN IF NOT EXISTS source_kind TEXT NOT NULL DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS source_year INTEGER,
  ADD COLUMN IF NOT EXISTS in_force_year INTEGER;

UPDATE budget_lines
SET
  source_kind = CASE
    WHEN budget_type = 'prorroga' THEN 'published_prorroga'
    ELSE 'published'
  END,
  source_year = COALESCE(source_year, year),
  in_force_year = COALESCE(
    in_force_year,
    CASE WHEN budget_type = 'prorroga' THEN 2023 ELSE year END
  );

ALTER TABLE budget_lines
  DROP CONSTRAINT IF EXISTS budget_lines_source_kind_check;

ALTER TABLE budget_lines
  ADD CONSTRAINT budget_lines_source_kind_check
  CHECK (source_kind IN ('published', 'published_prorroga', 'carried_forward'));

WITH target_years(year, in_force_year) AS (
  VALUES (2024, 2023), (2025, 2023), (2026, 2023)
)
INSERT INTO budget_lines (
  year,
  section_code,
  section_name,
  service_code,
  service_name,
  budget_type,
  source_kind,
  source_year,
  in_force_year,
  program_code,
  program_name,
  economic_chapter,
  economic_article,
  economic_concept,
  credit_initial,
  credit_final,
  ministry_normalized,
  administration_level,
  source_url,
  raw_data,
  updated_at
)
SELECT
  ty.year,
  bl.section_code,
  bl.section_name,
  bl.service_code,
  bl.service_name,
  'prorroga',
  'carried_forward',
  ty.in_force_year,
  ty.in_force_year,
  bl.program_code,
  bl.program_name,
  bl.economic_chapter,
  bl.economic_article,
  bl.economic_concept,
  bl.credit_initial,
  bl.credit_final,
  bl.ministry_normalized,
  bl.administration_level,
  bl.source_url,
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(coalesce(bl.raw_data, '{}'::jsonb), '{source_kind}', '"carried_forward"', true),
        '{source_year}',
        to_jsonb(ty.in_force_year),
        true
      ),
      '{in_force_year}',
      to_jsonb(ty.in_force_year),
      true
    ),
    '{source}',
    to_jsonb('PGE 2023 carried forward for prórroga year ' || ty.year::text),
    true
  ),
  now()
FROM target_years ty
JOIN budget_lines bl
  ON bl.year = ty.in_force_year
  AND bl.budget_type = 'ley'
  AND bl.section_code = '60'
WHERE NOT EXISTS (
  SELECT 1
  FROM budget_lines existing
  WHERE existing.year = ty.year
    AND existing.budget_type = 'prorroga'
    AND existing.section_code = '60'
)
ON CONFLICT (year, budget_type, section_code, program_code, economic_chapter) DO UPDATE SET
  section_name = EXCLUDED.section_name,
  service_code = EXCLUDED.service_code,
  service_name = EXCLUDED.service_name,
  source_kind = EXCLUDED.source_kind,
  source_year = EXCLUDED.source_year,
  in_force_year = EXCLUDED.in_force_year,
  program_name = EXCLUDED.program_name,
  economic_article = EXCLUDED.economic_article,
  economic_concept = EXCLUDED.economic_concept,
  credit_initial = EXCLUDED.credit_initial,
  credit_final = EXCLUDED.credit_final,
  ministry_normalized = EXCLUDED.ministry_normalized,
  source_url = EXCLUDED.source_url,
  raw_data = EXCLUDED.raw_data,
  updated_at = now();

DROP VIEW IF EXISTS v_budget_summary;
CREATE VIEW v_budget_summary AS
SELECT
  year,
  budget_type,
  section_code,
  section_name,
  ministry_normalized,
  COUNT(DISTINCT program_code) AS program_count,
  SUM(credit_initial) AS total_credit_initial,
  SUM(credit_final) AS total_credit_final,
  CASE
    WHEN bool_or(source_kind = 'carried_forward') THEN 'carried_forward'
    WHEN bool_or(source_kind = 'published_prorroga') THEN 'published_prorroga'
    ELSE 'published'
  END AS source_kind,
  MIN(source_year) AS source_year,
  MIN(in_force_year) AS in_force_year
FROM budget_lines
GROUP BY year, budget_type, section_code, section_name, ministry_normalized;

GRANT SELECT ON v_budget_summary TO anon, authenticated;

DROP VIEW IF EXISTS v_budget_by_program;
CREATE VIEW v_budget_by_program AS
SELECT
  year,
  budget_type,
  section_code,
  section_name,
  program_code,
  program_name,
  ministry_normalized,
  SUM(credit_initial) AS total_credit_initial,
  SUM(credit_final) AS total_credit_final,
  CASE
    WHEN bool_or(source_kind = 'carried_forward') THEN 'carried_forward'
    WHEN bool_or(source_kind = 'published_prorroga') THEN 'published_prorroga'
    ELSE 'published'
  END AS source_kind,
  MIN(source_year) AS source_year,
  MIN(in_force_year) AS in_force_year,
  jsonb_object_agg(
    economic_chapter::text,
    jsonb_build_object(
      'initial', credit_initial,
      'final', credit_final
    )
  ) AS by_chapter
FROM budget_lines
GROUP BY year, budget_type, section_code, section_name, program_code, program_name, ministry_normalized;

GRANT SELECT ON v_budget_by_program TO anon, authenticated;

DROP VIEW IF EXISTS v_budget_responsibility;
CREATE VIEW v_budget_responsibility AS
SELECT
  bl.id,
  bl.year,
  bl.budget_type,
  bl.source_kind,
  bl.source_year,
  bl.in_force_year,
  bl.section_code,
  bl.section_name,
  bl.program_code,
  bl.program_name,
  bl.economic_chapter,
  bl.credit_initial,
  bl.credit_final,
  bl.ministry_normalized,
  rp.person_name AS minister_name,
  rp.id AS responsibility_position_id
FROM budget_lines bl
LEFT JOIN responsibility_positions rp
  ON rp.administration_level = 'state'
  AND rp.position_type = 'ministro'
  AND normalize_money_text(rp.organization_name) = normalize_money_text(bl.section_name)
  AND rp.start_date <= make_date(bl.year, 12, 31)
  AND (rp.end_date IS NULL OR rp.end_date >= make_date(bl.year, 1, 1));

GRANT SELECT ON v_budget_responsibility TO anon, authenticated;
