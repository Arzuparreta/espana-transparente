-- CNMC Lobbying Register (Registro de Grupos de Interés).
-- Data gap: shows who lobbies the competition regulator.
-- Source: rgi.cnmc.es (public register, ~1,200 entities).
-- Scraped weekly via ETL pipeline.

CREATE TABLE IF NOT EXISTS lobbying_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  category text,
  subcategory text,
  address_postal_code text,
  address_street text,
  address_locality text,
  address_country text,
  legal_rep_name text,
  legal_rep_role text,
  contact_name text,
  contact_role text,
  objectives text,
  activities text,
  interest_areas text,
  source_url text NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lobbying_groups_name_idx ON lobbying_groups (name);
CREATE INDEX IF NOT EXISTS lobbying_groups_category_idx ON lobbying_groups (category);

ALTER TABLE lobbying_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read lobbying" ON lobbying_groups;
CREATE POLICY "Public read lobbying"
  ON lobbying_groups FOR SELECT USING (true);

GRANT SELECT ON lobbying_groups TO anon, authenticated;

-- Link lobbying groups to organizations we already track
CREATE TABLE IF NOT EXISTS lobbying_organization_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lobbying_group_id uuid REFERENCES lobbying_groups(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  confidence numeric(3,2) NOT NULL DEFAULT 0.85,
  match_method text NOT NULL DEFAULT 'fuzzy',
  reviewed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lobbying_group_id, organization_id)
);

CREATE INDEX IF NOT EXISTS lobbying_org_link_org_idx ON lobbying_organization_links (organization_id);

ALTER TABLE lobbying_organization_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read lobbying links" ON lobbying_organization_links;
CREATE POLICY "Public read lobbying links"
  ON lobbying_organization_links FOR SELECT USING (true);

GRANT SELECT ON lobbying_organization_links TO anon, authenticated;
