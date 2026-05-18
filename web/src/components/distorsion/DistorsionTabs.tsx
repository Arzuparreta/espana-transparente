"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { SectionTabs } from "@/components/domain/SectionTabs"

interface PartyResult {
  party: string
  color: string
  votes: number
  seats: number
  pctVote: number
  votesPerSeat: number
  pctSeats: number
}

interface Province {
  name: string
  seats: number
  effectiveThreshold: number
  description: string
}

interface DistorsionTabsProps {
  withVotesPerSeat: PartyResult[]
  maxVotesPerSeat: number
  minVotesPerSeat: number
  provinces: Province[]
}

const tabs = [
  { value: "votes-per-seat", label: "Votos por escaño" },
  { value: "pct-votes", label: "% Votos vs % Escaños" },
  { value: "threshold", label: "Umbral provincial" },
]

export function DistorsionTabs({ withVotesPerSeat, maxVotesPerSeat, minVotesPerSeat, provinces }: DistorsionTabsProps) {
  return (
    <SectionTabs tabs={tabs} defaultTab="votes-per-seat">
      {(active) => (
        <>
          {active === "votes-per-seat" ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">¿Cuántos votos cuesta cada escaño?</CardTitle>
                <CardDescription>
                  La ley D&apos;Hondt combinada con provincias pequeñas distorsiona la representación.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {withVotesPerSeat.map((result) => (
                  <div key={result.party} className="flex items-center gap-2 text-xs sm:gap-3 sm:text-sm">
                    <div className="w-10 shrink-0 text-right font-medium sm:w-16" style={{ color: result.color }}>
                      {result.party}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1 sm:gap-2">
                        <div
                          className="h-5 rounded sm:h-6"
                          style={{
                            width: `${Math.max((result.votesPerSeat / maxVotesPerSeat) * 100, 4)}%`,
                            backgroundColor: `${result.color}30`,
                            borderLeft: `3px solid ${result.color}`,
                          }}
                        />
                        <span className="shrink-0 text-right text-xs tabular-nums sm:w-16">
                          {result.votesPerSeat.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <span className="w-8 shrink-0 text-right text-xs text-muted-foreground sm:w-12">
                      {result.seats} esc.
                    </span>
                  </div>
                ))}
                <div className="mt-4 border-t pt-2 text-xs text-muted-foreground">
                  Un escaño de {withVotesPerSeat[0]?.party} (&quot;cuesta&quot;{" "}
                  {withVotesPerSeat[0]?.votesPerSeat.toLocaleString()} votos) vale igual que uno
                  de {withVotesPerSeat[withVotesPerSeat.length - 1]?.party} (
                  {withVotesPerSeat[withVotesPerSeat.length - 1]?.votesPerSeat.toLocaleString()} votos).
                  Diferencia: {(maxVotesPerSeat / minVotesPerSeat).toFixed(1)}x.
                </div>
              </CardContent>
            </Card>
          ) : null}

          {active === "pct-votes" ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">% de votos vs % de escaños</CardTitle>
                <CardDescription>
                  Ningún partido recibe el mismo porcentaje de escaños que de votos.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {withVotesPerSeat.map((result) => {
                  const diff = result.pctSeats - result.pctVote
                  const cls =
                    diff > 1 ? "text-green-600" : diff < -0.5 ? "text-red-600" : "text-muted-foreground"
                  return (
                    <div key={result.party} className="flex flex-wrap items-center gap-1.5 text-xs sm:gap-2 sm:text-sm">
                      <span className="w-10 text-right font-medium sm:w-12" style={{ color: result.color }}>
                        {result.party}
                      </span>
                      <span className="w-14 text-right sm:w-16">{result.pctVote.toFixed(1)}% votos</span>
                      <span className="text-xs">→</span>
                      <span className="w-14 font-medium sm:w-16">{result.pctSeats.toFixed(1)}% esc.</span>
                      <span className={`ml-1 text-xs ${cls}`}>
                        {diff > 0 ? "+" : ""}
                        {diff.toFixed(1)}%
                      </span>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          ) : null}

          {active === "threshold" ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">El umbral real por provincia</CardTitle>
                <CardDescription>
                  La ley dice 3%, pero en provincias pequeñas el umbral efectivo es mucho mayor.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {provinces.map((province) => (
                  <div key={province.name} className="border-l-2 border-muted pl-3 text-sm">
                    <div className="font-medium">
                      {province.name} — {province.seats} escaños
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      Umbral efectivo: ~{province.effectiveThreshold}%
                    </div>
                    <div className="text-xs text-muted-foreground">{province.description}</div>
                  </div>
                ))}
                <div className="border-t pt-2 text-xs text-muted-foreground">
                  En las 27 provincias con 5 o menos escaños (54% del Congreso), el umbral efectivo supera el 10%.
                  Partidos como IU en 2008 (970K votos, 1 escaño) quedan fuera porque sus votos se dispersan.
                </div>
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </SectionTabs>
  )
}
