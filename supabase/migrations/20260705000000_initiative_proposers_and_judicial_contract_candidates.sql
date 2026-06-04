-- Link legislative initiatives to their official proposer labels and, when
-- possible, to normalized people, parties, or organizations.

CREATE TABLE IF NOT EXISTS initiative_proposers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  initiative_id uuid NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE,
  proposer_label text NOT NULL,
  proposer_role text NOT NULL DEFAULT 'proponente' CHECK (
    proposer_role IN ('proponente', 'firmante', 'grupo_proponente', 'organismo_proponente')
  ),
  politician_id uuid REFERENCES politicians(id) ON DELETE SET NULL,
  party_id uuid REFERENCES parties(id) ON DELETE SET NULL,
  organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  source_url text,
  match_confidence numeric(3,2),
  match_method text,
  raw_data jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS initiative_proposers_unique_label_idx
  ON initiative_proposers (initiative_id, proposer_label, proposer_role);

CREATE INDEX IF NOT EXISTS initiative_proposers_initiative_idx
  ON initiative_proposers (initiative_id);

CREATE INDEX IF NOT EXISTS initiative_proposers_politician_idx
  ON initiative_proposers (politician_id)
  WHERE politician_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS initiative_proposers_party_idx
  ON initiative_proposers (party_id)
  WHERE party_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS initiative_proposers_organization_idx
  ON initiative_proposers (organization_id)
  WHERE organization_id IS NOT NULL;

ALTER TABLE initiative_proposers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read initiative proposers" ON initiative_proposers;
CREATE POLICY "Public read initiative proposers"
  ON initiative_proposers FOR SELECT USING (true);

GRANT SELECT ON initiative_proposers TO anon, authenticated;

CREATE OR REPLACE VIEW v_initiative_proposers_public AS
SELECT
  ip.id,
  ip.initiative_id,
  i.number AS initiative_number,
  i.title AS initiative_title,
  ip.proposer_label,
  ip.proposer_role,
  ip.politician_id,
  p.full_name AS politician_name,
  ip.party_id,
  pa.name AS party_name,
  pa.acronym AS party_acronym,
  ip.organization_id,
  o.name AS organization_name,
  ip.source_url,
  ip.match_confidence,
  ip.match_method
FROM initiative_proposers ip
JOIN initiatives i ON i.id = ip.initiative_id
LEFT JOIN politicians p ON p.id = ip.politician_id
LEFT JOIN parties pa ON pa.id = ip.party_id
LEFT JOIN organizations o ON o.id = ip.organization_id;

GRANT SELECT ON v_initiative_proposers_public TO anon, authenticated;

-- Automatic judicial-to-contract matching writes candidates into the existing
-- review-gated link table. Public views still expose only rows reviewed by a
-- human reviewer, and only when the linked actor is also reviewed.

CREATE UNIQUE INDEX IF NOT EXISTS corruption_contract_links_case_contract_unique_idx
  ON corruption_contract_links (case_id, contract_id)
  WHERE contract_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS corruption_contract_links_case_org_only_unique_idx
  ON corruption_contract_links (case_id, organization_id)
  WHERE contract_id IS NULL
    AND subsidy_id IS NULL
    AND organization_id IS NOT NULL;

CREATE OR REPLACE VIEW v_corruption_contract_links_public AS
SELECT
  ccl.id,
  ccl.case_id,
  cc.title AS case_title,
  cc.procedural_status,
  cc.offence_category,
  cc.source_url AS case_source_url,
  cc.last_verified_at,
  ccl.case_actor_id,
  cca.actor_label,
  ccl.organization_id,
  ccl.contract_id,
  ccl.subsidy_id,
  ccl.link_reason,
  ccl.evidence_url,
  ccl.reviewed_at,
  c.title AS contract_title,
  COALESCE(c.award_amount, c.amount) AS contract_amount,
  c.contractor AS contract_contractor
FROM corruption_contract_links ccl
JOIN corruption_cases cc ON cc.id = ccl.case_id
LEFT JOIN corruption_case_actors cca ON cca.id = ccl.case_actor_id
LEFT JOIN contracts c ON c.id = ccl.contract_id
WHERE ccl.review_status = 'reviewed'
  AND (cca.id IS NULL OR cca.review_status = 'reviewed');

GRANT SELECT ON v_corruption_contract_links_public TO anon, authenticated;

COMMENT ON TABLE initiative_proposers IS
  'Official initiative proposer labels, with deterministic matches to people, parties, or organizations when available.';

COMMENT ON TABLE corruption_contract_links IS
  'Review-gated candidate and reviewed links between corruption cases and money-flow records.';
