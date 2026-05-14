"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { PageHeader } from "@/components/domain/PageHeader"
import { PartyBadge } from "@/components/domain/PartyBadge"
import { SectionTabs } from "@/components/domain/SectionTabs"
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
    { value: "about", label: "¿Qué son?" },
  ]

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Puertas giratorias"
        description={`${uniquePeople} personas · ${cases.length} movimientos documentados entre sector público y privado.`}
      />

      <SectionTabs tabs={tabs} defaultTab="all">
        {(active) => {
          if (active === "about") {
            return (
              <Card className="bg-card/85">
                <CardHeader>
                  <CardTitle className="text-lg">¿Qué son las puertas giratorias?</CardTitle>
                  <CardDescription>
                    El movimiento de altos cargos entre el sector público y el privado tras finalizar su responsabilidad pública.
                    La Ley 3/2015 regula el régimen de incompatibilidades de los altos cargos de la Administración General del Estado.
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  Fuente: Wikipedia, Civio. La Ley 3/2015 establece un periodo de incompatibilidad de 2 años para altos
                  cargos que pasan al sector privado.
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
                      const personName = entry.person_id ? (
                        <Link href={`/diputados/${entry.person_id}`} className="truncate font-medium hover:underline">
                          {entry.person_name}
                        </Link>
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
                              {entry.private_organization}
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
