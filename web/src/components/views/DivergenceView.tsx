import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { SourceFootnote } from "@/components/domain/SourceFootnote"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { getDivergenceRanking, getEtlLastFinished } from "@/lib/data"
import { getResponsivePhoto } from "@/lib/photos"
import { cn } from "@/lib/utils"

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

interface DivergenceRow {
  politician_id: string
  full_name: string
  party_acronym: string | null
  party_color: string | null
  photo_url: string | null
  photo_variants: Record<string, string> | null
  divergence_count: number
}

export async function DivergenceView() {
  const [ranking, lastChecked] = await Promise.all([
    getDivergenceRanking() as Promise<DivergenceRow[]>,
    getEtlLastFinished(["congreso.asistencia", "senado.votaciones"]),
  ])

  return (
    <div className="space-y-6 sm:space-y-8">
      <SourceFootnote
        sourceLabel="Congreso de los Diputados · Senado"
        lastChecked={lastChecked}
        coverageLabel={`${ranking.length} diputados con divergencias registradas`}
      />

      <div className="space-y-3">
        {ranking.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No hay divergencias registradas en la muestra actual.
          </p>
        )}
        {ranking.map((d, idx) => {
          const photo = getResponsivePhoto(d.photo_url, d.photo_variants)
          const rank = idx + 1
          return (
            <ResponsiveLink key={d.politician_id} href={`/diputados/${d.politician_id}`}>
              <Card>
                <CardContent className="flex items-center gap-4 py-4">
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center font-mono text-xs tabular-nums",
                      rank <= 3 ? "text-accent" : "text-muted-foreground"
                    )}
                  >
                    {rank}
                  </span>
                  <Avatar className="size-10 shrink-0">
                    <AvatarImage src={photo.src} srcSet={photo.srcSet} sizes={photo.sizes} alt="" />
                    <AvatarFallback className="text-xs">{initials(d.full_name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium leading-snug">{d.full_name}</div>
                    <div className="mt-0.5 flex items-center gap-2">
                      {d.party_acronym && (
                        <span
                          className="inline-block h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: d.party_color ?? "#888" }}
                        />
                      )}
                      <span className="text-xs text-muted-foreground">
                        {d.party_acronym ?? "Sin grupo"}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="font-mono text-sm font-semibold tabular-nums text-accent">
                      {d.divergence_count}
                    </span>
                    <span className="ml-1 text-xs text-muted-foreground">
                      {d.divergence_count === 1 ? "divergencia" : "divergencias"}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </ResponsiveLink>
          )
        })}
      </div>
    </div>
  )
}
