"use client"

import Link from "next/link"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import type { RDCase } from "@/app/puertas-giratorias/page"

const PARTY_COLORS: Record<string, string> = {
  PP: "#0055A7",
  PSOE: "#E01021",
  VOX: "#63BE21",
  SUMAR: "#E01065",
}

interface RevolvingDoorExplorerProps {
  cases: RDCase[]
}

export function RevolvingDoorExplorer({ cases }: RevolvingDoorExplorerProps) {
  const [active, setActive] = useState("all")

  const uniquePeople = new Set(cases.map((entry) => entry.person_name)).size
  const sectors = Array.from(new Set(cases.map((entry) => entry.sector || "Sin clasificar"))).sort()
  const tabs = [
    { value: "all", label: `Todos (${cases.length})` },
    ...sectors.map((sector) => ({ value: sector, label: sector })),
    { value: "about", label: "¿Qué son?" },
  ]

  const filtered = active === "all"
    ? cases
    : cases.filter((entry) => (entry.sector || "Sin clasificar") === active)

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Puertas giratorias</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {uniquePeople} personas · {cases.length} movimientos documentados entre sector público y privado
        </p>
      </div>

      <div className="flex border-b border-border overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActive(tab.value)}
            className={cn(
              "relative shrink-0 px-3 sm:px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
              active === tab.value ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
            {active === tab.value && <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-foreground rounded-full" />}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {active === "about" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">¿Qué son las puertas giratorias?</CardTitle>
              <CardDescription>
                El movimiento de altos cargos entre el sector público y el privado. Un ex-ministro regula un sector,
                luego ficha por una empresa de ese mismo sector. La información y los contactos obtenidos en el cargo
                público se monetizan en el privado.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Fuente: Wikipedia, Civio. La Ley 5/2006 establece un periodo de incompatibilidad de 2 años para altos
              cargos que pasan al sector privado, pero no impide el movimiento en sí.
            </CardContent>
          </Card>
        )}

        {active !== "about" && (
          <div className="space-y-6">
            {filtered.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Sin datos en este sector.
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-4 sm:p-6 space-y-3">
                  {filtered.map((entry, index) => {
                    const personName = entry.person_id ? (
                      <Link href={`/diputados/${entry.person_id}`} className="font-medium truncate hover:underline">
                        {entry.person_name}
                      </Link>
                    ) : (
                      <span className="font-medium truncate">{entry.person_name}</span>
                    )

                    return (
                      <div key={`${entry.person_name}-${entry.private_organization}-${index}`} className="flex items-start gap-2 text-xs sm:text-sm border-l-2 border-muted pl-2 sm:pl-3 py-1">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {personName}
                            {entry.political_party && (
                              <span
                                className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                                style={{
                                  backgroundColor: (PARTY_COLORS[entry.political_party] || "#718096") + "20",
                                  color: PARTY_COLORS[entry.political_party] || "#718096",
                                }}
                              >
                                {entry.political_party}
                              </span>
                            )}
                          </div>
                          <div className="text-muted-foreground text-[11px] sm:text-xs mt-0.5">
                            {entry.public_role} en {entry.public_organization}{" -> "}
                            <span className="font-medium text-foreground">{entry.private_role}</span> en {entry.private_organization}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
