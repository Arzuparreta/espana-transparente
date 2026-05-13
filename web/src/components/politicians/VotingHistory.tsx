import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { Vote } from "@/types"

const VOTE_COLORS: Record<string, string> = {
  Sí: "#22c55e",
  No: "#ef4444",
  Abstención: "#f59e0b",
  "No vota": "#9ca3af",
}

interface VotingHistoryProps {
  votes: Vote[]
  politicianId: string
}

export function VotingHistory({ votes }: VotingHistoryProps) {
  if (votes.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No hay votaciones registradas todavía.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {votes.map((v, i) => {
        const session = v.voting_sessions
        const dateStr = session?.date
          ? new Date(session.date).toLocaleDateString("es-ES", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })
          : ""

        return (
          <Card key={i}>
            <CardContent className="py-3 px-4 flex items-start gap-3">
              <div className="shrink-0 mt-0.5">
                <Badge
                  variant="outline"
                  className="font-bold"
                  style={{
                    color: VOTE_COLORS[v.vote] || "#9ca3af",
                    borderColor: VOTE_COLORS[v.vote] || "#9ca3af",
                    backgroundColor:
                      (VOTE_COLORS[v.vote] || "#9ca3af") + "10",
                  }}
                >
                  {v.vote}
                </Badge>
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium">{session?.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {dateStr}
                  {session?.initiative_number &&
                    ` · Exp. ${session.initiative_number}`}
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
