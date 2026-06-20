import { notFound, permanentRedirect } from "next/navigation"
import { TerritoryDossier } from "@/components/domain/TerritoryDossier"
import { getTerritoryDetail, getTerritoryEnrichment } from "@/lib/data/multilevel"
import { SEGMENT_SCOPE, territoryDetailHref } from "@/lib/territory-routes"

export const dynamic = "force-dynamic"

interface PageProps {
  params: Promise<{ scope: string; key: string }>
}

const SCOPE_TITLE = {
  ccaa: "Gasto autonómico",
  municipio: "Gasto municipal",
} as const

export async function generateMetadata({ params }: PageProps) {
  const { scope, key } = await params
  const territoryScope = SEGMENT_SCOPE[scope]
  if (!territoryScope) return { title: "Tu territorio" }
  const detail = await getTerritoryDetail(territoryScope, decodeURIComponent(key))
  const fallback = SCOPE_TITLE[scope as keyof typeof SCOPE_TITLE] ?? "Tu territorio"
  return { title: detail ? `${detail.territory.territoryName} · ${fallback}` : fallback }
}

export default async function TerritoryDetailPage({ params }: PageProps) {
  const { scope, key } = await params
  const territoryScope = SEGMENT_SCOPE[scope]
  if (!territoryScope) notFound()

  const requestedKey = decodeURIComponent(key)
  const detail = await getTerritoryDetail(territoryScope, requestedKey)
  if (!detail) notFound()

  // Autonomic keys are canonical (territory_catalog); redirect alias hits to the
  // canonical key so the URL is stable. Municipal keys are the literal already.
  if (territoryScope === "autonomic" && detail.territory.territoryKey !== requestedKey) {
    permanentRedirect(territoryDetailHref("autonomic", detail.territory.territoryKey))
  }

  // Receptor-side enrichment ("dónde está la empresa") is dense and unambiguous
  // at CCAA level; municipal company location is not in the sources.
  const enrichment =
    territoryScope === "autonomic"
      ? await getTerritoryEnrichment(detail.territory.territoryKey)
      : null

  return <TerritoryDossier scope={territoryScope} detail={detail} enrichment={enrichment} />
}
