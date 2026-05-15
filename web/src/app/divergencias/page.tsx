import Link from "next/link"
import Image from "next/image"
import { PageHeader } from "@/components/domain/PageHeader"
import { InfoPanel } from "@/components/domain/InfoPanel"
import { PartyBadge } from "@/components/domain/PartyBadge"
import { getDivergenceRanking } from "@/lib/data"
import { getResponsivePhoto } from "@/lib/photos"

export const revalidate = 3600 * 6

export const metadata = {
  title: "Divergencias internas",
}

export default async function DivergenciasPage() {
  const ranking = await getDivergenceRanking()

  const maxDiv = ranking[0]?.divergence_count ?? 1

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Divergencias internas"
        description={`Diputados que han votado distinto a la mayoría de su grupo parlamentario. ${ranking.length > 0 ? `${ranking.length} diputados con al menos una divergencia registrada.` : ""}`}
      />

      <div className="space-y-2">
        {ranking.map((deputy, i) => {
          const photo = getResponsivePhoto(deputy.photo_url, deputy.photo_variants)
          const barWidth = Math.max(4, Math.round((deputy.divergence_count / maxDiv) * 100))
          const nameFormatted = (deputy.full_name as string)
            .split(",")
            .map((s: string) => s.trim())
            .reverse()
            .join(" ")

          return (
            <Link
              key={deputy.politician_id as string}
              href={`/diputados/${deputy.politician_id}`}
              className="flex min-w-0 items-center gap-4 rounded-xl border border-border/60 bg-card/80 px-4 py-3 transition-colors hover:border-border hover:bg-card"
            >
              {/* Rank */}
              <span className="w-6 shrink-0 text-center text-xs tabular-nums text-muted-foreground">
                {i + 1}
              </span>

              {/* Avatar */}
              <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border border-border/40 bg-muted">
                {photo.src ? (
                  <Image
                    src={photo.src}
                    alt={nameFormatted}
                    fill
                    className="object-cover object-top"
                    sizes="36px"
                    unoptimized
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-xs font-medium text-muted-foreground">
                    {nameFormatted.split(" ").map((w: string) => w[0]).slice(0, 2).join("")}
                  </span>
                )}
              </div>

              {/* Name + bar */}
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex min-w-0 items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-sm font-medium">{nameFormatted}</span>
                  <span className="shrink-0 tabular-nums text-sm font-semibold">
                    {(deputy.divergence_count as number).toLocaleString("es-ES")}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <PartyBadge
                    acronym={deputy.party_acronym as string}
                    color={deputy.party_color as string | undefined}
                  />
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-amber-500/70"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      <InfoPanel title="Metodología">
        Una divergencia se registra cuando un diputado vota distinto a la mayoría de su grupo parlamentario
        en esa sesión. Se excluyen las ausencias (&ldquo;No vota&rdquo;). El cómputo incluye todas las
        sesiones de la XV Legislatura disponibles en la base de datos.
        Los grupos pequeños con posición propia frecuente (CCa, partidos regionales) pueden acumular
        divergencias altas respecto a su grupo sin que ello implique disidencia interna.
      </InfoPanel>
    </div>
  )
}
