-- Power relationships: who controls whom within party structures
CREATE TABLE power_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES politicians(id) ON DELETE CASCADE,
  superior_id uuid REFERENCES politicians(id) ON DELETE SET NULL,
  relationship_type text NOT NULL CHECK (relationship_type IN (
    'party_leader',
    'spokesperson',
    'list_placement',
    'appointed_by',
    'minister_of'
  )),
  party_id uuid REFERENCES parties(id) ON DELETE SET NULL,
  description text,
  start_date date,
  end_date date,
  source_url text,
  raw_data jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Revolving door: public officials moving to private sector
CREATE TABLE revolving_door (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES politicians(id) ON DELETE CASCADE,
  public_role text NOT NULL,
  public_organization text,
  private_role text NOT NULL,
  private_organization text NOT NULL,
  sector text,
  start_date date,
  cooling_off_months int,
  source_url text,
  raw_data jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Initiative traceability
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS origin_type text;
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS proposed_by_person_id uuid REFERENCES politicians(id);
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS eu_directive_ref text;
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS budget_veto_used boolean DEFAULT false;

-- RLS for new tables
ALTER TABLE power_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE revolving_door ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON power_relationships FOR SELECT USING (true);
CREATE POLICY "Public read" ON revolving_door FOR SELECT USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pr_person ON power_relationships (person_id);
CREATE INDEX IF NOT EXISTS idx_pr_superior ON power_relationships (superior_id);
CREATE INDEX IF NOT EXISTS idx_pr_party ON power_relationships (party_id);
CREATE INDEX IF NOT EXISTS idx_rd_person ON revolving_door (person_id);
