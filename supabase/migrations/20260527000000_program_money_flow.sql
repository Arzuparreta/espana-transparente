-- Phase 4 (Trazabilidad del gasto): aggregate budget programs with the
-- downstream contracts and subsidies that share a normalized ministry. The
-- join is intentionally at ministry-section level — contracts and subsidies
-- do not carry program_code today, so per-program downstream counts will be
-- 0 until the upstream pipelines start populating that link. Empty downstream
-- nodes render as "Sin datos" in the UI.
--
-- EU funds (eu_funds) is keyed by beneficiary, not ministry, so it is not
-- joined here. Once a ministry → fund link is published in Kohesio metadata,
-- this view will be extended.

CREATE OR REPLACE VIEW v_program_money_flow AS
WITH contracts_by_ministry AS (
  SELECT
    ministry_normalized,
    COUNT(*)::bigint           AS contract_count,
    COALESCE(SUM(amount), 0)   AS contract_total,
    MAX(date)                  AS latest_contract_date
  FROM contracts
  WHERE ministry_normalized IS NOT NULL
  GROUP BY ministry_normalized
),
subsidies_by_ministry AS (
  SELECT
    ministry_normalized,
    COUNT(*)::bigint                AS subsidy_count,
    COALESCE(SUM(importe), 0)       AS subsidy_total,
    MAX(fecha_concesion)            AS latest_subsidy_date
  FROM subsidies
  WHERE ministry_normalized IS NOT NULL
  GROUP BY ministry_normalized
),
minister_by_section AS (
  SELECT DISTINCT ON (year, section_code)
    year,
    section_code,
    minister_name,
    responsibility_position_id AS minister_person_id
  FROM v_budget_responsibility
  WHERE minister_name IS NOT NULL
  ORDER BY year, section_code, minister_name
)
SELECT
  p.year,
  p.budget_type,
  p.section_code,
  p.section_name,
  p.ministry_normalized,
  m.minister_person_id,
  m.minister_name,
  p.program_code,
  p.program_name,
  p.total_credit_initial,
  COALESCE(c.contract_count, 0)::bigint  AS contract_count,
  COALESCE(c.contract_total, 0)          AS contract_total,
  COALESCE(s.subsidy_count, 0)::bigint   AS subsidy_count,
  COALESCE(s.subsidy_total, 0)           AS subsidy_total,
  GREATEST(c.latest_contract_date, s.latest_subsidy_date) AS latest_record_date
FROM v_budget_by_program p
LEFT JOIN contracts_by_ministry  c ON c.ministry_normalized = p.ministry_normalized
LEFT JOIN subsidies_by_ministry  s ON s.ministry_normalized = p.ministry_normalized
LEFT JOIN minister_by_section    m ON m.year = p.year AND m.section_code = p.section_code;

GRANT SELECT ON v_program_money_flow TO anon, authenticated;
