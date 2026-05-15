export interface Politician {
  id: string
  congress_id: string
  first_name: string
  last_name: string
  full_name: string
  birth_date?: string
  birth_place?: string
  photo_url?: string
  photo_variants?: Record<string, string>
  photo_version_id?: string
  email?: string
  twitter?: string
  website?: string
  raw_data: Record<string, unknown>
  created_at: string
  updated_at: string
  politician_memberships?: PoliticianMembership[]
  economic_declarations?: EconomicDeclaration[]
}

export interface Party {
  id: string
  name: string
  acronym: string
  color: string
  logo_url?: string
  founded?: string
  website?: string
}

export interface Legislature {
  id: string
  number: number
  name: string
  start_date?: string
  end_date?: string
  is_active: boolean
}

export interface PoliticianMembership {
  id: string
  constituency?: string
  group_parliamentary?: string
  start_date?: string
  end_date?: string
  is_active: boolean
  politician?: Politician
  party?: Party
  legislature?: Legislature
}

export interface EconomicDeclaration {
  id: string
  declaration_date?: string
  raw_data: Record<string, unknown>
  source_url?: string
}

export interface Vote {
  id: string
  vote: "Sí" | "No" | "Abstención" | "No vota"
  voting_sessions?: VotingSession
}

export interface VotingSession {
  date: string
  title: string
  initiative_number: string | null
}

export interface Annotation {
  id: string
  body: string
  created_at: string
  user_id: string
}

export interface PoliticianWithMemberships extends Politician {
  politician_memberships: PoliticianMembership[]
}
