"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { PageHeader } from "@/components/domain/PageHeader"
import { PartyBadge } from "@/components/domain/PartyBadge"
import { SectionTabs } from "@/components/domain/SectionTabs"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import type { RDCase } from "@/app/puertas-giratorias/page"

interface RevolvingDoorExplorerProps {
  cases: RDCase[]
}

export function RevolvingDoorExplorer({ cases }: RevolvingDoorExplorerProps) {
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
        description={`${uniquePeople} personas · ${cases.length} movimientos documentados con fuente pública.`}
      />

      <SectionTabs tabs={tabs} defaultTab="all">
        {(active) => {
          if (active === "sources") {
            return (
              <Card className="bg-card/85">
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
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    Sin datos en este sector.
                  </CardContent>
                </Card>
              ) : (
                <Card className="bg-card/85">
                  <CardContent className="space-y-3 p-4 sm:p-6">
                    {filtered.map((entry, index) => {
                      const primarySource =
                        entry.sources?.find((source) => source.source_type === "primary")?.source_url ||
                        entry.primary_source_url ||
                        entry.source_url
                      const sourceName =
                        entry.sources?.find((source) => source.source_type === "primary")?.source_name ||
                        (entry.primary_source_url || entry.source_url ? "Fuente" : null)
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
                          className="flex items-start gap-2 border-l-2 border-muted py-1 pl-2 text-xs sm:pl-3 sm:text-sm"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {personName}
                              {entry.political_party ? (
                                <PartyBadge acronym={entry.political_party} className="text-[10px]" />
                              ) : null}
                            </div>
                            <div className="mt-0.5 text-[11px] text-muted-foreground sm:text-xs">
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
                            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
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
