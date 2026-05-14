-- Views joining grants/contracts to the politically responsible person
-- via government_positions.organization_name + date range.

CREATE OR REPLACE VIEW v_subsidy_responsibility
WITH (security_invoker = true) AS
SELECT
  s.id            AS subsidy_id,
  gp.id           AS position_id,
  gp.person_name,
  gp.politician_id,
  gp.organization_name AS ministry,
  gp.position_type,
  gp.government,
  gp.political_party
FROM subsidies s
JOIN government_positions gp
  ON gp.organization_name = upper(unaccent(s.ministry_normalized))
 AND s.fecha_concesion BETWEEN gp.start_date AND COALESCE(gp.end_date, current_date)
WHERE s.ministry_normalized IS NOT NULL;

CREATE OR REPLACE VIEW v_contract_responsibility
WITH (security_invoker = true) AS
SELECT
  c.id            AS contract_id,
  gp.id           AS position_id,
  gp.person_name,
  gp.politician_id,
  gp.organization_name AS ministry,
  gp.position_type,
  gp.government,
  gp.political_party
FROM contracts c
JOIN government_positions gp
  ON gp.organization_name = upper(unaccent(c.ministry_normalized))
 AND c.date BETWEEN gp.start_date AND COALESCE(gp.end_date, current_date)
WHERE c.ministry_normalized IS NOT NULL;
