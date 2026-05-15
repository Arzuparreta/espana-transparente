import { notFound } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ExceptionBadge } from "@/components/domain/ExceptionBadge"
import { PageHeader } from "@/components/domain/PageHeader"
import { PartyBadge } from "@/components/domain/PartyBadge"
import { VoteBadge } from "@/components/domain/VoteBadge"
import { getVoteColor } from "@/lib/domain-style"
import { getVotingDetailData } from "@/lib/data"

export const revalidate = 3600

interface PageProps {
  params: Promise<{ id: string }>
}

interface VoteRow {
  vote: string
  politician_id: string | null
  politician: { id: string; full_name: string } | null
  membership: { party: { acronym: string; color: string } } | null
}

export default async function VotacionPage({ params }: PageProps) {
  const { id } = await params
  const { session, votes } = await getVotingDetailData(id)
  if (!session) notFound()

  const partyGroups: Record<
    string,
    {
      acronym: string
      color: string
      votes: Record<string, number>
      total: number
      deputies: Array<{ name: string; vote: string; politicianId: string | null }>
    }
  > = {}

  for (const vote of (votes as unknown as VoteRow[]) || []) {
    const party = vote.membership?.party
    if (!party) continue
    const key = party.acronym
    if (!partyGroups[key]) {
      partyGroups[key] = {
        acronym: key,
        color: party.color || "#718096",
        votes: {},
        total: 0,
        deputies: [],
      }
    }
    partyGroups[key].votes[vote.vote] = (partyGroups[key].votes[vote.vote] || 0) + 1
    partyGroups[key].total++
    partyGroups[key].deputies.push({
      name: vote.politician?.full_name || "",
      vote: vote.vote,
      politicianId: vote.politician?.id ?? null,
    })
  }

  const divergences: Array<{ name: string; politicianId: string | null; party: string; voted: string; partyVoted: string }> = []
  for (const [party, group] of Object.entries(partyGroups)) {
    const majorityVote = Object.entries(group.votes).sort((a, b) => b[1] - a[1])[0]?.[0]
    if (!majorityVote) continue
    for (const deputy of group.deputies) {
      if (deputy.vote !== majorityVote && deputy.vote !== "No vota") {
        divergences.push({
          name: deputy.name,
          politicianId: deputy.politicianId,
          party,
          voted: deputy.vote,
          partyVoted: majorityVote,
        })
      }
    }
  }

  const order = ["PP", "PSOE", "VOX", "SUMAR", "ERC", "JUNTS", "EH Bildu", "EAJ-PNV"]
  const sorted = Object.entries(partyGroups).sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
  const dateStr = session.date
    ? new Date(session.date).toLocaleDateString("es-ES", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : ""

  return (
    <div className="space-y-6">
      <PageHeader
        title={session.title}
        description={
          session.initiative_number
            ? `Exp. ${session.initiative_number}`
            : "Detalle de la votación y sus divergencias internas."
        }
        eyebrow={
          <>
            <Badge variant="outline" className="text-xs">
              Sesión {session.session_number}
            </Badge>
            <span className="text-sm text-muted-foreground">{dateStr}</span>
          </>
        }
      />

      {divergences.length > 0 ? (
        <Card className="border-amber-200 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/20">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">Divergencias relevantes</CardTitle>
              <ExceptionBadge count={divergences.length} />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {divergences.map((divergence, index) => (
              <div
                key={index}
                className="flex flex-wrap items-center gap-2 border-l-2 border-amber-300 pl-3 text-sm"
              >
                {divergence.politicianId ? (
                  <Link href={`/diputados/${divergence.politicianId}`} className="font-medium underline-offset-2 hover:underline">
                    {divergence.name}
                  </Link>
                ) : (
                  <span className="font-medium">{divergence.name}</span>
                )}
                <PartyBadge acronym={divergence.party} className="text-[11px]" />
                <span className="text-xs">
                  votó <b style={{ color: getVoteColor(divergence.voted) }}>{divergence.voted}</b> ≠{" "}
                  <b style={{ color: getVoteColor(divergence.partyVoted) }}>
                    {divergence.partyVoted}
                  </b>{" "}
                  (su grupo)
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-2">
        {sorted.map(([acronym, group]) => (
          <Card key={acronym} className="bg-card/85">
            <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:gap-4">
              <div className="flex items-center justify-between gap-3 sm:w-24 sm:shrink-0 sm:flex-col sm:items-start">
                <PartyBadge acronym={acronym} color={group.color} />
                <span className="text-xs text-muted-foreground sm:hidden">{group.total} votos</span>
              </div>
              <div className="flex-1">
                <div className="flex h-5 overflow-hidden rounded-full bg-muted">
                  {Object.entries(group.votes)
                    .sort((a, b) => b[1] - a[1])
                    .map(([vote, count]) => (
                      <div
                        key={vote}
                        style={{
                          width: `${(count / group.total) * 100}%`,
                          backgroundColor: getVoteColor(vote),
                        }}
                      />
                    ))}
                </div>
              </div>
              <div className="hidden shrink-0 gap-2 text-xs sm:flex">
                {Object.entries(group.votes)
                  .sort((a, b) => b[1] - a[1])
                  .map(([vote, count]) => (
                    <span key={vote} className="flex items-center gap-1">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: getVoteColor(vote) }}
                      />
                      {count}
                    </span>
                  ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
          Ver voto individual de cada diputado
        </summary>
        <div className="mt-3 max-h-96 space-y-3 overflow-y-auto rounded-2xl border border-border/70 bg-card/70 p-3">
          {sorted.map(([acronym, group]) => (
            <div key={acronym}>
              <div className="mb-2">
                <PartyBadge acronym={acronym} color={group.color} className="text-[11px]" />
              </div>
              {group.deputies.map((deputy, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between gap-3 border-b border-muted/30 py-1 last:border-0"
                >
                  {deputy.politicianId ? (
                    <Link
                      href={`/diputados/${deputy.politicianId}`}
                      className="min-w-0 flex-1 truncate text-xs underline-offset-2 hover:underline"
                    >
                      {deputy.name}
                    </Link>
                  ) : (
                    <span className="min-w-0 flex-1 truncate text-xs">{deputy.name}</span>
                  )}
                  <VoteBadge vote={deputy.vote} className="text-[11px]" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </details>
    </div>
  )
}
