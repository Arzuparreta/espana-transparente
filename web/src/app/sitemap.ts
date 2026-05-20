import type { MetadataRoute } from "next"
import { BRAND_URL } from "@/lib/brand"
import { getDeputyCards, getParties } from "@/lib/data"
import { getAutonomicTerritoryKeys, getMunicipalTerritoryKeys } from "@/lib/data/multilevel"
import {
  getSitemapBudgetProgramPaths,
  getSitemapBudgetSectionPaths,
  getSitemapContractIds,
  getSitemapEuFundSlugs,
  getSitemapIndicatorCodes,
  getSitemapInitiativeIds,
  getSitemapInstitucionIds,
  getSitemapOrganizationIds,
  getSitemapRevolvingDoorIds,
  getSitemapSubsidyIds,
  getSitemapVotingSessionIds,
} from "@/lib/data/sitemap"

export const revalidate = 86400

const STATIC_ROUTES: { path: string; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]; priority: number }[] = [
  { path: "/",                   changeFrequency: "daily",   priority: 1.0 },
  { path: "/diputados",          changeFrequency: "daily",   priority: 0.9 },
  { path: "/votaciones",         changeFrequency: "daily",   priority: 0.9 },
  { path: "/distorsion",         changeFrequency: "weekly",  priority: 0.8 },
  { path: "/gobierno",           changeFrequency: "weekly",  priority: 0.8 },
  { path: "/senado",             changeFrequency: "weekly",  priority: 0.7 },
  { path: "/instituciones",      changeFrequency: "weekly",  priority: 0.7 },
  { path: "/partidos",           changeFrequency: "weekly",  priority: 0.7 },
  { path: "/puertas-giratorias", changeFrequency: "weekly",  priority: 0.8 },
  { path: "/contratos",          changeFrequency: "daily",   priority: 0.8 },
  { path: "/subvenciones",       changeFrequency: "daily",   priority: 0.8 },
  { path: "/presupuestos",       changeFrequency: "monthly", priority: 0.7 },
  { path: "/fondos-ue",          changeFrequency: "weekly",  priority: 0.7 },
  { path: "/indicadores",        changeFrequency: "weekly",  priority: 0.6 },
  { path: "/organizaciones",     changeFrequency: "weekly",  priority: 0.6 },
  { path: "/estado-datos",       changeFrequency: "weekly",  priority: 0.5 },
  { path: "/buscar",             changeFrequency: "monthly", priority: 0.4 },
  { path: "/iniciativas",        changeFrequency: "weekly",  priority: 0.6 },
  { path: "/declaraciones",      changeFrequency: "weekly",  priority: 0.6 },
  { path: "/dinero-publico",     changeFrequency: "weekly",  priority: 0.9 },
  { path: "/ccaa",               changeFrequency: "weekly",  priority: 0.6 },
  { path: "/municipios",         changeFrequency: "weekly",  priority: 0.6 },
]

function url(path: string) {
  return `${BRAND_URL}${path}`
}

function lastModified(value: string | null | undefined, fallback: Date): Date {
  if (!value) return fallback
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? fallback : d
}

