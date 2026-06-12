import { notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ContextTrail } from "@/components/navigation/ContextTrail"
import { ExceptionBadge } from "@/components/domain/ExceptionBadge"
import { PageHeader } from "@/components/domain/PageHeader"
import { PartyBadge } from "@/components/domain/PartyBadge"
import { VoteBadge } from "@/components/domain/VoteBadge"
import { EntityLink } from "@/components/domain/EntityLink"
import { getVoteColor } from "@/lib/domain-style"
import { getVotingDetailData } from "@/lib/data"

export const revalidate = 3600

interface PageProps {
  params: Promise<{ id: string }>
}

interface VoteRow {
  vote: string
  politician_id: string | null
  politician: {
    id: string
    full_name: string
    politician_memberships: Array<{
      is_active: boolean
      chamber: string | null
      party: { id: string; acronym: string; color: string }
    }>
  } | null
}

export default async function VotacionPage({ params }: PageProps) {
  const { id } = await params
  const { session, votes, initiative } = await getVotingDetailData(id)
  if (!session) notFound()
  const chamber = (session.chamber as string | null) ?? "congress"
  const chamberLabel = chamber === "senate" ? "Senado" : "Congreso"

  const partyGroups: Record<
    string,
    {
      acronym: string
      partyId: string | null
      color: string
      votes: Record<string, number>
      total: number
      deputies: Array<{ name: string; vote: string; politicianId: string | null }>
    }
  > = {}

  for (const vote of (votes as unknown as VoteRow[]) || []) {
    const activeMembership = vote.politician?.politician_memberships?.find(m => m.is_active && m.chamber === chamber)
    const party = activeMembership?.party
    if (!party) continue
    const key = party.acronym
    if (!partyGroups[key]) {
      partyGroups[key] = {
        acronym: key,
        partyId: party.id ?? null,
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

  const divergences: Array<{ name: string; politicianId: string | null; party: string; partyId: string | null; voted: string; partyVoted: string }> = []
  for (const [party, group] of Object.entries(partyGroups)) {
    const majorityVote = Object.entries(group.votes).sort((a, b) => b[1] - a[1])[0]?.[0]
    if (!majorityVote) continue
    for (const deputy of group.deputies) {
      if (deputy.vote !== majorityVote && deputy.vote !== "No vota") {
        divergences.push({
          name: deputy.name,
          politicianId: deputy.politicianId,
          party,
          partyId: group.partyId,
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
    <div className="ui-page">
      <ContextTrail
        section={{ href: "/votaciones", label: "Votaciones" }}
        current={session.title}
        meta={[
          session.session_number ? `Sesión ${session.session_number}` : null,
          session.initiative_number ? `Exp. ${session.initiative_number}` : null,
        ].filter(Boolean).join(" · ") || undefined}
        fallbackHref="/votaciones"
        fallbackLabel="Volver a Votaciones"
        related={[
          initiative
            ? {
                href: `/iniciativas/${initiative.id}`,
                label: "Iniciativa",
                meta: initiative.type ?? undefined,
              }
            : null,
          divergences.length > 0
            ? {
                href: `#divergencias`,
                label: chamber === "senate" ? "Senadores divergentes" : "Diputados divergentes",
                meta: String(divergences.length),
              }
            : null,
          sorted.length > 0
            ? {
                href: `#resultado-por-grupo`,
                label: "Resultado por grupo",
                meta: String(sorted.length),
              }
            : null,
          { href: "/votaciones", label: "Listado" },
        ]}
      />
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
            <Badge variant="outline" className="text-xs">
              {chamberLabel}
            </Badge>
            <span className="text-sm text-muted-foreground">{dateStr}</span>
          </>
        }
      />

      {initiative ? (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-2 py-3 text-sm">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Iniciativa origen</span>
            <EntityLink
              kind="initiative"
              id={initiative.id}
              className="min-w-0 truncate font-medium underline-offset-2 hover:underline"
            >
              {initiative.title ?? `Exp. ${session.initiative_number}`}
            </EntityLink>
          </CardContent>
        </Card>
      ) : null}

      {divergences.length > 0 ? (
        <Card id="divergencias" className="scroll-mt-24 border-accent/35 bg-accent/10">
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
                className="flex flex-wrap items-center gap-2 border-l-2 border-accent pl-3 text-sm"
              >
                <EntityLink kind="politician" id={divergence.politicianId} className="font-medium underline-offset-2 hover:underline">
                  {divergence.name}
                </EntityLink>
                <PartyBadge acronym={divergence.party} className="text-xs" partyId={divergence.partyId} />
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

      <div id="resultado-por-grupo" className="scroll-mt-24 space-y-2">
        {sorted.map(([acronym, group]) => (
          <Card key={acronym}>
            <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:gap-4">
              <div className="flex items-center justify-between gap-3 sm:w-24 sm:shrink-0 sm:flex-col sm:items-start">
                <PartyBadge acronym={acronym} color={group.color} partyId={group.partyId} />
                <span className="text-xs text-muted-foreground sm:hidden">{group.total} votos</span>
              </div>
              <div className="flex-1">
                <div className="flex h-5 overflow-hidden rounded-[2px] bg-muted">
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
                        className="h-2 w-2"
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
          Ver voto individual de cada {chamber === "senate" ? "senador" : "diputado"}
        </summary>
        <div className="mt-3 max-h-96 overflow-y-auto rounded-[2px] border border-border bg-card p-3">
          {sorted.flatMap(([acronym, group]) =>
            group.deputies.map((deputy, index) => (
              <div
                key={`${acronym}-${index}`}
                className="flex items-center justify-between gap-3 border-b border-muted/30 py-1 last:border-0"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <EntityLink kind="politician" id={deputy.politicianId} className="min-w-0 truncate text-xs underline-offset-2 hover:underline">
                    {deputy.name}
                  </EntityLink>
                  <PartyBadge acronym={acronym} color={group.color} partyId={group.partyId} className="shrink-0 text-xs" />
                </div>
                <VoteBadge vote={deputy.vote} className="shrink-0 text-xs" />
              </div>
            ))
          )}
        </div>
      </details>
    </div>
  )
}
