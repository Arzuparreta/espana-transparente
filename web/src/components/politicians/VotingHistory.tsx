import { Card, CardContent } from "@/components/ui/card"
import { VoteBadge } from "@/components/domain/VoteBadge"
import type { Vote } from "@/types"

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
          <Card key={i} className="bg-card/80">
            <CardContent className="flex items-start gap-3 px-4 py-4">
              <div className="shrink-0 mt-0.5">
                <VoteBadge vote={v.vote} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-balance">{session?.title}</div>
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
