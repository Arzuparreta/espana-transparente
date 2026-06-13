import { notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ContextTrail } from "@/components/navigation/ContextTrail"
import { ExceptionBadge } from "@/components/domain/ExceptionBadge"
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

  const sorted = Object.entries(partyGroups).sort((a, b) => b[1].total - a[1].total)
  const maxGroupTotal = Math.max(1, ...sorted.map(([, group]) => group.total))

  const VOTE_ORDER = ["Sí", "No", "Abstención", "No vota"] as const
  const totals: Record<string, number> = {}
  for (const vote of (votes as unknown as VoteRow[]) || []) {
    totals[vote.vote] = (totals[vote.vote] || 0) + 1
  }
  const totalRecorded = ((votes as unknown as VoteRow[]) || []).length
  const seatLabel = chamber === "senate" ? "senadores" : "diputados"
  const dateStr = session.date
    ? new Date(session.date).toLocaleDateString("es-ES", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : ""

  // Congress titles are long sentences prefixed by a procedure category
  // ("Dictámenes de Comisiones… - <proposición>"). Split so the category is a
  // small eyebrow and the proposal reads at a humane size, not 48px display caps.
  const titleParts = session.title.split(/\.\s+-\s+/, 2)
  const tipo = titleParts.length === 2 ? titleParts[0].trim() : null
  const descripcion = titleParts.length === 2 ? titleParts[1].trim() : session.title

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
      <section className="flex flex-col gap-3 rounded-[2px] border border-border bg-card px-4 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-xs">
            Sesión {session.session_number}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {chamberLabel}
          </Badge>
          <span className="font-mono text-xs text-muted-foreground">{dateStr}</span>
        </div>
        {tipo ? (
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {tipo}
          </p>
        ) : null}
        <h1 className="max-w-4xl text-xl font-semibold leading-snug text-balance text-foreground sm:text-2xl">
          {descripcion}
        </h1>
        {session.initiative_number ? (
          <p className="font-mono text-xs text-muted-foreground">
            Exp. {session.initiative_number}
          </p>
        ) : null}
      </section>

      {totalRecorded > 0 ? (
        <section
          aria-label="Resultado de la votación"
          className="rounded-[2px] border border-border bg-card p-4 sm:p-5"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Resultado
            </h2>
            <span className="font-mono text-xs text-muted-foreground tabular-nums">
              {totalRecorded} {seatLabel}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {VOTE_ORDER.map((vote) => (
              <div key={vote} className="min-w-0">
                <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                  {vote}
                </div>
                <div
                  data-value
                  className="font-mono text-2xl font-medium tracking-[-0.02em] sm:text-3xl"
                  style={{ color: getVoteColor(vote) }}
                >
                  {totals[vote] ?? 0}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex h-2.5 overflow-hidden rounded-[2px] bg-muted" aria-hidden="true">
            {VOTE_ORDER.filter((vote) => (totals[vote] ?? 0) > 0).map((vote) => (
              <div
                key={vote}
                style={{
                  width: `${((totals[vote] ?? 0) / totalRecorded) * 100}%`,
                  backgroundColor: getVoteColor(vote),
                }}
              />
            ))}
          </div>
        </section>
      ) : null}

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

      <section id="resultado-por-grupo" aria-label="Resultado por grupo" className="scroll-mt-24 space-y-3">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          Resultado por grupo · barra proporcional al tamaño del grupo
        </h2>
        <div className="rounded-[2px] border border-border bg-card">
          {sorted.map(([acronym, group]) => (
            <div
              key={acronym}
              className="flex flex-col gap-2 border-b border-border/60 px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:gap-4"
            >
              <div className="flex min-w-0 items-center justify-between gap-3 sm:w-32 sm:shrink-0">
                <PartyBadge acronym={acronym} color={group.color} partyId={group.partyId} />
                <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                  {group.total}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div
                  className="flex h-4 overflow-hidden rounded-[2px]"
                  style={{ width: `${(group.total / maxGroupTotal) * 100}%`, minWidth: "4px" }}
                >
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
              <div className="flex shrink-0 gap-3 font-mono text-xs tabular-nums">
                {Object.entries(group.votes)
                  .sort((a, b) => b[1] - a[1])
                  .map(([vote, count]) => (
                    <span key={vote} className="flex items-center gap-1.5 text-muted-foreground">
                      <span
                        className="h-2 w-2 shrink-0"
                        style={{ backgroundColor: getVoteColor(vote) }}
                      />
                      {count}
                    </span>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </section>

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
