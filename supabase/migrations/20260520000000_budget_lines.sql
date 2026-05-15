-- Presupuestos Generales del Estado
-- Source: SEPG (Secretaría de Estado de Presupuestos y Gastos) / datos.gob.es
-- Hierarchy: Sección (ministry) → Programa → Partida económica (Capítulo)
-- Phase 1: dotación aprobada only (credit_initial / credit_final); no liquidación yet

CREATE TABLE budget_lines (
  id                   uuid         PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Presupuestary hierarchy
  year                 integer      NOT NULL,
  section_code         text         NOT NULL,   -- e.g. "06"
  section_name         text,                    -- e.g. "Ministerio de Hacienda"
  service_code         text,                    -- subdivision within section
  service_name         text,
  program_code         text         NOT NULL,   -- e.g. "134A"
  program_name         text,

  -- Economic classification
  economic_chapter     integer      NOT NULL,   -- 1-9
  economic_article     text,                    -- 2-digit article, optional
  economic_concept     text,                    -- 3-digit concept, optional

  -- Approved appropriation (dotación)
  credit_initial       numeric(18,2),           -- crédito inicial
  credit_final         numeric(18,2),           -- crédito definitivo (after amendments)

  -- Traceability
  ministry_normalized  text,                    -- for joining with responsibility_positions
  administration_level text         NOT NULL DEFAULT 'state',

  source_url           text,
  raw_data             jsonb        NOT NULL DEFAULT '{}',
  created_at           timestamptz  NOT NULL DEFAULT now(),
  updated_at           timestamptz  NOT NULL DEFAULT now()
);

-- Deterministic upsert key: one row per year + section + program + chapter
ALTER TABLE budget_lines
  ADD CONSTRAINT uq_budget_lines
  UNIQUE (year, section_code, program_code, economic_chapter);

CREATE INDEX idx_budget_lines_year        ON budget_lines (year);
CREATE INDEX idx_budget_lines_section     ON budget_lines (year, section_code);
CREATE INDEX idx_budget_lines_program     ON budget_lines (year, program_code);
CREATE INDEX idx_budget_lines_ministry    ON budget_lines (ministry_normalized);

ALTER TABLE budget_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "budget_lines_public_read" ON budget_lines FOR SELECT USING (true);
GRANT SELECT ON budget_lines TO anon, authenticated;

-- ─── Views ───────────────────────────────────────────────────────────────────

-- Summary per ministry+year (used by the main /presupuestos list page)
CREATE VIEW v_budget_summary AS
SELECT
  year,
  section_code,
  section_name,
  ministry_normalized,
  COUNT(DISTINCT program_code)  AS program_count,
  SUM(credit_initial)           AS total_credit_initial,
  SUM(credit_final)             AS total_credit_final
FROM budget_lines
GROUP BY year, section_code, section_name, ministry_normalized;

GRANT SELECT ON v_budget_summary TO anon, authenticated;

-- Program breakdown per section+year (used by /presupuestos/[section] detail page)
CREATE VIEW v_budget_by_program AS
SELECT
  year,
  section_code,
  section_name,
  program_code,
  program_name,
  ministry_normalized,
  SUM(credit_initial)                           AS total_credit_initial,
  SUM(credit_final)                             AS total_credit_final,
  jsonb_object_agg(
    economic_chapter::text,
    jsonb_build_object(
      'initial', credit_initial,
      'final',   credit_final
    )
  )                                             AS by_chapter
FROM budget_lines
GROUP BY year, section_code, section_name, program_code, program_name, ministry_normalized;

GRANT SELECT ON v_budget_by_program TO anon, authenticated;

-- Budget lines joined to the minister responsible during that year
-- Join is approximate: matched by organisation name normalisation.
-- Will improve as responsibility_positions data matures.
CREATE VIEW v_budget_responsibility AS
SELECT
  bl.id,
  bl.year,
  bl.section_code,
  bl.section_name,
  bl.program_code,
  bl.program_name,
  bl.economic_chapter,
  bl.credit_initial,
  bl.credit_final,
  bl.ministry_normalized,
  rp.person_name            AS minister_name,
  rp.id                     AS responsibility_position_id
FROM budget_lines bl
LEFT JOIN responsibility_positions rp
  ON rp.administration_level = 'state'
  AND rp.position_type       = 'ministro'
  AND normalize_money_text(rp.organization_name) = normalize_money_text(bl.section_name)
  AND rp.start_date          <= make_date(bl.year, 12, 31)
  AND (rp.end_date IS NULL OR rp.end_date >= make_date(bl.year, 1, 1));

GRANT SELECT ON v_budget_responsibility TO anon, authenticated;
