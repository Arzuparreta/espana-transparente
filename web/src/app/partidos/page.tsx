import { PageHeader } from "@/components/domain/PageHeader"
import { PartyLogo } from "@/components/domain/PartyLogo"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { getParties } from "@/lib/data"
import type { Party } from "@/types"

export const revalidate = 3600

export const metadata = { title: "Partidos" }

export default async function PartidosPage() {
  const parties = await getParties()
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
        {withDeputies.map((p) => (
          <ResponsiveLink key={(p as Party).id} href={`/partidos/${(p as Party).id}`}>
            <div className="flex min-w-0 items-center gap-4 rounded-[2px] border border-border/60 bg-card px-4 py-3 transition-colors hover:border-foreground/40">
              <PartyLogo
                src={(p as unknown as { logo_url?: string | null }).logo_url}
                color={(p as Party).color}
                acronym={(p as Party).acronym ?? ""}
                size="md"
              />
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-baseline justify-between gap-3">
                  <span className="font-semibold">{(p as Party).acronym}</span>
                  <span className="shrink-0 text-sm text-muted-foreground">
                    {p.stats?.deputy_count ?? 0} diputados
                  </span>
                </div>
                <p className="truncate text-sm text-muted-foreground">{(p as Party).name}</p>
              </div>
            </div>
          </ResponsiveLink>
        ))}
      </div>
    </div>
  )
}
