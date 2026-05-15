"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { AnnotationPanel } from "@/components/annotations/AnnotationPanel"
import { PageHeader } from "@/components/domain/PageHeader"
import { PartyBadge } from "@/components/domain/PartyBadge"
import { SectionTabs } from "@/components/domain/SectionTabs"
import { StatGrid } from "@/components/domain/StatGrid"
import { VoteBadge } from "@/components/domain/VoteBadge"
import { getVoteColor } from "@/lib/domain-style"
import { getResponsivePhoto } from "@/lib/photos"
import { EconomicDeclarationList } from "@/components/politicians/EconomicDeclaration"
import type { EconomicDeclaration } from "@/types"

const RELATION_LABELS: Record<string, string> = {
  party_leader: "Responde ante",
  spokesperson: "Coordinado por",
  list_placement: "En lista por decisión de",
  appointed_by: "Nombrado por",
}

interface AttendanceSummary {
  total_sessions: number
  sessions_present: number
  attendance_pct: number
}

interface Props {
  pol: Record<string, unknown>
  votes: Record<string, unknown>[]
  totalVotes: number | null
  powerRels: Record<string, unknown>[]
  revolvingDoors: Record<string, unknown>[]
  attendance: AttendanceSummary | null
}

export function PoliticianProfile({
  pol: p,
  votes: v,
  totalVotes,
  powerRels: pr,
  revolvingDoors: rd,
  attendance,
}: Props) {
  const fullName = String(p.full_name || "")
  const photoUrl = p.photo_url as string | undefined
  const photoVariants = (p.photo_variants as Record<string, string> | undefined) ?? undefined
  const initials = [String(p.first_name || "").charAt(0), String(p.last_name || "").charAt(0)].join("").toUpperCase()
  const photo = getResponsivePhoto(photoUrl, photoVariants)
  const bio = (p.raw_data as Record<string, unknown> | undefined)?.biografia as string | undefined
  const memberships = (p.politician_memberships || []) as Array<Record<string, unknown>>
  const econDecls = (p.economic_declarations || []) as EconomicDeclaration[]
  const current = memberships.find(
    (m: Record<string, unknown>) =>
      (m.legislature as Record<string, unknown> | undefined)?.is_active
  )
  const curParty = current?.party as Record<string, string> | undefined
  const curConstituency = String(current?.constituency || "")
  const curGroup = String(current?.group_parliamentary || "")

  const tabs = [
    { value: "power", label: "Poder" },
    { value: "votes", label: "Votos", count: totalVotes ?? 0 },
    { value: "trajectory", label: "Trayectoria" },
    ...(bio ? [{ value: "bio", label: "Biografía" }] : []),
    ...(econDecls.length ? [{ value: "declarations", label: "Declaraciones" }] : []),
    { value: "annotations", label: "Anotaciones" },
  ]

  const voteDistribution = (() => {
    const counts: Record<string, number> = {}
    for (const vote of v) {
      const key = String(vote.vote || "")
      counts[key] = (counts[key] || 0) + 1
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  })()

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title={fullName}
        description={
          curGroup || "Ficha individual con relaciones registradas, historial de voto y trayectoria."
        }
        eyebrow={
          <>
            <Avatar className="size-14 shrink-0">
              <AvatarImage
                src={photo.src}
                srcSet={photo.srcSet}
                sizes={photo.sizes}
                decoding="async"
                alt={fullName}
              />
              <AvatarFallback className="text-base">{initials}</AvatarFallback>
            </Avatar>
            {curParty ? (
              <PartyBadge acronym={curParty.acronym} color={curParty.color} className="text-sm" />
            ) : null}
            {curConstituency ? (
              <span className="text-sm text-muted-foreground">{curConstituency}</span>
            ) : null}
          </>
        }
      />

      <StatGrid
        items={[
          {
            label: "Votos registrados",
            value: totalVotes ?? 0,
            hint: "Histórico individual capturado en votaciones nominales.",
          },
          {
            label: "Legislaturas",
            value: memberships.length,
            hint: "Etapas parlamentarias trazadas en la base de datos.",
          },
          ...(attendance
            ? [
                {
                  label: "Asistencia a plenos",
                  value: `${attendance.attendance_pct}%`,
                  hint: `${attendance.sessions_present} de ${attendance.total_sessions} sesiones con votación nominal (Leg. XV).`,
                },
              ]
            : [
                {
                  label: "Declaraciones",
                  value: econDecls.length,
                  hint: "Declaraciones económicas asociadas a esta persona.",
                },
              ]),
        ]}
      />

      {voteDistribution.length > 0 ? (
        <Card className="bg-card/80">
          <CardContent className="space-y-3 px-4 py-4">
            <div>
              <div className="text-sm font-semibold">Distribución reciente del voto</div>
              <div className="text-xs text-muted-foreground">
                Un vistazo rápido al patrón visible antes de entrar al detalle.
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {voteDistribution.map(([vote, count]) => (
                <div key={vote} className="flex items-center gap-1.5 text-sm">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: getVoteColor(vote) }}
                  />
                  <span className="font-medium">{vote}</span>
                  <span className="text-muted-foreground">
                    {Math.round((count / v.length) * 100)}%
                  </span>
                </div>
              ))}
            </div>
            <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
              {voteDistribution.map(([vote, count]) => (
                <div
                  key={vote}
                  style={{
                    width: `${(count / v.length) * 100}%`,
                    backgroundColor: getVoteColor(vote),
                  }}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <SectionTabs tabs={tabs} defaultTab="power">
        {(active) => (
          <>
            {active === "power" ? (
              <div className="space-y-4">
                {pr.length > 0 ? (
                  <div className="space-y-2">
                    {pr.map((relation: Record<string, unknown>, index: number) => {
                      const party = relation.party as Record<string, string> | undefined
                      const superior = relation.superior as Record<string, string> | undefined
                      const relType = String(relation.relationship_type || "")

                      return (
                        <div
                          key={index}
                          className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-card/80 px-3 py-3 text-sm shadow-sm"
                        >
                          {party ? (
                            <PartyBadge
                              acronym={party.acronym}
                              color={party.color}
                              className="text-[11px]"
                            />
                          ) : null}
                          <span className="text-xs text-muted-foreground">
                            {RELATION_LABELS[relType] || relType}
                          </span>
                          <span className="font-medium">{superior?.full_name || "—"}</span>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm italic text-muted-foreground">
                    Sin datos de cadena de mando.
                  </p>
                )}

                {rd.length > 0 ? (
                  <Card className="bg-card/80">
                    <CardContent className="space-y-2 p-4">
                      <h3 className="text-sm font-semibold">Puertas giratorias</h3>
                      {rd.map((entry: Record<string, unknown>, index: number) => (
                        <div
                          key={index}
                          className="border-l-2 border-border/80 py-1 pl-3 text-xs"
                        >
                          <div className="flex flex-wrap items-center gap-1">
                            <span>{String(entry.public_role || "")}</span>
                            <span className="text-muted-foreground">→</span>
                            <span className="font-medium">{String(entry.private_role || "")}</span>
                            <span className="text-muted-foreground">
                              {" "}en{" "}
                              {entry.organization_id ? (
                                <a
                                  href={`/organizaciones/${String(entry.organization_id)}`}
                                  className="text-foreground underline-offset-4 hover:underline"
                                >
                                  {String(entry.private_organization || "")}
                                </a>
                              ) : (
                                String(entry.private_organization || "")
                              )}
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
                            {entry.private_start_date ? (
                              <span>
                                Inicio privado: {formatProfileDate(String(entry.private_start_date))}
                              </span>
                            ) : null}
                            {(entry.primary_source_url || entry.source_url) ? (
                              <a
                                href={String(entry.primary_source_url || entry.source_url)}
                                target="_blank"
                                rel="noreferrer"
                                className="font-medium text-foreground underline-offset-4 hover:underline"
                              >
                                Fuente
                              </a>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ) : null}
              </div>
            ) : null}

            {active === "votes" ? (
              <div className="space-y-3">
                {v.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      No hay votaciones registradas.
                    </CardContent>
                  </Card>
                ) : (
                  v.slice(0, 30).map((vote: Record<string, unknown>, index: number) => {
                    const session = vote.voting_sessions as Record<string, string> | undefined
                    const voteValue = String(vote.vote || "")
                    const dateStr = session?.date
                      ? new Date(session.date).toLocaleDateString("es-ES", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })
                      : ""

                    return (
                      <Card key={index} className="bg-card/80">
                        <CardContent className="flex items-start gap-3 px-4 py-4">
                          <VoteBadge vote={voteValue} className="mt-0.5" />
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-balance">
                              {session?.title}
                            </div>
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              {dateStr}
                              {session?.initiative_number
                                ? ` · Exp. ${session.initiative_number}`
                                : ""}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })
                )}
              </div>
            ) : null}

            {active === "trajectory" ? (
              <Card className="bg-card/80">
                <CardContent className="space-y-3 p-4">
                  {[...memberships]
                    .sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
                      const left =
                        (a.legislature as Record<string, number> | undefined)?.number ?? 0
                      const right =
                        (b.legislature as Record<string, number> | undefined)?.number ?? 0
                      return right - left
                    })
                    .map((membership: Record<string, unknown>) => {
                      const legislature = membership.legislature as
                        | Record<string, unknown>
                        | undefined
                      const party = membership.party as Record<string, string> | undefined
                      return (
                        <div
                          key={String(membership.id)}
                          className="flex flex-wrap items-start gap-3 border-l-2 pl-3 text-sm"
                          style={{
                            borderLeftColor: party?.color || "#718096",
                            opacity: membership.is_active ? 1 : 0.7,
                          }}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-medium">
                              {String(
                                legislature?.name || `Legislatura ${legislature?.number}`
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {membership.constituency
                                ? `Circ. ${String(membership.constituency)}`
                                : ""}
                              {membership.start_date
                                ? ` · Desde ${String(membership.start_date)}`
                                : ""}
                              {membership.end_date
                                ? ` hasta ${String(membership.end_date)}`
                                : ""}
                            </div>
                          </div>
                          {party ? (
                            <PartyBadge
                              acronym={party.acronym}
                              color={party.color}
                              className="text-[11px]"
                            />
                          ) : null}
                          {membership.is_active ? (
                            <Badge
                              variant="outline"
                              className="shrink-0 border-green-300 bg-green-100 text-[11px] text-green-700 dark:border-green-700 dark:bg-green-900/30 dark:text-green-300"
                            >
                              Activo
                            </Badge>
                          ) : null}
                        </div>
                      )
                    })}
                </CardContent>
              </Card>
            ) : null}

            {active === "bio" && bio ? (
              <Card className="bg-card/80">
                <CardContent className="p-4 sm:p-6">
                  <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                    {bio}
                  </p>
                </CardContent>
              </Card>
            ) : null}

            {active === "declarations" ? (
              <EconomicDeclarationList declarations={econDecls} />
            ) : null}

            {active === "annotations" ? (
              <AnnotationPanel entityType="politician" entityId={String(p.id)} />
            ) : null}
          </>
        )}
      </SectionTabs>
    </div>
  )
}

function formatProfileDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}
