-- Revolving-door investigation pipeline.
-- Public pages read curated revolving_door rows; ETL writes candidates/sources first.

CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  normalized_name text NOT NULL,
  organization_type text CHECK (organization_type IN (
    'company',
    'public_body',
    'foundation',
    'association',
    'other'
  )),
  sector text,
  country text DEFAULT 'ES',
  source_url text,
  raw_data jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (normalized_name)
);

ALTER TABLE revolving_door
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS public_exit_date date,
  ADD COLUMN IF NOT EXISTS private_start_date date,
  ADD COLUMN IF NOT EXISTS authorization_date date,
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'verified'
    CHECK (verification_status IN ('candidate', 'needs_review', 'verified', 'rejected')),
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_method text,
  ADD COLUMN IF NOT EXISTS primary_source_url text;

CREATE OR REPLACE FUNCTION immutable_date_key(input date)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN input IS NULL THEN ''
    ELSE
      lpad(extract(year FROM input)::int::text, 4, '0') || '-' ||
      lpad(extract(month FROM input)::int::text, 2, '0') || '-' ||
      lpad(extract(day FROM input)::int::text, 2, '0')
  END
$$;

CREATE TABLE IF NOT EXISTS revolving_door_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid REFERENCES politicians(id) ON DELETE SET NULL,
  person_name text NOT NULL,
  political_party text,
  public_role text,
  public_organization text,
  public_exit_date date,
  private_role text NOT NULL,
  private_organization text NOT NULL,
  organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  private_start_date date,
  authorization_date date,
  sector text,
  confidence numeric(4,3) NOT NULL DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 1),
  status text NOT NULL DEFAULT 'needs_review'
    CHECK (status IN ('needs_review', 'approved', 'rejected', 'published')),
  discovered_by text NOT NULL,
  discovery_method text,
  review_notes text,
  reviewed_at timestamptz,
  reviewed_by text,
  published_revolving_door_id uuid REFERENCES revolving_door(id) ON DELETE SET NULL,
  candidate_key text GENERATED ALWAYS AS (
    md5(
      lower(coalesce(person_name, '')) || '|' ||
      lower(coalesce(private_organization, '')) || '|' ||
      lower(coalesce(private_role, '')) || '|' ||
      immutable_date_key(private_start_date) || '|' ||
      immutable_date_key(authorization_date)
    )
  ) STORED,
  raw_data jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (candidate_key)
);

CREATE TABLE IF NOT EXISTS revolving_door_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  revolving_door_id uuid REFERENCES revolving_door(id) ON DELETE CASCADE,
  candidate_id uuid REFERENCES revolving_door_candidates(id) ON DELETE CASCADE,
  source_type text NOT NULL CHECK (source_type IN (
    'primary',
    'secondary',
    'discovery'
  )),
  source_name text NOT NULL,
  source_url text NOT NULL,
  title text,
  published_at date,
  observed_at timestamptz DEFAULT now(),
  evidence_text text,
  raw_data jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  CHECK (revolving_door_id IS NOT NULL OR candidate_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_organizations_normalized_name ON organizations (normalized_name);
CREATE INDEX IF NOT EXISTS idx_rd_organization ON revolving_door (organization_id);
CREATE INDEX IF NOT EXISTS idx_rd_status ON revolving_door (verification_status);
CREATE INDEX IF NOT EXISTS idx_rd_private_start_date ON revolving_door (private_start_date);
CREATE INDEX IF NOT EXISTS idx_rdc_status ON revolving_door_candidates (status);
CREATE INDEX IF NOT EXISTS idx_rdc_person_name ON revolving_door_candidates USING gin (person_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_rdc_private_organization ON revolving_door_candidates USING gin (private_organization gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_rds_revolving_door ON revolving_door_sources (revolving_door_id);
CREATE INDEX IF NOT EXISTS idx_rds_candidate ON revolving_door_sources (candidate_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rds_entity_source_url ON revolving_door_sources (
  coalesce(revolving_door_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(candidate_id, '00000000-0000-0000-0000-000000000000'::uuid),
  source_url
);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE revolving_door_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE revolving_door_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read" ON organizations FOR SELECT USING (true);
CREATE POLICY "Public read published sources" ON revolving_door_sources
  FOR SELECT TO anon USING (revolving_door_id IS NOT NULL);
CREATE POLICY "Authenticated read sources" ON revolving_door_sources
  FOR SELECT TO authenticated USING (true);

-- Candidates are investigation state. Keep them out of the anonymous API.
CREATE POLICY "Authenticated read candidates" ON revolving_door_candidates
  FOR SELECT TO authenticated USING (true);

GRANT SELECT ON organizations TO anon, authenticated;
GRANT SELECT ON revolving_door_sources TO anon, authenticated;
GRANT SELECT ON revolving_door_candidates TO authenticated;

CREATE OR REPLACE VIEW v_revolving_door_public AS
SELECT
  rd.id,
  rd.person_id,
  coalesce(rd.person_name, p.full_name) AS person_name,
  rd.political_party,
  rd.public_role,
  rd.public_organization,
  rd.public_exit_date,
  rd.private_role,
  rd.private_organization,
  rd.organization_id,
  o.sector AS organization_sector,
  coalesce(rd.sector, o.sector) AS sector,
  rd.start_date,
  rd.private_start_date,
  rd.authorization_date,
  rd.cooling_off_months,
  rd.primary_source_url,
  rd.source_url,
  rd.verification_status,
  rd.verification_method,
  rd.verified_at,
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'source_type', rds.source_type,
        'source_name', rds.source_name,
        'source_url', rds.source_url,
        'title', rds.title,
        'published_at', rds.published_at,
        'evidence_text', rds.evidence_text
      )
      ORDER BY
        CASE rds.source_type WHEN 'primary' THEN 0 WHEN 'secondary' THEN 1 ELSE 2 END,
        rds.published_at DESC NULLS LAST
    ) FILTER (WHERE rds.id IS NOT NULL),
    '[]'::jsonb
  ) AS sources
FROM revolving_door rd
LEFT JOIN politicians p ON p.id = rd.person_id
LEFT JOIN organizations o ON o.id = rd.organization_id
LEFT JOIN revolving_door_sources rds ON rds.revolving_door_id = rd.id
WHERE rd.verification_status = 'verified'
GROUP BY rd.id, p.full_name, o.sector;

GRANT SELECT ON v_revolving_door_public TO anon, authenticated;
