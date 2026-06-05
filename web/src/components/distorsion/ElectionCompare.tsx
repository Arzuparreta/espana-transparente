"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { cn } from "@/lib/utils"

interface PartyResult {
  party: string
  partyShortName: string
  color: string
  votes: number
  seats: number
  pctVote: number
  votesPerSeat: number
  pctSeats: number
}

interface ElectionCompareProps {
  dates: string[]
  activeDate: string
  results: PartyResult[]
  compareResults: PartyResult[] | null
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })
}

export function ElectionCompare({ dates, activeDate, results, compareResults }: ElectionCompareProps) {
  const otherDates = dates.filter((d) => d !== activeDate)

  if (!compareResults) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Comparar con otra elección</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1.5">
            {otherDates.map((date) => (
              <ResponsiveLink
                key={date}
                href={`/distorsion?date=${activeDate}&compare=${date}`}
                className="rounded border border-border px-2.5 py-1 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                vs {formatDate(date)}
              </ResponsiveLink>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  // Build map of compare results by party
  const compareByParty = new Map(compareResults.map((r) => [r.party, r]))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Comparativa: {formatDate(activeDate)} vs {formatDate(compareResults[0]?.party ? otherDates.find((d) => d !== activeDate) ?? "" : "")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="grid grid-cols-4 gap-2 text-xs font-medium text-muted-foreground sm:grid-cols-5">
          <span>Partido</span>
          <span className="text-right">Escaños</span>
          <span className="hidden text-right sm:block">% Votos</span>
          <span className="text-right">Cambio esc.</span>
          <span className="text-right">Cambio %</span>
        </div>
        {results.map((result) => {
          const prev = compareByParty.get(result.party)
          const seatChange = prev ? result.seats - prev.seats : null
          const votePctChange = prev ? result.pctVote - prev.pctVote : null

          return (
            <div key={result.party} className="grid grid-cols-4 gap-2 border-t border-border/40 py-2 text-xs sm:grid-cols-5">
              <span className="font-medium" style={{ color: result.color }}>
                {result.partyShortName}
              </span>
              <span className="text-right font-mono">{result.seats}</span>
              <span className="hidden text-right font-mono sm:block">{result.pctVote.toFixed(1)}%</span>
              <span
                className={cn(
                  "text-right font-mono",
                  seatChange == null ? "text-muted-foreground" : seatChange > 0 ? "text-green-600 dark:text-green-400" : seatChange < 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"
                )}
              >
                {seatChange == null ? "—" : `${seatChange > 0 ? "+" : ""}${seatChange}`}
              </span>
              <span
                className={cn(
                  "text-right font-mono",
                  votePctChange == null ? "text-muted-foreground" : votePctChange > 0 ? "text-green-600 dark:text-green-400" : votePctChange < 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"
                )}
              >
                {votePctChange == null ? "—" : `${votePctChange > 0 ? "+" : ""}${votePctChange.toFixed(1)}%`}
              </span>
            </div>
          )
        })}
        <div className="flex flex-wrap gap-1.5 pt-2">
          <ResponsiveLink
            href={`/distorsion?date=${activeDate}`}
            className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Cerrar comparativa
          </ResponsiveLink>
        </div>
      </CardContent>
    </Card>
  )
}
