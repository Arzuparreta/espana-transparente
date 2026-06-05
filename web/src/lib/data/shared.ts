import { unstable_cache } from "next/cache"

export { unstable_cache }

export const HOUR = 3600
export const PHOTOS_CACHE_VERSION = "photos-v3"

export const PAGE_SIZE = {
  votingSessions: 30,
  contracts: 50,
  deputyVotes: 30,
  subsidies: 50,
  euFunds: 50,
  organizations: 50,
  initiatives: 50,
  declarations: 50,
  judicialCases: 50,
  lobbyingGroups: 50,
  attendance: 50,
}

export function parsePage(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value
  const page = Number.parseInt(raw ?? "1", 10)
  return Number.isFinite(page) && page > 0 ? page : 1
}

export const CANONICAL_PARTY_NAMES: Record<string, string> = {
  PP: "Partido Popular",
  PSOE: "Partido Socialista Obrero Español",
  VOX: "VOX",
  SUMAR: "SUMAR",
  ERC: "Esquerra Republicana de Catalunya",
  JUNTS: "Junts per Catalunya",
  "EH Bildu": "EH Bildu",
  "EAJ-PNV": "Partido Nacionalista Vasco",
  UPN: "Unión del Pueblo Navarro",
  BNG: "Bloque Nacionalista Galego",
  CCa: "Coalición Canaria",
  Podemos: "Podemos",
  Ciudadanos: "Ciudadanos",
  PRC: "Partido Regionalista de Cantabria",
}

export function isParliamentaryGroupName(value: string | null | undefined) {
  return /^grupo parlamentario\b/i.test(value ?? "")
}

export function normalizePartyName(acronym: string | null | undefined, name: string | null | undefined) {
  if (acronym && CANONICAL_PARTY_NAMES[acronym]) return CANONICAL_PARTY_NAMES[acronym]
  if (name && !isParliamentaryGroupName(name)) return name
  return name ?? acronym ?? "Sin partido"
}

type PartyRow = { id: string; acronym: string | null; color: string | null; name: string }

export function unwrapParty(value: unknown): PartyRow | null {
  if (!value) return null
  if (Array.isArray(value)) return (value[0] as PartyRow | undefined) ?? null
  return value as PartyRow
}

// ── Shared types ──────────────────────────────────────────────────────────────

export type TopContractAncla = {
  id: string
  title: string
  amount: number | null
  awarding_body: string | null
  contractor: string | null
  date: string | null
  windowDays: 30 | 60 | 90 | null
}

export type TopDivergenceSessionAncla = {
  id: string
  title: string
  date: string | null
  divergence_count: number | null
  isRecent: boolean
}

export type InflationAnchor = {
  period: string
  monthlyValue: number
  annualValue: number | null
  dataType: string | null
}

export type BudgetType = "ley" | "prorroga" | "proyecto"
export type BudgetSourceKind = "published" | "published_prorroga" | "carried_forward"

export interface GobiernoMember {
  id: string
  position_type: "presidente_gobierno" | "vicepresidente" | "ministro"
  person_name: string
  organization_name: string
  political_party: string
  politician_id: string | null
  party_color: string | null
  contract_count: number
  total_amount_eur: number
  government: string
  start_date: string | null
  source_url: string | null
}

export interface MinistrioContract {
  id: string
  title: string
  amount: number | null
  date: string | null
  awarding_body: string | null
  contractor: string | null
  contractor_nif: string | null
  contractor_is_sme: boolean | null
  contractor_is_ute: boolean | null
  award_amount: number | null
  award_amount_with_taxes: number | null
  award_date: string | null
  contract_number: string | null
  received_tender_quantity: number | null
}

export interface InstitucionMember {
  id: string
  institution: "TC" | "CGPJ" | "RTVE" | "SEPI"
  position_title: string
  person_name: string
  political_party: string | null
  nominating_body: string | null
  appointment_date: string | null
  source_url: string | null
  party_color: string | null
  photo_url: string | null
  photo_variants: Record<string, string> | null
  politician_id: string | null
  has_revolving_door: boolean
}

