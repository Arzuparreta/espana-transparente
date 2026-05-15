-- View: current Spanish cabinet, with party color and contract spending summary.
-- Filters to the most recent government with active positions (end_date IS NULL).

CREATE OR REPLACE VIEW v_gobierno_actual AS
WITH current_gov AS (
  SELECT government
  FROM responsibility_positions
  WHERE administration_level = 'state'
    AND end_date IS NULL
  GROUP BY government
  ORDER BY MIN(start_date) DESC
  LIMIT 1
),
spending AS (
  SELECT
    lower(ministry_normalized) AS ministry_key,
    COUNT(*) AS contract_count,
    COALESCE(SUM(amount), 0) AS total_amount
  FROM contracts
  WHERE ministry_normalized IS NOT NULL
  GROUP BY lower(ministry_normalized)
)
SELECT
  rp.id,
  rp.position_type,
  rp.person_name,
  rp.organization_name,
  rp.political_party,
  rp.politician_id,
  rp.start_date,
  rp.source_url,
  rp.government,
  par.color AS party_color,
  COALESCE(sp.contract_count, 0) AS contract_count,
  COALESCE(sp.total_amount, 0) AS total_amount_eur
FROM responsibility_positions rp
JOIN current_gov cg ON rp.government = cg.government
LEFT JOIN parties par ON lower(par.acronym) = lower(rp.political_party)
LEFT JOIN spending sp ON sp.ministry_key = lower(rp.organization_name)
WHERE rp.end_date IS NULL
  AND rp.administration_level = 'state'
ORDER BY
  CASE rp.position_type
    WHEN 'presidente_gobierno' THEN 0
    WHEN 'vicepresidente' THEN 1
    ELSE 2
  END,
  rp.organization_name;

GRANT SELECT ON v_gobierno_actual TO anon, authenticated;
