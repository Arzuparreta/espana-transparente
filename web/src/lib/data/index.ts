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
} from "./shared"

// ── Home ─────────────────────────────────────────────────────────────────────
export {
  getHomeData,
  getTopContractOfMonth,
  getTopDivergenceSessionOfMonth,
  getLatestInflationAnchor,
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
  getPartyAcronymMap,
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
  type TopBudgetSectionAncla,
  getTopBudgetSectionAnchor,
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

// ── Search ───────────────────────────────────────────────────────────────────
export {
  searchGlobal,
  searchDocuments,
  searchSuggestions,
} from "./search"

// ── Revolving doors, Indicators, Initiatives ─────────────────────────────────
export {
  getRevolvingDoorCases,
  getRevolvingDoorCaseById,
  getIndicators,
  getIndicatorPoints,
  getInitiativeDetail,
} from "./conexiones"

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
} from "./senado"

// ── ETL status ───────────────────────────────────────────────────────────────
export {
  getEtlPipelineStatus,
} from "./etl"
