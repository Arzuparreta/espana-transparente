export interface Politician {
  id: string
  congress_id: string
  senate_id?: string
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
  chamber?: "congress" | "senate"
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

export interface PublicProfileOptions {
  show_recent_annotations: boolean
  show_avatar: boolean
}

export interface UserProfile {
  id: string
  handle: string | null
  display_name: string | null
  bio: string | null
  website_url: string | null
  location: string | null
  avatar_path: string | null
  is_public: boolean
  public_options: PublicProfileOptions
  created_at: string
  updated_at: string
}

export interface UserProfileSettings {
  user_id: string
  settings: Record<string, unknown>
  created_at: string
  updated_at: string
}
