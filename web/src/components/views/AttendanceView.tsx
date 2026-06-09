import { EmptyState } from "@/components/domain/EmptyState"
import { Pagination } from "@/components/domain/Pagination"
import { SourceFootnote } from "@/components/domain/SourceFootnote"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import {
  getAttendanceRanking,
  getEtlLastFinished,
  PAGE_SIZE,
  parseAttendanceSort,
  parsePage,
} from "@/lib/data"
import { getResponsivePhoto } from "@/lib/photos"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { ArrowDown, ArrowUp } from "lucide-react"
import type { AttendanceSortDirection, AttendanceSortField } from "@/lib/data"

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

export interface AttendanceViewProps {
  searchParams?: Promise<{
    page?: string
    party?: string
    sort?: string
    direction?: string
  }>
}

export async function AttendanceView({ searchParams }: AttendanceViewProps) {
  const params = await searchParams
  const page = parsePage(params?.page)
  const activeParty = params?.party?.trim() || null
  const { sort, direction } = parseAttendanceSort(params?.sort, params?.direction)

  const hrefForSort = (field: AttendanceSortField) => {
    const qs = new URLSearchParams()
    const nextDirection: AttendanceSortDirection =
      sort === field
        ? direction === "desc"
          ? "asc"
          : "desc"
        : field === "full_name" || field === "party_acronym"
          ? "asc"
          : "desc"
    if (activeParty) qs.set("party", activeParty)
    qs.set("sort", field)
    qs.set("direction", nextDirection)
    return `/diputados?view=asistencia&${qs.toString()}`
  }

  const hrefForParty = (party: string | null) => {
    const qs = new URLSearchParams()
    if (party) qs.set("party", party)
    if (sort !== "attendance_pct" || direction !== "desc") {
      qs.set("sort", sort)
      qs.set("direction", direction)
    }
    const value = qs.toString()
    return `/diputados?view=asistencia${value ? `&${value}` : ""}`
  }

  const [{ status, rows, total, parties }, lastChecked] = await Promise.all([
    getAttendanceRanking(page, activeParty, sort, direction),
    getEtlLastFinished(["congreso.asistencia"]),
  ])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE.attendance))

  return (
    <div className="space-y-6 sm:space-y-8">
      <SourceFootnote
        sourceLabel="Congreso de los Diputados"
        lastChecked={lastChecked}
        coverageLabel={status === "ok" ? `${total.toLocaleString("es-ES")} diputados` : "Consulta no disponible"}
      />

      {/* Party filter pills */}
      {parties.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <ResponsiveLink
            href={hrefForParty(null)}
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
              href={hrefForParty(p.acronym)}
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

      {status === "unavailable" ? (
        <EmptyState
          title="Datos temporalmente no disponibles"
          description="No se ha podido consultar la fuente de datos. Los registros no se han eliminado; vuelve a intentarlo más tarde."
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title="Sin registros"
          description={
            activeParty
              ? "Ningún diputado de este grupo tiene registro de asistencia en la muestra actual."
              : "No hay registros de asistencia publicados en la muestra actual."
          }
        />
      ) : (
        <>
          <div className="space-y-2 sm:hidden">
            <div className="flex flex-wrap items-center gap-1.5" aria-label="Ordenar diputados">
              <span className="mr-1 text-xs text-muted-foreground">Ordenar por</span>
              {(
                [
                  ["full_name", "Diputado"],
                  ["party_acronym", "Grupo"],
                  ["total_sessions", "Sesiones"],
                  ["sessions_present", "Presente"],
                  ["attendance_pct", "Asistencia"],
                ] as const
              ).map(([field, label]) => {
                const active = sort === field
                const Icon = direction === "asc" ? ArrowUp : ArrowDown
                return (
                  <ResponsiveLink
                    key={field}
                    href={hrefForSort(field)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded border px-2 py-1 text-xs transition-colors",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground hover:text-foreground"
                    )}
                    aria-label={`Ordenar por ${label}${active ? `, actualmente ${direction === "asc" ? "ascendente" : "descendente"}` : ""}`}
                  >
                    {label}
                    {active && <Icon className="size-3" aria-hidden="true" />}
                  </ResponsiveLink>
                )
              })}
            </div>

            <div className="divide-y divide-border/40 overflow-hidden rounded-[2px] border border-border bg-card">
              {rows.map((row, idx) => {
                const photo = getResponsivePhoto(row.photo_url, row.photo_variants)
                const rank = (page - 1) * PAGE_SIZE.attendance + idx + 1
                const pct = row.attendance_pct ?? 0
                return (
                  <article key={row.politician_id} className="space-y-3 p-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="w-6 shrink-0 text-center font-mono text-[10px] tabular-nums text-muted-foreground">
                        {rank}
                      </span>
                      <Avatar className="size-9 shrink-0">
                        <AvatarImage src={photo.src} srcSet={photo.srcSet} sizes={photo.sizes} alt="" />
                        <AvatarFallback className="text-[10px]">{initials(row.full_name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <ResponsiveLink
                          href={`/diputados/${row.politician_id}`}
                          className="block truncate font-medium underline-offset-2 hover:underline"
                        >
                          {row.full_name}
                        </ResponsiveLink>
                        <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                          {row.party_acronym && (
                            <span
                              className="inline-block size-2 shrink-0 rounded-full"
                              style={{ backgroundColor: row.party_color ?? "#888" }}
                            />
                          )}
                          {row.party_acronym ?? "Sin grupo"}
                        </span>
                      </div>
                    </div>

                    <dl className="grid grid-cols-1 gap-2 border-t border-border/40 pt-2.5 text-right min-[360px]:grid-cols-3 sm:grid-cols-3">
                      <div>
                        <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Sesiones</dt>
                        <dd className="mt-0.5 font-mono text-sm tabular-nums">
                          {row.total_sessions.toLocaleString("es-ES")}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Presente</dt>
                        <dd className="mt-0.5 font-mono text-sm tabular-nums">
                          {row.sessions_present.toLocaleString("es-ES")}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Asistencia</dt>
                        <dd
                          className={cn(
                            "mt-0.5 font-mono text-sm font-medium tabular-nums",
                            pct >= 90 ? "text-green-500" : pct >= 75 ? "text-foreground" : "text-accent"
                          )}
                        >
                          {pct.toFixed(1)}%
                        </dd>
                      </div>
                    </dl>
                  </article>
                )
              })}
            </div>
          </div>

          <div className="hidden overflow-hidden rounded-[2px] border border-border bg-card sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 text-xs text-muted-foreground">
                  {(
                    [
                      ["full_name", "Diputado", "text-left"],
                      ["party_acronym", "Grupo", "text-left"],
                      ["total_sessions", "Sesiones", "text-right"],
                      ["sessions_present", "Presente", "hidden text-right md:table-cell"],
                      ["attendance_pct", "Asistencia", "text-right"],
                    ] as const
                  ).map(([field, label, align]) => {
                    const active = sort === field
                    const Icon = direction === "asc" ? ArrowUp : ArrowDown
                    return (
                      <th
                        key={field}
                        className={cn("px-4 py-3 font-medium", align)}
                        aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
                      >
                        <ResponsiveLink
                          href={hrefForSort(field)}
                          className={cn(
                            "inline-flex items-center gap-1 underline-offset-4 hover:text-foreground hover:underline",
                            align.includes("text-right") && "justify-end"
                          )}
                        >
                          {label}
                          {active && <Icon className="size-3.5" aria-hidden="true" />}
                        </ResponsiveLink>
                      </th>
                    )
                  })}
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
                              rank <= 3 && sort === "attendance_pct" && direction === "desc"
                                ? "text-accent"
                                : "text-muted-foreground"
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
        </>
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        hrefForPage={(p) => {
          const qs = new URLSearchParams()
          if (p > 1) qs.set("page", String(p))
          if (activeParty) qs.set("party", activeParty)
          if (sort !== "attendance_pct" || direction !== "desc") {
            qs.set("sort", sort)
            qs.set("direction", direction)
          }
          const s = qs.toString()
          return `/diputados?view=asistencia${s ? `&${s}` : ""}`
        }}
      />
    </div>
  )
}
