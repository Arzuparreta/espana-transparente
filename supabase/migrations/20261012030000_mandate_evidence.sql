-- Prefer the documented award date; publication date is a labelled fallback.
CREATE OR REPLACE VIEW v_contract_resolution_base WITH (security_invoker=true) AS
SELECT c.id AS record_id, coalesce(c.award_date,c.date) AS record_date,
 c.title AS display_title,c.source_url,c.awarding_body AS body_name,
 c.awarding_body_normalized AS body_normalized,c.ministry_normalized AS direct_department_normalized,
 c.administration_level,
 CASE WHEN c.awarding_body_normalized LIKE 'AYUNTAMIENTO DE %'
 THEN trim(replace(c.awarding_body_normalized,'AYUNTAMIENTO DE ','')) ELSE NULL END AS inferred_territory_name
FROM contracts c;

-- Context enriches an institutional match; never invents a personal signature.
CREATE VIEW v_contract_mandate_context WITH (security_invoker=true) AS
SELECT r.*, p.start_date,p.end_date,p.source_url AS mandate_source_url,
 coalesce(c.award_date,c.date) AS relation_date,
 CASE WHEN c.award_date IS NOT NULL THEN 'award_date' ELSE 'publication_date' END AS date_basis,
 (SELECT count(DISTINCT candidate.position_id)::integer FROM v_contract_responsibility_candidates candidate WHERE candidate.contract_id=r.contract_id) AS candidate_count
FROM v_contract_responsibility r
JOIN responsibility_positions p ON p.id=r.position_id
JOIN contracts c ON c.id=r.contract_id;
CREATE VIEW v_subsidy_mandate_context WITH (security_invoker=true) AS
SELECT r.*,p.start_date,p.end_date,p.source_url AS mandate_source_url,
 s.fecha_concesion AS relation_date,'grant_date'::text AS date_basis,
 (SELECT count(DISTINCT candidate.position_id)::integer FROM v_subsidy_responsibility_candidates candidate WHERE candidate.subsidy_id=r.subsidy_id) AS candidate_count
FROM v_subsidy_responsibility r
JOIN responsibility_positions p ON p.id=r.position_id
JOIN subsidies s ON s.id=r.subsidy_id;
GRANT SELECT ON v_contract_responsibility_candidates,v_subsidy_responsibility_candidates,
 v_contract_mandate_context,v_subsidy_mandate_context TO anon,authenticated;

-- Direct departmental matches in a mandate, preserving record and position IDs.
CREATE VIEW v_mandate_contracts WITH (security_invoker=true) AS
SELECT c.id,c.title,c.amount,c.date,c.awarding_body,c.contractor,c.contractor_nif,
 c.contractor_is_sme,c.contractor_is_ute,c.award_amount,c.award_amount_with_taxes,
 c.award_date,c.contract_number,c.received_tender_quantity,c.currency,
 p.id AS position_id,coalesce(c.award_date,c.date) AS relation_date
FROM responsibility_positions p JOIN contracts c
 ON c.ministry_normalized=normalize_money_text(p.organization_name)
 AND coalesce(c.award_date,c.date) BETWEEN p.start_date AND coalesce(p.end_date,current_date)
WHERE p.administration_level='state';
GRANT SELECT ON v_mandate_contracts TO anon,authenticated;

CREATE OR REPLACE VIEW v_gobierno_actual AS
WITH current_gov AS (
 SELECT government FROM responsibility_positions
 WHERE administration_level='state' AND end_date IS NULL AND start_date<=current_date
 GROUP BY government ORDER BY MIN(start_date) DESC LIMIT 1
), spending AS (
 SELECT position_id,COUNT(*) AS contract_count,
 coalesce(SUM(amount) FILTER (WHERE currency='EUR'),0) AS total_amount,
 COUNT(*) FILTER (WHERE currency IS DISTINCT FROM 'EUR' OR amount IS NULL) AS excluded_amount_count
 FROM v_mandate_contracts GROUP BY position_id
)
SELECT p.id,p.position_type,p.person_name,p.organization_name,p.political_party,p.politician_id,
 p.start_date,p.source_url,p.government,par.color AS party_color,
 coalesce(sp.contract_count,0) AS contract_count,coalesce(sp.total_amount,0) AS total_amount_eur,
 p.official_id,p.end_date,coalesce(sp.excluded_amount_count,0) AS excluded_amount_count
FROM responsibility_positions p JOIN current_gov cg ON cg.government=p.government
LEFT JOIN LATERAL (SELECT color FROM parties WHERE lower(acronym)=lower(p.political_party) LIMIT 1) par ON true
LEFT JOIN spending sp ON sp.position_id=p.id
WHERE p.end_date IS NULL AND p.start_date<=current_date AND p.administration_level='state'
ORDER BY CASE p.position_type WHEN 'presidente_gobierno' THEN 0 WHEN 'vicepresidente' THEN 1 ELSE 2 END,p.organization_name;
GRANT SELECT ON v_gobierno_actual TO anon,authenticated;
