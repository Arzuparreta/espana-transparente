import { PageHeader } from "@/components/domain/PageHeader"
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
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Partidos"
        description="Partidos con representación en el Congreso de la XV Legislatura."
      />
      <div className="space-y-2">
        {withDeputies.map((p) => (
          <ResponsiveLink key={(p as Party).id} href={`/partidos/${(p as Party).id}`}>
            <div className="flex min-w-0 items-center gap-4 rounded-xl border border-border/60 bg-card/80 px-4 py-3 transition-colors hover:border-border hover:bg-card">
              <div
                className="h-8 w-8 shrink-0 rounded-full border border-border/40 shadow-sm"
                style={{ backgroundColor: (p as Party).color }}
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
