import { supabase } from "@/lib/supabase/client"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

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
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Votaciones</h1>
        <p className="text-muted-foreground mt-1">
          Sesiones de votación de la XV Legislatura. Cada voto, enlazado a la persona.
        </p>
      </div>

      <div className="space-y-3">
        {(sessions as unknown as SessionRow[])?.map((s) => {
          const dateStr = s.date
            ? new Date(s.date).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })
            : ""
          const divCount = divBySessionId[s.id] || 0

          return (
            <Link key={s.id} href={`/votaciones/${s.id}`}>
              <Card className="hover:border-primary/30 transition-all cursor-pointer">
                <CardContent className="py-3 sm:py-4 flex items-start justify-between gap-2 sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate">{s.title}</div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs text-muted-foreground shrink-0">
                        Sesión {s.session_number} · {dateStr}
                      </span>
                      <Badge variant="outline" className="text-[10px] h-4 shrink-0">
                        {s.votes?.[0]?.count || 0} votos
                      </Badge>
                    </div>
                  </div>
                  {divCount > 0 && (
                    <Badge className="text-[10px] h-5 shrink-0 bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border-orange-300 dark:border-orange-700">
                      ⚠️ {divCount}
                    </Badge>
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