async function tryGet<T>(fetcher: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fetcher()
  } catch {
    return fallback
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: url(route.path),
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }))

  const [
    deputies,
    parties,
    votingSessions,
    contracts,
    subsidies,
    euFunds,
    revolvingDoor,
    organizations,
    indicators,
    instituciones,
    budgetSections,
    budgetPrograms,
    initiatives,
    autonomicTerritories,
    municipalTerritories,
  ] = await Promise.all([
    tryGet(
      async () =>
        ((await getDeputyCards()) as unknown as { id: string }[]).map((d) => ({ id: d.id })),
      [] as { id: string }[]
    ),
    tryGet(
      async () =>
        ((await getParties()) as unknown as { id: string }[]).map((p) => ({ id: p.id })),
      [] as { id: string }[]
    ),
    tryGet(() => getSitemapVotingSessionIds(), [] as { id: string; date: string | null }[]),
    tryGet(() => getSitemapContractIds(), [] as { id: string; date: string | null }[]),
    tryGet(() => getSitemapSubsidyIds(), [] as { id: string; date: string | null }[]),
    tryGet(() => getSitemapEuFundSlugs(), [] as { slug: string }[]),
    tryGet(() => getSitemapRevolvingDoorIds(), [] as { id: string }[]),
    tryGet(() => getSitemapOrganizationIds(), [] as { id: string }[]),
    tryGet(() => getSitemapIndicatorCodes(), [] as { code: string }[]),
    tryGet(() => getSitemapInstitucionIds(), [] as { id: string }[]),
    tryGet(() => getSitemapBudgetSectionPaths(), [] as { year: number; section_code: string }[]),
    tryGet(() => getSitemapBudgetProgramPaths(), [] as { section_code: string; program_code: string }[]),
    tryGet(() => getSitemapInitiativeIds(), [] as { id: string }[]),
    tryGet(() => getAutonomicTerritoryKeys(), [] as { territoryKey: string }[]),
    tryGet(() => getMunicipalTerritoryKeys(), [] as { territoryKey: string }[]),
  ])

  const deputyEntries: MetadataRoute.Sitemap = (deputies as { id: string }[]).map((d) => ({
    url: url(`/diputados/${d.id}`),
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.6,
  }))

  const partyEntries: MetadataRoute.Sitemap = (parties as { id: string }[]).map((p) => ({
    url: url(`/partidos/${p.id}`),
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.6,
  }))

  const votingEntries: MetadataRoute.Sitemap = votingSessions.map((s) => ({
    url: url(`/votaciones/${s.id}`),
    lastModified: lastModified(s.date, now),
    changeFrequency: "monthly",
    priority: 0.5,
  }))

  const contractEntries: MetadataRoute.Sitemap = contracts.map((c) => ({
    url: url(`/contratos/${c.id}`),
    lastModified: lastModified(c.date, now),
    changeFrequency: "monthly",
    priority: 0.4,
  }))

  const subsidyEntries: MetadataRoute.Sitemap = subsidies.map((s) => ({
    url: url(`/subvenciones/${s.id}`),
    lastModified: lastModified(s.date, now),
    changeFrequency: "monthly",
    priority: 0.4,
  }))

  const euFundEntries: MetadataRoute.Sitemap = euFunds.map((f) => ({
    url: url(`/fondos-ue/${encodeURIComponent(f.slug)}`),
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.4,
  }))

  const revolvingDoorEntries: MetadataRoute.Sitemap = revolvingDoor.map((r) => ({
    url: url(`/puertas-giratorias/${r.id}`),
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.5,
  }))

  const organizationEntries: MetadataRoute.Sitemap = organizations.map((o) => ({
    url: url(`/organizaciones/${o.id}`),
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.4,
  }))

  const indicatorEntries: MetadataRoute.Sitemap = indicators.map((i) => ({
    url: url(`/indicadores/${encodeURIComponent(i.code)}`),
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.5,
  }))

  const institucionEntries: MetadataRoute.Sitemap = instituciones.map((i) => ({
    url: url(`/instituciones/${i.id}`),
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.5,
  }))

  const budgetSectionEntries: MetadataRoute.Sitemap = budgetSections.map((s) => ({
    url: url(`/presupuestos/${s.section_code}?year=${s.year}`),
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.5,
  }))

  const budgetProgramEntries: MetadataRoute.Sitemap = budgetPrograms.map((p) => ({
    url: url(`/presupuestos/${p.section_code}/${p.program_code}`),
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.4,
  }))

  const initiativeEntries: MetadataRoute.Sitemap = initiatives.map((i) => ({
    url: url(`/iniciativas/${i.id}`),
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.4,
  }))

  const autonomicTerritoryEntries: MetadataRoute.Sitemap = autonomicTerritories.map((territory) => ({
    url: url(`/ccaa/${encodeURIComponent(territory.territoryKey)}`),
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.5,
  }))

  const municipalTerritoryEntries: MetadataRoute.Sitemap = municipalTerritories.map((territory) => ({
    url: url(`/municipios/${encodeURIComponent(territory.territoryKey)}`),
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.5,
  }))

  return [
    ...staticEntries,
    ...deputyEntries,
    ...partyEntries,
    ...votingEntries,
    ...contractEntries,
    ...subsidyEntries,
    ...euFundEntries,
    ...revolvingDoorEntries,
    ...organizationEntries,
    ...indicatorEntries,
    ...institucionEntries,
    ...budgetSectionEntries,
    ...budgetProgramEntries,
    ...initiativeEntries,
    ...autonomicTerritoryEntries,
    ...municipalTerritoryEntries,
  ]
}
