-- BORME company officers (directors, executives) from OpenMercantil API.
-- Data gap: connects companies to people, feeding the unified entity graph.
-- Source: openmercantil.es API (CC BY 4.0, public domain via BORME).
-- Updated weekly via ETL pipeline.

CREATE TABLE IF NOT EXISTS borme_officers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  person_name text NOT NULL,
  person_slug text,
  role text,
  since date,
  is_current boolean NOT NULL DEFAULT true,
  company_slug text NOT NULL,
  company_cif text,
  source text NOT NULL DEFAULT 'openmercantil',
  source_url text,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, person_name, role, company_slug)
);

CREATE INDEX IF NOT EXISTS borme_officers_org_idx ON borme_officers (organization_id);
CREATE INDEX IF NOT EXISTS borme_officers_person_idx ON borme_officers (person_name);
CREATE INDEX IF NOT EXISTS borme_officers_role_idx ON borme_officers (role);

ALTER TABLE borme_officers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read borme" ON borme_officers;
CREATE POLICY "Public read borme"
  ON borme_officers FOR SELECT USING (true);

GRANT SELECT ON borme_officers TO anon, authenticated;

-- Cross-reference table: who in our politicians database also appears as a BORME officer
CREATE TABLE IF NOT EXISTS borme_politician_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  borme_officer_id uuid REFERENCES borme_officers(id) ON DELETE CASCADE,
  politician_id uuid REFERENCES politicians(id) ON DELETE CASCADE,
  confidence numeric(3,2) NOT NULL DEFAULT 0.85,
  match_method text NOT NULL DEFAULT 'fuzzy',
  reviewed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (borme_officer_id, politician_id)
);

CREATE INDEX IF NOT EXISTS borme_pol_match_pol_idx ON borme_politician_matches (politician_id);
CREATE INDEX IF NOT EXISTS borme_pol_match_officer_idx ON borme_politician_matches (borme_officer_id);

ALTER TABLE borme_politician_matches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read borme matches" ON borme_politician_matches;
CREATE POLICY "Public read borme matches"
  ON borme_politician_matches FOR SELECT USING (true);

GRANT SELECT ON borme_politician_matches TO anon, authenticated;
