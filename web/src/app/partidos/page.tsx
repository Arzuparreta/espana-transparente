import { PageHeader } from "@/components/domain/PageHeader"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { getParties } from "@/lib/data"

export const revalidate = 3600

export const metadata = { title: "Partidos" }

function VoteBar({ pctYes, pctNo, pctAbstain }: { pctYes: number; pctNo: number; pctAbstain: number }) {
  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div className="h-full bg-green-600/70" style={{ width: `${pctYes}%` }} />
      <div className="h-full bg-red-600/70"   style={{ width: `${pctNo}%` }} />
      <div className="h-full bg-amber-500/70" style={{ width: `${pctAbstain}%` }} />
    </div>
  )
}

export default async function PartidosPage() {
  const parties = await getParties()
  const withStats = parties.filter((p) => p.stats?.deputy_count)
  const sorted = [...withStats].sort((a, b) => (b.stats?.deputy_count ?? 0) - (a.stats?.deputy_count ?? 0))

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Partidos"
        description="Partidos con representación en el Congreso de la XV Legislatura."
      />

      <div className="space-y-2">
        {sorted.map((p) => {
          const s = p.stats
          return (
            <ResponsiveLink key={p.id} href={`/partidos/${p.id}`}>
              <div className="flex min-w-0 items-center gap-4 rounded-xl border border-border/60 bg-card/80 px-4 py-3 transition-colors hover:border-border hover:bg-card">
                {/* Color dot */}
                <div
                  className="h-8 w-8 shrink-0 rounded-full border border-border/40 shadow-sm"
                  style={{ backgroundColor: p.color }}
                />

                {/* Name + bar */}
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex min-w-0 items-baseline justify-between gap-3">
                    <span className="font-semibold">{p.acronym}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{p.name}</span>
                  </div>
                  {s && (
                    <>
                      <VoteBar pctYes={Number(s.pct_yes)} pctNo={Number(s.pct_no)} pctAbstain={Number(s.pct_abstain)} />
                      <div className="flex min-w-0 items-center justify-between gap-3 text-xs text-muted-foreground">
                        <span>{s.deputy_count} diputados · asistencia {s.attendance_pct}%</span>
                        <span className="shrink-0 tabular-nums">
                          <span className="text-green-700 dark:text-green-400">{s.pct_yes}% Sí</span>
                          {" · "}
                          <span className="text-red-700 dark:text-red-400">{s.pct_no}% No</span>
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </ResponsiveLink>
          )
        })}
      </div>
    </div>
  )
}
