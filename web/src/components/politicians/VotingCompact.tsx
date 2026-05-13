import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { Vote } from "@/types"

const VOTE_COLORS: Record<string, string> = {
  Sí: "#22c55e", No: "#ef4444", Abstención: "#f59e0b", "No vota": "#9ca3af",
}

interface VotingCompactProps {
  votes: Vote[]
}

export function VotingCompact({ votes }: VotingCompactProps) {
  if (!votes || votes.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No hay votaciones registradas.
        </CardContent>
      </Card>
    )
  }

  // Group by voting session
  const sessions: Record<string, { title: string; date: string; exp: string | null; votes: Vote[] }> = {}
  for (const v of votes) {
    const s = v.voting_sessions
    if (!s) continue
    const key = s.title || ""
    if (!sessions[key]) sessions[key] = { title: s.title, date: s.date, exp: s.initiative_number, votes: [] }
    sessions[key].votes.push(v)
  }

  return (
    <div className="space-y-4">
      {Object.entries(sessions).map(([key, session]) => {
        // Group votes by party-line within this session
        const partyVotes: Record<string, { vote: string; count: number }> = {}
        for (const v of session.votes) {
          // We need party info - but Vote type doesn't include party
          // So we show the raw votes for each session
          const vv = v.vote
          partyVotes[vv] = { vote: vv, count: (partyVotes[vv]?.count || 0) + 1 }
        }

        const dateStr = session.date
          ? new Date(session.date).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })
          : ""

        return (
          <Card key={key}>
            <CardContent className="py-4 space-y-3">
              <div>
                <div className="font-medium text-sm">{session.title}</div>
                <div className="text-xs text-muted-foreground">
                  {dateStr}
                  {session.exp && ` · Exp. ${session.exp}`}
                </div>
              </div>

              {/* Compact vote distribution */}
              <div className="flex items-center gap-4 flex-wrap">
                {Object.entries(partyVotes).map(([vote, info]) => {
                  const total = session.votes.length
                  const pct = Math.round((info.count / total) * 100)
                  return (
                    <div key={vote} className="flex items-center gap-1.5">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: VOTE_COLORS[vote] || "#9ca3af" }}
                      />
                      <span className="text-sm font-medium">{vote}</span>
                      <span className="text-sm text-muted-foreground">
                        {info.count} ({pct}%)
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* Bar visualization */}
              <div className="flex h-2 rounded-full overflow-hidden bg-muted">
                {Object.entries(partyVotes).map(([vote, info]) => {
                  const total = session.votes.length
                  const pct = (info.count / total) * 100
                  return (
                    <div
                      key={vote}
                      style={{
                        width: `${pct}%`,
                        backgroundColor: VOTE_COLORS[vote] || "#9ca3af",
                      }}
                    />
                  )
                })}
              </div>

              {/* Expand button for individual votes */}
              <details className="text-sm">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground text-xs">
                  Ver desglose por diputado ({session.votes.length} votos)
                </summary>
                <div className="mt-2 space-y-1 max-h-60 overflow-y-auto">
                  {session.votes.slice(0, 30).map((v, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs py-0.5">
                      <Badge
                        variant="outline"
                        className="text-[10px] h-4 px-1 font-bold"
                        style={{
                          color: VOTE_COLORS[v.vote] || "#9ca3af",
                          borderColor: VOTE_COLORS[v.vote] || "#9ca3af",
                        }}
                      >
                        {v.vote}
                      </Badge>
                      <span className="truncate">—</span>
                    </div>
                  ))}
                  {session.votes.length > 30 && (
                    <div className="text-xs text-muted-foreground text-center py-1">
                      + {session.votes.length - 30} diputados más
                    </div>
                  )}
                </div>
              </details>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
