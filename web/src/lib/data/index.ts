// Barrel re-exports from domain modules.
// All existing imports of `@/lib/data` continue to work unchanged.

// ── Shared types & constants ─────────────────────────────────────────────────
export {
  PAGE_SIZE,
  parsePage,
  type TopContractAncla,
  type TopDivergenceSessionAncla,
  type InflationAnchor,
  type GobiernoMember,
  type MinistrioContract,
  type InstitucionMember,
  type SearchResult,
  type EuFundRow,
  type EuFundsSummary,
  type Senator,
  type EntitySummaryRow,
} from "./shared"

// ── Home ─────────────────────────────────────────────────────────────────────
export {
  getHomeData,
  getTopContractOfMonth,
  getTopDivergenceSessionOfMonth,
  getLatestInflationAnchor,
  getSectionIndex,
  getHomeHeroAnchor,
  getEtlFreshnessSummary,
  type SectionIndexRow,
  type HomeHeroAnchor,
  type EtlFreshness,
} from "./home"

// ── Politicians ──────────────────────────────────────────────────────────────
export {
  getDeputyCards,
  getPoliticianProfileData,
  getDeputyVotes,
  getDeputyAttendanceSessions,
} from "./politicians"

// ── Parties ──────────────────────────────────────────────────────────────────
export {
  getParties,
  getPartyPageData,
  getPartyVotingSessions,
  getPartyJudicialCases,
  getPartyCaseCounts,
  getPartyAcronymMap,
  type PartyCaseRow,
} from "./parties"

// ── Voting ───────────────────────────────────────────────────────────────────
export {
  getVotingSessionPage,
  getVotingDetailData,
  getDivergenceRanking,
} from "./voting"

// ── Gobierno & Instituciones ─────────────────────────────────────────────────
export {
  getGobiernoActual,
  getMinistrioDetail,
  getInstitucionesActuales,
  getInstitucionById,
} from "./gobierno"

// ── Contracts ────────────────────────────────────────────────────────────────
export {
  getContractPage,
  getContractPageFiltered,
  getContractDetail,
} from "./contracts"

// ── Subsidies ────────────────────────────────────────────────────────────────
export {
  getSubvencionPage,
  getSubvencionPageFiltered,
  getSubsidyDetail,
} from "./subsidies"

// ── Budget ───────────────────────────────────────────────────────────────────
export {
  BUDGET_YEAR_META,
  BUDGET_YEARS,
  getBudgetYearMeta,
  getBudgetSummary,
  getBudgetSection,
  getBudgetProgram,
  getBudgetMinister,
  getBudgetSourceNote,
  type BudgetSourceKind,
  type BudgetType,
  type BudgetAnchor,
  getBudgetAnchor,
} from "./budget"

// ── Money overview ───────────────────────────────────────────────────────────
export {
  getMoneyDataOverview,
  getMoneyDatasetSummary,
} from "./money"

// ── Organizations ────────────────────────────────────────────────────────────
export {
  getOrganizationsList,
  getOrganizationPageData,
} from "./organizations"

// ── Entity Trail (cross-entity connections) ──────────────────────────────────
export {
  getEntityTrail,
  getEntityLabel,
} from "./entity-trail"
export type { EntityTrail as EntityTrailData, TrailConnection, EntityLabel } from "./entity-trail"

// ── Search ───────────────────────────────────────────────────────────────────
export {
  searchGlobal,
  searchDocuments,
  searchSuggestions,
} from "./search"
export {
  getJudicialCaseDetail,
  getJudicialCasesPage,
  getJudicialLinksForContract,
  getJudicialLinksForOrganizations,
  JUDICIAL_STATUS_LABEL,
} from "./judicial"
export type { JudicialStatus } from "./judicial"

// ── Revolving doors, Indicators, Initiatives ─────────────────────────────────
export {
  getRevolvingDoorCases,
  getRevolvingDoorCaseById,
  getIndicators,
  getIndicatorPoints,
  getIpcIndexSeries,
  getInitiativeDetail,
  getInitiativesPage,
  type InitiativeListRow,
} from "./conexiones"

// ── Declarations ─────────────────────────────────────────────────────────────
export {
  getDeclarationsPage,
  getDeclarationsRegister,
  type DeclarationListRow,
  type DeclarationRegisterRow,
  type DeclarationType,
} from "./declarations"

// ── Money flow (Trazabilidad del gasto) ──────────────────────────────────────
export {
  getMoneyFlowYear,
  type MoneyFlowSection,
  type MoneyFlowRow,
  type EuFundSectionSummary,
} from "./money-flow"

// ── EU Funds ─────────────────────────────────────────────────────────────────
export {
  getEuFundsPage,
  getEuFundsSummary,
  getEuFundBySlug,
} from "./eu-funds"

// ── Senado ───────────────────────────────────────────────────────────────────
export {
  getSenators,
  getSenatorStats,
  getSenateSessionCount,
  getSenateNominalVoteStats,
} from "./senado"

// ── Lobbying (CNMC RGI) ──────────────────────────────────────────────────────
export {
  getLobbyingGroupsPage,
  getLobbyingGroupById,
  getLobbyingCategories,
} from "./lobbying"

// ── ETL status ───────────────────────────────────────────────────────────────
export {
  getEtlPipelineStatus,
  getEtlLastFinished,
} from "./etl"
