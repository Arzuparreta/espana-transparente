"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { EmptyState } from "@/components/domain/EmptyState"
import { PageHeader } from "@/components/domain/PageHeader"
import { PartyBadge } from "@/components/domain/PartyBadge"
import { SectionTabs } from "@/components/domain/SectionTabs"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import type { RDCase } from "@/app/puertas-giratorias/page"

interface RevolvingDoorExplorerProps {
  cases: RDCase[]
  partyMap?: Record<string, string>
}

export function RevolvingDoorExplorer({ cases, partyMap = {} }: RevolvingDoorExplorerProps) {
  const uniquePeople = new Set(cases.map((entry) => entry.person_name)).size
  const sectors = Array.from(new Set(cases.map((entry) => entry.sector || "Sin clasificar"))).sort()
  const tabs = [
    { value: "all", label: `Todos (${cases.length})` },
    ...sectors.map((sector) => ({ value: sector, label: sector })),
    { value: "sources", label: "Fuentes" },
  ]

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Puertas giratorias"
        description={`Personas que ocuparon un cargo público y después pasaron a trabajar en empresas relacionadas con decisiones tomadas durante ese cargo. ${uniquePeople} personas · ${cases.length} movimientos documentados con fuente pública.`}
      />

      <SectionTabs tabs={tabs} defaultTab="all">
        {(active) => {
          if (active === "sources") {
            return (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Fuentes registradas</CardTitle>
                  <CardDescription>
                    Cada movimiento puede incluir una o varias fuentes públicas asociadas.
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  Tipos de fuente: registros mercantiles, documentos societarios, registros de gobierno corporativo,
                  páginas corporativas, resoluciones públicas y repositorios documentales.
                </CardContent>
              </Card>
            )
          }

          const filtered = active === "all"
            ? cases
            : cases.filter((entry) => (entry.sector || "Sin clasificar") === active)

          return (
            <div className="space-y-6">
              {filtered.length === 0 ? (
                <EmptyState title="Sin movimientos" description="No hay registros publicados en este sector." />
              ) : (
                <Card>
                  <CardContent className="space-y-3 p-4 sm:p-6">
                    {filtered.map((entry, index) => {
                      const GENERIC_SOURCE = "es.wikipedia.org/wiki/Puerta_giratoria"
                      const primarySource = (() => {
                        const url =
                          entry.sources?.find((s) => s.source_type === "primary")?.source_url ||
                          entry.primary_source_url ||
                          entry.source_url
                        return url && !url.includes(GENERIC_SOURCE) ? url : null
                      })()
                      const sourceName =
                        entry.sources?.find((s) => s.source_type === "primary")?.source_name ||
                        (primarySource ? "Fuente" : null)
                      const personName = entry.person_id ? (
                        <ResponsiveLink href={`/diputados/${entry.person_id}`} className="truncate font-medium hover:underline">
                          {entry.person_name}
                        </ResponsiveLink>
                      ) : (
                        <span className="truncate font-medium">{entry.person_name}</span>
                      )

                      return (
                        <div
                          key={`${entry.person_name}-${entry.private_organization}-${index}`}
                          className="rounded-xl border border-border/60 bg-background/70 px-3 py-3 text-xs sm:text-sm"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {personName}
                              {entry.political_party ? (
                                <PartyBadge
                                  acronym={entry.political_party}
                                  partyId={partyMap[entry.political_party.toLowerCase()] ?? null}
                                  className="text-xs"
                                />
                              ) : null}
                            </div>
                            <div className="mt-0.5 text-xs text-muted-foreground sm:text-xs">
                              {entry.public_role} en {entry.public_organization}{" -> "}
                              <span className="font-medium text-foreground">{entry.private_role}</span> en{" "}
                              {entry.organization_id ? (
                                <ResponsiveLink
                                  href={`/organizaciones/${entry.organization_id}`}
                                  className="font-medium text-foreground underline-offset-4 hover:underline"
                                >
                                  {entry.private_organization}
                                </ResponsiveLink>
                              ) : (
                                entry.private_organization
                              )}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                              {entry.public_exit_date ? (
                                <span>Cese: {formatDate(entry.public_exit_date)}</span>
                              ) : null}
                              {entry.private_start_date ? (
                                <span>Inicio privado: {formatDate(entry.private_start_date)}</span>
                              ) : null}
                              {entry.authorization_date ? (
                                <span>Autorización: {formatDate(entry.authorization_date)}</span>
                              ) : null}
                              {entry.cooling_off_months != null ? (
                                <span>{entry.cooling_off_months} meses entre fechas registradas</span>
                              ) : null}
                              {primarySource ? (
                                <a
                                  href={primarySource}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="font-medium text-foreground underline-offset-4 hover:underline"
                                >
                                  {sourceName}
                                </a>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </CardContent>
                </Card>
              )}
            </div>
          )
        }}
      </SectionTabs>
    </div>
  )
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}
