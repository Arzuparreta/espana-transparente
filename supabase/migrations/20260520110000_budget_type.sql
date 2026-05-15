-- Add budget_type to budget_lines so we can distinguish approved laws,
-- prórrogas, and non-approved budget projects for the same fiscal year.

ALTER TABLE budget_lines
  ADD COLUMN IF NOT EXISTS budget_type TEXT NOT NULL DEFAULT 'ley';

-- Existing 2019 data comes from the 2019P project in Civio.
UPDATE budget_lines
SET budget_type = 'proyecto'
WHERE year = 2019 AND budget_type = 'ley';

-- If prórroga rows were ingested before this migration existed, classify them.
UPDATE budget_lines
SET budget_type = 'prorroga'
WHERE year IN (2024, 2025) AND budget_type = 'ley';

ALTER TABLE budget_lines
  DROP CONSTRAINT IF EXISTS uq_budget_lines;

ALTER TABLE budget_lines
  ADD CONSTRAINT uq_budget_lines
  UNIQUE (year, budget_type, section_code, program_code, economic_chapter);

CREATE INDEX IF NOT EXISTS idx_budget_lines_year_type
  ON budget_lines (year, budget_type);

CREATE INDEX IF NOT EXISTS idx_budget_lines_section_type
  ON budget_lines (year, budget_type, section_code);

DROP VIEW IF EXISTS v_budget_summary;
CREATE VIEW v_budget_summary AS
SELECT
  year,
  budget_type,
  section_code,
  section_name,
  ministry_normalized,
  COUNT(DISTINCT program_code) AS program_count,
  SUM(credit_initial)          AS total_credit_initial,
  SUM(credit_final)            AS total_credit_final
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
  SUM(credit_final)   AS total_credit_final,
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
  bl.section_code,
  bl.section_name,
  bl.program_code,
  bl.program_name,
  bl.economic_chapter,
  bl.credit_initial,
  bl.credit_final,
  bl.ministry_normalized,
  rp.person_name AS minister_name,
  rp.id          AS responsibility_position_id
FROM budget_lines bl
LEFT JOIN responsibility_positions rp
  ON rp.administration_level = 'state'
  AND rp.position_type = 'ministro'
  AND normalize_money_text(rp.organization_name) = normalize_money_text(bl.section_name)
  AND rp.start_date <= make_date(bl.year, 12, 31)
  AND (rp.end_date IS NULL OR rp.end_date >= make_date(bl.year, 1, 1));

GRANT SELECT ON v_budget_responsibility TO anon, authenticated;
