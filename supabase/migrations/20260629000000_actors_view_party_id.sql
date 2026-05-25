-- Expose party_id on the public actors view.
-- party_id was added to corruption_case_actors in 20260625000000 but the
-- view was never updated.  Actors linked to parties (63 of 96 reviewed)
-- showed as plain text with no navigation link on /corrupcion/[id].
-- party_id appended at the end so CREATE OR REPLACE does not disturb
-- the column-position contract that v_entity_summary depends on.

CREATE OR REPLACE VIEW v_corruption_case_actors_public AS
SELECT
  cca.id,
  cca.case_id,
  cc.title AS case_title,
  cc.procedural_status,
  cc.offence_category,
  cc.source_url AS case_source_url,
  cc.last_verified_at,
  cca.actor_type,
  cca.actor_label,
  cca.role,
  cca.politician_id,
  cca.organization_id,
  cca.evidence_url,
  cca.reviewed_at,
  cca.party_id
FROM corruption_case_actors cca
JOIN corruption_cases cc ON cc.id = cca.case_id
WHERE cca.review_status = 'reviewed';

GRANT SELECT ON v_corruption_case_actors_public TO anon, authenticated;
