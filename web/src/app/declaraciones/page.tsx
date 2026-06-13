import { EmptyState } from "@/components/domain/EmptyState"
import { LinkTabs } from "@/components/domain/LinkTabs"
import { PageHeader } from "@/components/domain/PageHeader"
import { Pagination } from "@/components/domain/Pagination"
import { SourceFootnote } from "@/components/domain/SourceFootnote"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import {
  getDeclarationsPage,
  parseDeclarationSort,
  parsePage,
  PAGE_SIZE,
  type DeclarationSortField,
  type SortDirection,
} from "@/lib/data"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { ArrowDown, ArrowUp, Search } from "lucide-react"

export const revalidate = 3600

export const metadata = {
  title: "Declaraciones económicas",
  description: "Registro de bienes, rentas, actividades e intereses económicos declarados por los diputados del Congreso.",
}

const TIPO_LABELS: Record<string, string> = {
  bienes: "Bienes y rentas",
  actividades: "Actividades",
  intereses: "Intereses económicos",
}

function fmtEuro(value: number | null): string {
  if (!value || value <= 0) return "—"
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(value: string | null): string {
  if (!value) return "Documento vigente"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "Documento vigente"
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })
}

function sourceHost(url: string | null): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return null
  }
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
  searchParams?: Promise<{ tipo?: string; page?: string; party?: string; search?: string; sort?: string; direction?: string }>
}

