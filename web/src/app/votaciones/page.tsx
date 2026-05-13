import { supabase } from "@/lib/supabase/client"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ExceptionBadge } from "@/components/domain/ExceptionBadge"
import { PageHeader } from "@/components/domain/PageHeader"

export const revalidate = 3600

interface SessionRow {
  id: string
  title: string
  session_number: number
  date: string
  initiative_number?: string
  votes: Array<{ count: number }>
}

interface VoteWithPartyRow {
  voting_session_id: string
  vote: string
  membership: {
    party_id: string | null
  } | null
}

export default async function VotacionesPage() {
  const { data: sessions } = await supabase
    .from("voting_sessions")
    .select("*, votes(count)")
    .order("date", { ascending: false })

  const { data: voteRows } = await supabase
    .from("votes")
    .select("voting_session_id, vote, membership:politician_memberships!inner(party_id)")
    .eq("membership.is_active", true)

  const groupedVotes: Record<string, Record<string, string[]>> = {}
  for (const row of (voteRows as VoteWithPartyRow[] | null) || []) {
    const partyId = row.membership?.party_id
    if (!partyId) continue
    if (!groupedVotes[row.voting_session_id]) groupedVotes[row.voting_session_id] = {}
    if (!groupedVotes[row.voting_session_id][partyId]) groupedVotes[row.voting_session_id][partyId] = []
    groupedVotes[row.voting_session_id][partyId].push(row.vote)
  }

  const divBySessionId: Record<string, number> = {}
  for (const [sessionId, partyVotes] of Object.entries(groupedVotes)) {
    let divergences = 0
    for (const votes of Object.values(partyVotes)) {
      const voteCounts = votes.reduce<Record<string, number>>((acc, vote) => {
        if (vote === "No vota") return acc
        acc[vote] = (acc[vote] || 0) + 1
        return acc
      }, {})

      const majorityVote = Object.entries(voteCounts).sort((a, b) => b[1] - a[1])[0]?.[0]
      if (!majorityVote) continue

      for (const vote of votes) {
        if (vote !== "No vota" && vote !== majorityVote) divergences++
      }
    }
    divBySessionId[sessionId] = divergences
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Votaciones"
        description="Sesiones de la XV Legislatura leídas desde el voto individual. Lo relevante no es el bloque uniforme, sino la persona que rompe la disciplina."
      />

      <div className="space-y-3">
        {(sessions as unknown as SessionRow[])?.map((s) => {
          const dateStr = s.date
            ? new Date(s.date).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })
            : ""
          const divCount = divBySessionId[s.id] || 0

          return (
            <Link key={s.id} href={`/votaciones/${s.id}`}>
              <Card className="ui-card-link cursor-pointer bg-card/85">
                <CardContent className="flex items-start gap-3 py-4 sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="text-base font-medium leading-6 text-balance">{s.title}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="shrink-0 text-xs text-muted-foreground">
                        Sesión {s.session_number} · {dateStr}
                      </span>
                      <Badge variant="outline" className="h-5 shrink-0 text-[10px]">
                        {s.votes?.[0]?.count || 0} votos
                      </Badge>
                    </div>
                  </div>
                  {divCount > 0 && (
                    <ExceptionBadge count={divCount} />
                  )}
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
