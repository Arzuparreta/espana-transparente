"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { PageHeader } from "@/components/domain/PageHeader"
import { SectionTabs } from "@/components/domain/SectionTabs"

const ELECTION_2023 = {
  date: "23 de julio de 2023",
  totalVotes: 24413509,
  totalSeats: 350,
  census: 37446646,
  participation: 66.0,
  results: [
    { party: "PP", votes: 8094840, seats: 137, color: "#0055A7", pctVote: 33.1 },
    { party: "PSOE", votes: 7821979, seats: 121, color: "#E01021", pctVote: 32.0 },
    { party: "VOX", votes: 3057000, seats: 33, color: "#63BE21", pctVote: 12.4 },
    { party: "SUMAR", votes: 3014006, seats: 31, color: "#E01065", pctVote: 12.3 },
    { party: "ERC", votes: 466020, seats: 7, color: "#FFB232", pctVote: 1.9 },
    { party: "JUNTS", votes: 395429, seats: 7, color: "#20C0C2", pctVote: 1.6 },
    { party: "EH Bildu", votes: 335129, seats: 6, color: "#00D4AA", pctVote: 1.4 },
    { party: "EAJ-PNV", votes: 277289, seats: 5, color: "#008000", pctVote: 1.1 },
    { party: "BNG", votes: 153995, seats: 1, color: "#6CB6FF", pctVote: 0.6 },
    { party: "CCa", votes: 116363, seats: 1, color: "#FFD700", pctVote: 0.5 },
    { party: "UPN", votes: 52544, seats: 1, color: "#2A52BE", pctVote: 0.2 },
  ],
  provinces: [
    { name: "Soria", seats: 2, effectiveThreshold: 25.0, description: "Necesitas ~25% para optar a escaño en provincias de 2 diputados" },
    { name: "Ávila", seats: 3, effectiveThreshold: 16.7, description: "Con 3 escaños, el umbral efectivo es ~17%" },
    { name: "Segovia", seats: 3, effectiveThreshold: 16.7, description: "3 escaños — misma distorsión que Ávila" },
    { name: "Teruel", seats: 3, effectiveThreshold: 16.7, description: "3 escaños, mismo umbral ~17%" },
    { name: "Zamora", seats: 3, effectiveThreshold: 16.7, description: "Provincia de 3 escaños" },
    { name: "Madrid", seats: 37, effectiveThreshold: 1.4, description: "En Madrid (37 escaños), ~1.4% puede bastar" },
    { name: "Barcelona", seats: 32, effectiveThreshold: 1.6, description: "Barcelona (32 escaños), ~1.6% umbral" },
  ],
}

export default function DistorsionElectoralPage() {
  const { results, provinces } = ELECTION_2023

  const withVotesPerSeat = results
    .map((result) => ({
      ...result,
      votesPerSeat: Math.round(result.votes / result.seats),
      pctSeats: (result.seats / 350) * 100,
    }))
    .sort((a, b) => a.votesPerSeat - b.votesPerSeat)

  const maxVotesPerSeat = Math.max(...withVotesPerSeat.map((result) => result.votesPerSeat))
  const minVotesPerSeat = Math.min(...withVotesPerSeat.map((result) => result.votesPerSeat))

  const tabs = [
    { value: "votes-per-seat", label: "Votos por escaño" },
    { value: "pct-votes", label: "% Votos vs % Escaños" },
    { value: "threshold", label: "Umbral provincial" },
  ]

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Distorsión electoral"
        description={`Elecciones generales del ${ELECTION_2023.date} · ${ELECTION_2023.totalSeats} escaños · participación ${ELECTION_2023.participation}%`}
      />

      <SectionTabs tabs={tabs} defaultTab="votes-per-seat">
        {(active) => (
          <>
            {active === "votes-per-seat" ? (
              <Card className="bg-card/85">
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
                          <span className="shrink-0 text-right text-[10px] tabular-nums sm:w-16 sm:text-xs">
                            {result.votesPerSeat.toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <span className="w-8 shrink-0 text-right text-[10px] text-muted-foreground sm:w-12 sm:text-xs">
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
              <Card className="bg-card/85">
                <CardHeader>
                  <CardTitle className="text-lg">% de votos vs % de escaños</CardTitle>
                  <CardDescription>
                    Ningún partido recibe el mismo porcentaje de escaños que de votos.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {withVotesPerSeat.map((result) => {
                    const diff = (result.seats / 350) * 100 - result.pctVote
                    const cls =
                      diff > 1 ? "text-green-600" : diff < -0.5 ? "text-red-600" : "text-muted-foreground"
                    return (
                      <div key={result.party} className="flex flex-wrap items-center gap-1.5 text-xs sm:gap-2 sm:text-sm">
                        <span className="w-10 text-right font-medium sm:w-12" style={{ color: result.color }}>
                          {result.party}
                        </span>
                        <span className="w-14 text-right sm:w-16">{result.pctVote.toFixed(1)}% votos</span>
                        <span className="text-[10px]">→</span>
                        <span className="w-14 font-medium sm:w-16">{((result.seats / 350) * 100).toFixed(1)}% esc.</span>
                        <span className={`ml-1 text-[10px] sm:text-xs ${cls}`}>
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
              <Card className="bg-card/85">
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
    </div>
  )
}
