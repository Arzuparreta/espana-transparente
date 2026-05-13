-- Initial schema for Accion Humana
-- Core entities for politicians, parties, legislatures, voting, and annotations

-- Parties (partidos politicos)
CREATE TABLE parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  acronym text,
  color text,
  logo_url text,
  founded text,
  website text,
  wikipedia_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Politicians (core person entity, linked via congress_id)
CREATE TABLE politicians (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  congress_id text UNIQUE NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  full_name text NOT NULL,
  birth_date date,
  birth_place text,
  photo_url text,
  email text,
  twitter text,
  website text,
  raw_data jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Legislatures (legislaturas I-XV)
CREATE TABLE legislatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number integer UNIQUE NOT NULL,
  name text NOT NULL,
  start_date date,
  end_date date,
  is_active boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Politician memberships in legislatures
CREATE TABLE politician_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  politician_id uuid NOT NULL REFERENCES politicians(id) ON DELETE CASCADE,
  legislature_id uuid NOT NULL REFERENCES legislatures(id) ON DELETE CASCADE,
  party_id uuid REFERENCES parties(id) ON DELETE SET NULL,
  constituency text,
  start_date date,
  end_date date,
  is_active boolean DEFAULT true,
  group_parliamentary text,
  raw_data jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  UNIQUE(politician_id, legislature_id)
);

-- Economic declarations (declaraciones de bienes y renta)
CREATE TABLE economic_declarations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  politician_id uuid NOT NULL REFERENCES politicians(id) ON DELETE CASCADE,
  legislature_id uuid REFERENCES legislatures(id) ON DELETE SET NULL,
  declaration_date date,
  raw_data jsonb DEFAULT '{}',
  source_url text,
  created_at timestamptz DEFAULT now()
);

-- Voting sessions (sesiones plenarias con votaciones)
CREATE TABLE voting_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legislature_id uuid NOT NULL REFERENCES legislatures(id) ON DELETE CASCADE,
  session_number integer NOT NULL,
  date date NOT NULL,
  title text NOT NULL,
  initiative_number text,
  initiative_type text,
  raw_data jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Individual votes (voto de cada diputado en cada sesion)
CREATE TABLE votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voting_session_id uuid NOT NULL REFERENCES voting_sessions(id) ON DELETE CASCADE,
  politician_id uuid NOT NULL REFERENCES politicians(id) ON DELETE CASCADE,
  vote text NOT NULL CHECK (vote IN ('Sí', 'No', 'Abstención', 'No vota')),
  raw_data jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  UNIQUE(voting_session_id, politician_id)
);

-- Parliamentary initiatives (proyectos de ley, proposiciones, etc.)
CREATE TABLE initiatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legislature_id uuid NOT NULL REFERENCES legislatures(id) ON DELETE CASCADE,
  type text NOT NULL,
  number text NOT NULL,
  title text,
  proposer_group text,
  status text,
  raw_data jsonb DEFAULT '{}',
  source_url text,
  created_at timestamptz DEFAULT now()
);

-- User annotations (sistema propio de anotaciones)
CREATE TABLE annotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  is_hidden boolean DEFAULT false
);

-- Public contracts (contratos publicos) - Phase 2
CREATE TABLE contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  awarding_body text,
  amount numeric(15,2),
  currency text DEFAULT 'EUR',
  date date,
  contractor text,
  description text,
  source_url text,
  raw_data jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Contract signers (link between contracts and politicians) - Phase 2
CREATE TABLE contract_signers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  politician_id uuid REFERENCES politicians(id) ON DELETE CASCADE,
  signer_name text NOT NULL,
  is_politician boolean DEFAULT false,
  confidence numeric(3,2),
  created_at timestamptz DEFAULT now()
);

-- Budgets (presupuestos generales del estado) - Phase 3
CREATE TABLE budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL,
  ministry text,
  program text,
  budgeted_amount numeric(15,2),
  executed_amount numeric(15,2),
  raw_data jsonb DEFAULT '{}',
  source_url text,
  created_at timestamptz DEFAULT now()
);

-- Economic indicators (INE data) - Phase 4
CREATE TABLE economic_indicators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  indicator_code text NOT NULL,
  indicator_name text NOT NULL,
  period text NOT NULL,
  value numeric,
  unit text,
  raw_data jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  UNIQUE(indicator_code, period)
);

-- Enable pg_trgm extension for fuzzy text search (must be before indexes)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_politicians_full_name ON politicians USING gin (full_name gin_trgm_ops);
CREATE INDEX idx_politicians_congress_id ON politicians (congress_id);
CREATE INDEX idx_politician_memberships_politician ON politician_memberships (politician_id);
CREATE INDEX idx_politician_memberships_legislature ON politician_memberships (legislature_id);
CREATE INDEX idx_politician_memberships_party ON politician_memberships (party_id);
CREATE INDEX idx_votes_politician ON votes (politician_id);
CREATE INDEX idx_votes_session ON votes (voting_session_id);
CREATE INDEX idx_voting_sessions_legislature ON voting_sessions (legislature_id);
CREATE INDEX idx_voting_sessions_date ON voting_sessions (date);
CREATE INDEX idx_economic_declarations_politician ON economic_declarations (politician_id);
CREATE INDEX idx_initiatives_legislature ON initiatives (legislature_id);
CREATE INDEX idx_annotations_entity ON annotations (entity_type, entity_id);
CREATE INDEX idx_annotations_user ON annotations (user_id);
CREATE INDEX idx_contracts_date ON contracts (date);
CREATE INDEX idx_contract_signers_contract ON contract_signers (contract_id);
CREATE INDEX idx_contract_signers_politician ON contract_signers (politician_id);
CREATE INDEX idx_budgets_year ON budgets (year);
CREATE INDEX idx_economic_indicators_code ON economic_indicators (indicator_code);

-- Enable Row Level Security on all tables
ALTER TABLE parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE politicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE legislatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE politician_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE economic_declarations ENABLE ROW LEVEL SECURITY;
ALTER TABLE voting_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE initiatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_signers ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE economic_indicators ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Public read access for all data tables
CREATE POLICY "Public read access" ON parties FOR SELECT USING (true);
CREATE POLICY "Public read access" ON politicians FOR SELECT USING (true);
CREATE POLICY "Public read access" ON legislatures FOR SELECT USING (true);
CREATE POLICY "Public read access" ON politician_memberships FOR SELECT USING (true);
CREATE POLICY "Public read access" ON economic_declarations FOR SELECT USING (true);
CREATE POLICY "Public read access" ON voting_sessions FOR SELECT USING (true);
CREATE POLICY "Public read access" ON votes FOR SELECT USING (true);
CREATE POLICY "Public read access" ON initiatives FOR SELECT USING (true);
CREATE POLICY "Public read access" ON contracts FOR SELECT USING (true);
CREATE POLICY "Public read access" ON contract_signers FOR SELECT USING (true);
CREATE POLICY "Public read access" ON budgets FOR SELECT USING (true);
CREATE POLICY "Public read access" ON economic_indicators FOR SELECT USING (true);

-- Annotations: authenticated users can insert/update their own, anyone can read public
CREATE POLICY "Public read annotations" ON annotations FOR SELECT USING (is_hidden = false);
CREATE POLICY "Users insert own annotations" ON annotations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own annotations" ON annotations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own annotations" ON annotations FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies: Only service_role can insert/update/delete core data
-- (ETL scripts use service_role key, bypassing RLS)
