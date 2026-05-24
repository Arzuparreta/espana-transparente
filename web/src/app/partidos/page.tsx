import { PageHeader } from "@/components/domain/PageHeader"
import { PartyLogo } from "@/components/domain/PartyLogo"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { getParties, getPartyCaseCounts } from "@/lib/data"
import type { Party } from "@/types"

export const revalidate = 3600

export const metadata = { title: "Partidos" }

export default async function PartidosPage() {
  const [parties, caseCounts] = await Promise.all([
    getParties(),
    getPartyCaseCounts(),
  ])

  const withDeputies = [...parties]
    .filter((p) => (p.stats?.deputy_count ?? 0) > 0)
    .sort((a, b) => (b.stats?.deputy_count ?? 0) - (a.stats?.deputy_count ?? 0))

  return (
    <div className="ui-page">
      <PageHeader
        title="Partidos"
        description="Los partidos con representación en el Congreso. Cuántos diputados tienen, en qué provincias, y cómo votan."
      />
      <div className="space-y-2">
        {withDeputies.map((p) => {
          const party = p as Party
          const caseCount = caseCounts[(p as Party).id] ?? 0
          return (
            <ResponsiveLink key={party.id} href={`/partidos/${party.id}`}>
              <div className="flex min-w-0 items-center gap-4 rounded-[2px] border border-border/60 bg-card px-4 py-3 transition-colors hover:border-foreground/40">
                <PartyLogo
                  src={(p as unknown as { logo_url?: string | null }).logo_url}
                  color={party.color}
                  acronym={party.acronym ?? ""}
                  size="md"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <span className="font-semibold">{party.acronym}</span>
                    <div className="shrink-0 text-right">
                      <div className="text-sm text-muted-foreground">
                        {p.stats?.deputy_count ?? 0} diputados
                      </div>
                      {caseCount > 0 && (
                        <div className="font-mono text-xs text-muted-foreground/70">
                          {caseCount} casos jud.
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="truncate text-sm text-muted-foreground">{party.name}</p>
                </div>
              </div>
            </ResponsiveLink>
          )
        })}
      </div>
    </div>
  )
}
