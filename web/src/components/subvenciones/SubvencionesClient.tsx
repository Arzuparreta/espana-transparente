"use client"

import { EmptyState } from "@/components/domain/EmptyState"
import { FilterChip } from "@/components/domain/FilterChip"
import { LinkTabs } from "@/components/domain/LinkTabs"
import { Pagination } from "@/components/domain/Pagination"
import { Card, CardContent } from "@/components/ui/card"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { ResponsibleChip, type Responsible } from "@/components/domain/ResponsibleChip"

interface Subvencion {
  id: string
  bdns_id: number
  cod_concesion: string | null
  fecha_concesion: string | null
  beneficiario: string | null
  instrumento: string | null
  importe: number | null
  convocatoria: string | null
  nivel1: string | null
  nivel2: string | null
  nivel3: string | null
  beneficiary_organization_id: string | null
  granting_body_organization_id: string | null
  responsible: Responsible | null
  source_url: string | null
}

interface SubvencionesClientProps {
  activeNivel: string
  activeMinistry?: string | null
  activeTerritory?: string | null
  activeYear?: number | null
  subsidies: Subvencion[]
  page: number
  total: number
  totalPages: number
}

const NIVEL1_LABELS: Record<string, string> = {
  ESTADO: "Estatal",
  AUTONOMICA: "Autonómica",
  LOCAL: "Local",
}

const NIVEL_TABS = [
  { value: "all", label: "Todas" },
  { value: "ESTADO", label: "Estatal" },
  { value: "AUTONOMICA", label: "Autonómica" },
  { value: "LOCAL", label: "Local" },
]

function formatAmount(eur: number | null): string {
  if (eur == null) return "—"
  if (eur >= 1_000_000_000) return `${(eur / 1_000_000_000).toFixed(1).replace(".", ",")} mil M €`
  if (eur >= 1_000_000) return `${(eur / 1_000_000).toFixed(1)}M €`
  if (eur >= 1_000) return `${Math.round(eur / 1_000)}K €`
  return `${Math.round(eur).toLocaleString("es-ES")} €`
}

function nivelClass(nivel1: string | null): string {
  switch (nivel1) {
    case "ESTADO":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
    case "AUTONOMICA":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300"
    case "LOCAL":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
    default:
      return "bg-muted text-muted-foreground"
  }
}

function subvencionesHref(
  nivel: string,
  page = 1,
  ministry?: string | null,
  territory?: string | null,
  year?: number | null
) {
  const params = new URLSearchParams()
  if (nivel !== "all") params.set("nivel", nivel)
  if (page > 1) params.set("page", String(page))
  if (ministry) params.set("ministry", ministry)
  if (territory) params.set("territory", territory)
  if (year) params.set("year", String(year))
  const query = params.toString()
  return query ? `/subvenciones?${query}` : "/subvenciones"
}

function SubvencionCard({ s, activeMinistry }: { s: Subvencion; activeMinistry?: string | null }) {
  const dateStr = s.fecha_concesion
    ? new Date(s.fecha_concesion).toLocaleDateString("es-ES", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null

  const nivelLabel = NIVEL1_LABELS[s.nivel1 ?? ""] ?? s.nivel1 ?? "—"
  const organo = s.nivel3 ?? s.nivel2 ?? "—"

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:gap-4">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-start gap-2">
            <span className={`shrink-0 rounded-[2px] px-2 py-0.5 text-xs font-medium ${nivelClass(s.nivel1)}`}>
              {nivelLabel}
            </span>
            <ResponsibleChip
              responsible={s.responsible}
              ministryHref={s.responsible?.ministry && !activeMinistry ? `/subvenciones?ministry=${encodeURIComponent(s.responsible.ministry)}` : null}
            />
          </div>
          <div className="text-sm font-medium leading-snug">
            {s.beneficiary_organization_id ? (
              <ResponsiveLink
                href={`/organizaciones/${s.beneficiary_organization_id}`}
                className="underline-offset-2 hover:underline"
              >
                {s.beneficiario ?? "—"}
              </ResponsiveLink>
            ) : (
              s.beneficiario ?? "—"
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {s.granting_body_organization_id ? (
              <ResponsiveLink
                href={`/organizaciones/${s.granting_body_organization_id}`}
                className="underline-offset-2 hover:text-foreground hover:underline"
              >
                {organo}
              </ResponsiveLink>
            ) : (
              organo
            )}
          </div>
          {s.convocatoria ? (
            <div className="text-xs text-muted-foreground line-clamp-1">{s.convocatoria}</div>
          ) : null}
          {dateStr ? <div className="text-xs text-muted-foreground">{dateStr}</div> : null}
        </div>
        <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end sm:gap-1">
          <ResponsiveLink
            href={`/subvenciones/${s.id}`}
            className="text-base font-mono font-semibold tabular-nums underline-offset-2 hover:underline"
          >
            {formatAmount(s.importe)}
          </ResponsiveLink>
          <ResponsiveLink
            href={`/subvenciones/${s.id}`}
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            Detalle →
          </ResponsiveLink>
          {s.source_url ? (
            <a
              href={s.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              Ver convocatoria →
            </a>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

export function SubvencionesClient({
  activeNivel,
  activeMinistry,
  activeTerritory,
  activeYear,
  subsidies,
  page,
  total,
  totalPages,
}: SubvencionesClientProps) {
  return (
    <div className="space-y-6">
      <LinkTabs
        ariaLabel="Nivel administrativo"
        scroll={false}
        tabs={NIVEL_TABS.map((tab) => ({
          href: subvencionesHref(tab.value, 1, activeMinistry, activeTerritory, activeYear),
          label: tab.label,
          active: activeNivel === tab.value,
        }))}
      />

      {activeMinistry && (
        <FilterChip
          label="Ministerio"
          value={activeMinistry}
          clearHref={subvencionesHref(activeNivel, 1, null, activeTerritory, activeYear)}
        />
      )}

      {activeTerritory && (
        <FilterChip
          label="Territorio"
          value={activeTerritory.replaceAll("_", " ")}
          clearHref={subvencionesHref(activeNivel, 1, activeMinistry, null, activeYear)}
        />
      )}

      {activeYear && (
        <FilterChip
          label="Año"
          value={String(activeYear)}
          clearHref={subvencionesHref(activeNivel, 1, activeMinistry, activeTerritory, null)}
        />
      )}

      <div className="space-y-2">
        <div className="text-xs text-muted-foreground">
          {total} concesiones · ordenadas por importe
        </div>
        {subsidies.length === 0 ? (
          <EmptyState
            title="Sin concesiones"
            description={<>Ejecuta el ETL: <code>PYTHONPATH=src python -m src.bdns.subvenciones</code></>}
          />
        ) : (
          subsidies.map((s) => <SubvencionCard key={s.id} s={s} activeMinistry={activeMinistry} />)
        )}
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        hrefForPage={(nextPage) =>
          subvencionesHref(activeNivel, nextPage, activeMinistry, activeTerritory, activeYear)
        }
      />
    </div>
  )
}