export default async function DeclaracionesPage({ searchParams }: PageProps) {
  const params = await searchParams
  const tipo = params?.tipo ?? "bienes"
  const page = parsePage(params?.page)
  const activeParty = params?.party?.trim() || null
  const searchQuery = params?.search?.trim() || null
  const { sort, direction } = parseDeclarationSort(params?.sort, params?.direction)

  const typeMap: Record<string, string> = {
    bienes: "bienes_rentas",
    actividades: "actividades",
    intereses: "intereses_economicos",
  }
  const dbType = typeMap[tipo] ?? "bienes_rentas"

  const [{ rows, total, parties }, latestDateResult] = await Promise.all([
    getDeclarationsPage(page, dbType as "bienes_rentas" | "actividades" | "intereses_economicos" | null, activeParty, searchQuery, sort, direction),
    getDeclarationsPage(1, dbType as "bienes_rentas" | "actividades" | "intereses_economicos" | null, null, null, "declaration_date", "desc"),
  ])

  const latestDate = latestDateResult.rows[0]?.declaration_date ?? null
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE.declarations))

  const hrefForSort = (field: DeclarationSortField) => {
    const qs = new URLSearchParams()
    const nextDirection: SortDirection =
      sort === field
        ? direction === "desc"
          ? "asc"
          : "desc"
        : field === "politician_name"
        ? "asc"
        : "desc"
    if (activeParty) qs.set("party", activeParty)
    if (searchQuery) qs.set("search", searchQuery)
    qs.set("sort", field)
    qs.set("direction", nextDirection)
    return `/declaraciones?tipo=${tipo}&${qs.toString()}`
  }

  const hrefForParty = (party: string | null) => {
    const qs = new URLSearchParams()
    if (party) qs.set("party", party)
    if (searchQuery) qs.set("search", searchQuery)
    if (sort !== "declared_income" || direction !== "desc") {
      qs.set("sort", sort)
      qs.set("direction", direction)
    }
    const value = qs.toString()
    return `/declaraciones?tipo=${tipo}${value ? `&${value}` : ""}`
  }

  const baseSearchUrl = (() => {
    const qs = new URLSearchParams()
    qs.set("tipo", tipo)
    if (activeParty) qs.set("party", activeParty)
    if (sort !== "declared_income" || direction !== "desc") {
      qs.set("sort", sort)
      qs.set("direction", direction)
    }
    return `/declaraciones?${qs.toString()}`
  })()

  const tabs = [
    { href: `/declaraciones?tipo=bienes`, label: TIPO_LABELS.bienes, active: tipo === "bienes" },
    { href: `/declaraciones?tipo=actividades`, label: TIPO_LABELS.actividades, active: tipo === "actividades" },
    { href: `/declaraciones?tipo=intereses`, label: TIPO_LABELS.intereses, active: tipo === "intereses" },
  ]

  return (
    <div className="ui-page space-y-6 sm:space-y-8">
      <PageHeader
        title="Declaraciones económicas"
        description="Registro de bienes, rentas, actividades e intereses económicos presentados por los diputados al tomar posesión y al cesar en el cargo."
      />

      <SourceFootnote
        sourceLabel="Congreso de los Diputados"
        latestRecordDate={latestDate}
        coverageLabel={`${total.toLocaleString("es-ES")} declaraciones`}
      />

      <LinkTabs tabs={tabs} ariaLabel="Tipo de declaración" scroll={false} />

      {/* ── Filters ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Search */}
        <form action={baseSearchUrl} method="GET" className="relative w-full">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            name="search"
            type="search"
            placeholder="Buscar por nombre…"
            defaultValue={searchQuery ?? ""}
            className="pl-9"
          />
        </form>

        {/* Party pills */}
        {parties.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <ResponsiveLink
              href={hrefForParty(null)}
              className={cn(
                "rounded px-2.5 py-1 font-mono text-xs transition-colors",
                !activeParty
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-muted-foreground hover:text-foreground"
              )}
            >
              Todos
            </ResponsiveLink>
            {parties.map((p) => (
              <ResponsiveLink
                key={p.acronym}
                href={hrefForParty(p.acronym)}
                className={cn(
                  "rounded px-2.5 py-1 font-mono text-xs transition-colors",
                  activeParty === p.acronym
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {p.acronym}
              </ResponsiveLink>
            ))}
          </div>
        )}
      </div>

      {/* ── Sort controls (mobile) ── */}
      <div className="flex flex-wrap items-center gap-1.5 sm:hidden" aria-label="Ordenar">
        <span className="mr-1 text-xs text-muted-foreground">Ordenar por</span>
        {(
          [
            ["declared_income", tipo === "bienes" ? "Ingresos" : "Fecha"],
            ["declaration_date", "Fecha"],
            ["politician_name", "Diputado"],
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

      {rows.length === 0 ? (
        <EmptyState
          title="Sin resultados"
          description={searchQuery || activeParty ? "No hay declaraciones que coincidan con los filtros aplicados." : "No hay declaraciones de este tipo en la base de datos."}
        />
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-2 sm:hidden">
            {rows.map((row) => {
              const host = sourceHost(row.source_url)
              return (
                <article key={row.id} className="rounded-[2px] border border-border bg-card p-4">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <ResponsiveLink
                        href={`/diputados/${row.politician_id}`}
                        className="block truncate font-medium underline-offset-2 hover:underline"
                      >
                        {row.politician_name ?? "—"}
                      </ResponsiveLink>
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        {row.party_acronym && (
                          <span
                            className="inline-block size-2 shrink-0 rounded-full"
                            style={{ backgroundColor: row.party_color ?? "#888" }}
                          />
                        )}
                        {row.party_acronym ?? "Sin grupo"}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {row.declared_income != null && row.declared_income > 0 ? (
                        <div className="font-mono text-sm font-medium">{fmtEuro(row.declared_income)}</div>
                      ) : (
                        <span className="font-mono text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between border-t border-border/40 pt-2 text-xs text-muted-foreground">
                    <span>{formatDate(row.declaration_date)}</span>
                    {row.source_url && <a href={row.source_url} target="_blank" rel="noopener noreferrer" className="hover:text-foreground hover:underline">{host ?? "Ver PDF"} →</a>}
                  </div>
                </article>
              )
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-[2px] border border-border bg-card sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 text-xs text-muted-foreground">
                  {(
                    [
                      ["politician_name", "Diputado", "text-left"],
                      ["declared_income", tipo === "bienes" ? "Ingresos" : "Fecha", tipo === "bienes" ? "text-right" : "text-left"],
                      ["declaration_date", "Fecha", "text-left"],
                    ] as const
                  ).map(([field, label, align]) => {
                    const active = sort === field
                    const Icon = direction === "asc" ? ArrowUp : ArrowDown
                    return (
                      <th key={field} className={cn("px-4 py-3 font-medium", align)} aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}>
                        <ResponsiveLink
                          href={hrefForSort(field)}
                          className={cn(
                            "inline-flex items-center gap-1 underline-offset-4 hover:text-foreground hover:underline",
                            align === "text-right" && "justify-end"
                          )}
                        >
                          {label}
                          {active && <Icon className="size-3.5" aria-hidden="true" />}
                        </ResponsiveLink>
                      </th>
                    )
                  })}
                  <th className="px-4 py-3 text-right font-medium">Partido</th>
                  <th className="px-4 py-3 text-right font-medium">PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {rows.map((row) => {
                  const host = sourceHost(row.source_url)
                  return (
                    <tr key={row.id} className="transition-colors hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="size-8 shrink-0">
                            <AvatarFallback className="text-[10px]">{row.politician_name ? initials(row.politician_name) : "?"}</AvatarFallback>
                          </Avatar>
                          <ResponsiveLink
                            href={`/declaraciones/${row.id}`}
                            className="min-w-0 font-medium underline-offset-2 hover:underline"
                          >
                            {row.politician_name ?? "—"}
                          </ResponsiveLink>
                        </div>
                      </td>
                      <td className={cn("px-4 py-3", tipo === "bienes" ? "text-right font-mono font-medium" : "text-left text-muted-foreground")}>
                        {row.declared_income != null && row.declared_income > 0 ? (
                          fmtEuro(row.declared_income)
                        ) : (
                          <span className="text-muted-foreground/60">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(row.declaration_date)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="flex items-center justify-end gap-1.5">
                          {row.party_acronym && (
                            <span className="inline-block size-2 rounded-full" style={{ backgroundColor: row.party_color ?? "#888" }} />
                          )}
                          <span className="font-mono text-xs text-muted-foreground">{row.party_acronym ?? "—"}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {row.source_url ? (
                          <a
                            href={row.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                          >
                            {host ?? "Ver"} →
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground/40">—</span>
                        )}
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
          qs.set("tipo", tipo)
          if (p > 1) qs.set("page", String(p))
          if (activeParty) qs.set("party", activeParty)
          if (searchQuery) qs.set("search", searchQuery)
          if (sort !== "declared_income" || direction !== "desc") {
            qs.set("sort", sort)
            qs.set("direction", direction)
          }
          return `/declaraciones?${qs.toString()}`
        }}
      />
    </div>
  )
}