import { EmptyState } from "@/components/domain/EmptyState"
import { PageHeader } from "@/components/domain/PageHeader"
import { Pagination } from "@/components/domain/Pagination"
import { SourceFootnote } from "@/components/domain/SourceFootnote"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { getAttendanceRanking, getEtlLastFinished, PAGE_SIZE, parsePage } from "@/lib/data"
import { getResponsivePhoto } from "@/lib/photos"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

export const revalidate = 3600

export const metadata = {
  title: "Asistencia a plenos",
  description:
    "Ranking de diputados del Congreso por porcentaje de asistencia a sesiones plenarias con voto nominal.",
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

interface PageProps {
  searchParams?: Promise<{ page?: string; party?: string }>
}

export default async function AsistenciaPage({ searchParams }: PageProps) {
  const params = await searchParams
  const page = parsePage(params?.page)
  const activeParty = params?.party?.trim() || null

  const [{ rows, total, parties }, lastChecked] = await Promise.all([
    getAttendanceRanking(page, activeParty),
    getEtlLastFinished(["congreso.asistencia"]),
  ])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE.attendance))

  return (
    <div className="ui-page">
      <PageHeader
        title="Asistencia a plenos"
        description={`Porcentaje de sesiones plenarias con voto nominal en las que cada diputado ha estado presente. Un diputado se considera presente si ha emitido al menos un voto en la sesión. ${total.toLocaleString("es-ES")} diputados con registro.`}
      />

      <SourceFootnote
        sourceLabel="Congreso de los Diputados"
        lastChecked={lastChecked}
        coverageLabel={`${total.toLocaleString("es-ES")} diputados`}
      />

      {/* Party filter pills */}
      {parties.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <ResponsiveLink
            href="/asistencia"
            className={`rounded px-2.5 py-1 font-mono text-xs transition-colors ${
              !activeParty
                ? "bg-primary text-primary-foreground"
                : "border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            Todos
          </ResponsiveLink>
          {parties.map((p) => (
            <ResponsiveLink
              key={p.acronym}
              href={`/asistencia?party=${encodeURIComponent(p.acronym)}`}
              className={`rounded px-2.5 py-1 font-mono text-xs transition-colors ${
                activeParty === p.acronym
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.acronym}
            </ResponsiveLink>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          title="Sin registros"
          description={
            activeParty
              ? "Ningún diputado de este grupo tiene registro de asistencia en la muestra actual."
              : "No hay registros de asistencia publicados en la muestra actual."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-[2px] border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 text-xs text-muted-foreground">
                <th className="px-4 py-3 text-left font-medium">Diputado</th>
                <th className="hidden px-4 py-3 text-left font-medium sm:table-cell">Grupo</th>
                <th className="px-4 py-3 text-right font-medium">Sesiones</th>
                <th className="hidden px-4 py-3 text-right font-medium md:table-cell">Presente</th>
                <th className="px-4 py-3 text-right font-medium">Asistencia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {rows.map((row, idx) => {
                const photo = getResponsivePhoto(row.photo_url, row.photo_variants)
                const rank = (page - 1) * PAGE_SIZE.attendance + idx + 1
                const pct = row.attendance_pct ?? 0
                return (
                  <tr key={row.politician_id} className="transition-colors hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            "flex h-6 w-6 shrink-0 items-center justify-center font-mono text-[10px] tabular-nums",
                            rank <= 3 ? "text-accent" : "text-muted-foreground"
                          )}
                        >
                          {rank}
                        </span>
                        <Avatar className="size-8 shrink-0">
                          <AvatarImage
                            src={photo.src}
                            srcSet={photo.srcSet}
                            sizes={photo.sizes}
                            alt=""
                          />
                          <AvatarFallback className="text-[10px]">
                            {initials(row.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <ResponsiveLink
                          href={`/diputados/${row.politician_id}`}
                          className="min-w-0 font-medium underline-offset-2 hover:underline"
                        >
                          {row.full_name}
                        </ResponsiveLink>
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                      <span className="flex items-center gap-1.5">
                        {row.party_acronym && (
                          <span
                            className="inline-block h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: row.party_color ?? "#888" }}
                          />
                        )}
                        {row.party_acronym ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                      {row.total_sessions.toLocaleString("es-ES")}
                    </td>
                    <td className="hidden px-4 py-3 text-right font-mono text-muted-foreground md:table-cell">
                      {row.sessions_present.toLocaleString("es-ES")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={cn(
                          "font-mono font-medium tabular-nums",
                          pct >= 90 ? "text-green-500" : pct >= 75 ? "text-foreground" : "text-accent"
                        )}
                      >
                        {pct.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        hrefForPage={(p) => {
          const qs = new URLSearchParams()
          if (p > 1) qs.set("page", String(p))
          if (activeParty) qs.set("party", activeParty)
          const s = qs.toString()
          return `/asistencia${s ? `?${s}` : ""}`
        }}
      />
    </div>
  )
}
