import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

// Real 2023 general election results
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
  // Smallest provinces and their effective thresholds
  provinces: [
    { name: "Soria", seats: 2, effectiveThreshold: 25.0, description: "Necesitas ~25% para optar a escaño en provincias de 2 diputados" },
    { name: "Ávila", seats: 3, effectiveThreshold: 16.7, description: "Con 3 escaños, el umbral efectivo es ~17%" },
    { name: "Madrid", seats: 37, effectiveThreshold: 1.4, description: "En Madrid (37 escaños), ~1.4% puede bastar" },
  ],
}

export default function DistorsionElectoralPage() {
  const { results, provinces } = ELECTION_2023

  // Calculate votes per seat
  const withVps = results.map(r => ({
    ...r,
    votesPerSeat: Math.round(r.votes / r.seats),
    pctSeats: (r.seats / 350) * 100,
  })).sort((a, b) => a.votesPerSeat - b.votesPerSeat)

  const maxVps = Math.max(...withVps.map(r => r.votesPerSeat))
  const minVps = Math.min(...withVps.map(r => r.votesPerSeat))

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Distorsión electoral</h1>
        <p className="text-muted-foreground mt-1">
          Elecciones generales del {ELECTION_2023.date} · {ELECTION_2023.totalSeats} escaños · Participación {ELECTION_2023.participation}%
        </p>
      </div>

      {/* Votes per seat comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">¿Cuántos votos cuesta cada escaño?</CardTitle>
          <CardDescription>
            Un escaño no vale lo mismo para todos los partidos. La ley D&apos;Hondt combinada con provincias pequeñas distorsiona la representación.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {withVps.map((r) => {
            return (
              <div key={r.party} className="flex items-center gap-3 text-sm">
                <div className="w-16 text-right font-medium shrink-0" style={{ color: r.color }}>
                  {r.party}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-6 rounded"
                      style={{
                        width: `${Math.max((r.votesPerSeat / maxVps) * 100, 4)}%`,
                        backgroundColor: r.color + "30",
                        borderLeft: `3px solid ${r.color}`,
                      }}
                    />
                    <span className="text-xs shrink-0 w-16 text-right tabular-nums">
                      {r.votesPerSeat.toLocaleString()} votos/esc.
                    </span>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground shrink-0 w-12 text-right">
                  {r.seats} esc.
                </span>
              </div>
            )
          })}

          <div className="text-xs text-muted-foreground pt-2 border-t mt-4">
            Un escaño de {withVps[0]?.party} (&quot;cuesta&quot; {withVps[0]?.votesPerSeat.toLocaleString()} votos) vale económicamente igual que uno de{" "}
            {withVps[withVps.length - 1]?.party} ({withVps[withVps.length - 1]?.votesPerSeat.toLocaleString()} votos).
            La diferencia es de {(maxVps / minVps).toFixed(1)}x.
          </div>
        </CardContent>
      </Card>

      {/* Vote % vs Seat % */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">% de votos vs % de escaños</CardTitle>
          <CardDescription>
            Ningún partido recibe el mismo porcentaje de escaños que de votos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {withVps.map((r) => {
            const diff = (r.seats / 350) * 100 - r.pctVote
            const isOver = diff > 1
            const isUnder = diff < -0.5
            return (
              <div key={r.party} className="flex items-center gap-2 text-sm">
                <span className="w-12 text-right font-medium" style={{ color: r.color }}>{r.party}</span>
                <span className="text-xs w-12 text-right">{r.pctVote.toFixed(1)}% votos</span>
                <span className="text-xs">→</span>
                <span className="text-xs w-12 font-medium">{(r.seats / 350 * 100).toFixed(1)}% esc.</span>
                <span className={`text-xs ml-2 ${isOver ? 'text-green-600' : isUnder ? 'text-red-600' : 'text-muted-foreground'}`}>
                  {diff > 0 ? '+' : ''}{diff.toFixed(1)}%
                </span>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Provincial distortion */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">El umbral real por provincia</CardTitle>
          <CardDescription>
            La ley electoral dice que el umbral es el 3%, pero en las provincias pequeñas el umbral efectivo (el % real para obtener escaño) es mucho mayor.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {provinces.map((p) => (
            <div key={p.name} className="text-sm border-l-2 border-muted pl-3">
              <div className="font-medium">{p.name} — {p.seats} escaños</div>
              <div className="text-muted-foreground text-xs mt-0.5">
                Umbral efectivo: ~{p.effectiveThreshold}%
              </div>
              <div className="text-muted-foreground text-xs">{p.description}</div>
            </div>
          ))}
          <div className="text-xs text-muted-foreground pt-2 border-t">
            En las 27 provincias con 5 o menos escaños (54% del Congreso), el umbral efectivo supera el 10%.
            Partidos con apoyo significativo a nivel nacional (como IU en 2008, con 970K votos y 1 escaño) quedan fuera
            porque sus votos se dispersan en lugar de concentrarse en pocas provincias.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