export interface SearchResult {
  entity_type:
    | "politician"
    | "senator"
    | "party"
    | "government_position"
    | "institution"
    | "organization"
    | "voting_session"
    | "vote_divergence"
    | "contract"
    | "subsidy"
    | "initiative"
    | "budget"
    | "budget_program"
    | "indicator"
    | "eu_fund"
    | "revolving_door"
    | "judicial_case"
    | "source_document"
  id: string
  title: string
  subtitle: string | null
  url: string
  key_fact?: string | null
  document_date?: string | null
  amount?: number | null
  source_url?: string | null
  metadata?: Record<string, unknown> | null
  official_name?: string | null
  rank?: number
}

export interface EuFundRow {
  id: string
  label: string
  eu_budget: number | null
  total_budget: number | null
  cofinancing_rate: number | null
  number_projects: number | null
  wikidata_link: string | null
}

export interface EuFundsSummary {
  beneficiary_count: number
  total_eu_budget: number
  avg_cofinancing_rate: number
  total_projects: number
}

export type Senator = {
  id: string
  full_name: string
  first_name: string
  last_name: string
  photo_url: string | null
  senate_id: string | null
  politician_memberships: {
    id: string
    constituency: string | null
    group_parliamentary: string | null
    is_active: boolean
    raw_data: Record<string, unknown> | null
    party: { id: string; acronym: string | null; color: string | null; name: string } | null
  }[]
}

// ── Internal types ────────────────────────────────────────────────────────────

export type Responsibility = {
  person_name: string | null
  politician_id: string | null
  ministry: string | null
  government: string | null
  political_party: string | null
  administration_level?: string | null
  territory_name?: string | null
  match_method?: string | null
}

export type SubsidyResponsibilityRow = Responsibility & { subsidy_id: string }
export type ContractResponsibilityRow = Responsibility & { contract_id: string }

export type OrganizationPublicRow = {
  id: string
  name: string
  organization_type: string | null
  sector: string | null
  country: string | null
  source_url: string | null
  contract_count: number
  subsidy_beneficiary_count: number
  subsidy_granting_count: number
  revolving_door_count: number
  eu_fund_count: number
  judicial_case_count: number
}

export type EntitySummaryRow = {
  entity_type: "organization" | "politician"
  entity_id: string
  name: string
  route: string
  subtitle: string | null
  organization_type: string | null
  sector: string | null
  country: string | null
  party: string | null
  chamber: string | null
  constituency: string | null
  current_role: string | null
  current_organization: string | null
  current_government: string | null
  source_url: string | null
  awarded_contract_count: number
  awarded_contract_total: number
  contractor_contract_count: number
  contractor_contract_total: number
  contract_count: number
  contract_total: number
  subsidy_received_count: number
  subsidy_received_total: number
  subsidy_granted_count: number
  subsidy_granted_total: number
  eu_fund_count: number
  eu_fund_total: number
  revolving_door_count: number
  borme_officer_count: number
  institutional_appointment_count: number
  judicial_case_count: number
  lobbying_group_count: number
  vote_count: number
  declaration_count: number
  responsibility_position_count: number
  borme_match_count: number
  latest_record_date: string | null
  updated_at: string
}

export type MoneyCoverageRow = {
  dataset: string
  administration_level: string
  freshness_window: string
  total_rows: number
  resolved_rows: number
  unresolved_rows: number
  conflict_rows: number
  coverage_start_date: string | null
  latest_record_date: string | null
}

export type UnresolvedMoneyExampleRow = {
  dataset: string
  record_id: string
  record_date: string | null
  body_name: string | null
  body_normalized: string | null
  administration_level: string | null
  display_title: string | null
  source_url: string | null
  issue_type: "unresolved" | "conflict"
}
