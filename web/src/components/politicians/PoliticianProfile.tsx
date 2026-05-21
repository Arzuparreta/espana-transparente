"use client"

import { useSearchParams } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { AnnotationPanel } from "@/components/annotations/AnnotationPanel"
import { EmptyState } from "@/components/domain/EmptyState"
import { PageHeader } from "@/components/domain/PageHeader"
import { Pagination } from "@/components/domain/Pagination"
import { PartyBadge } from "@/components/domain/PartyBadge"
import { SectionTabs } from "@/components/domain/SectionTabs"
import { StatGrid } from "@/components/domain/StatGrid"
import { VoteBadge } from "@/components/domain/VoteBadge"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
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

const POSITION_LABELS: Record<string, string> = {
  presidente_gobierno: "Presidente del Gobierno",
  vicepresidente: "Vicepresidenta/e del Gobierno",
  ministro: "Ministra/o",
}

function formatAmount(n: number | null): string {
  if (!n) return "—"
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M €`
  if (n >= 1_000) return `${Math.round(n / 1_000)}K €`
  return `${Math.round(n)} €`
}

function formatProfileDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

interface AttendanceSummary {
  total_sessions: number
  sessions_present: number
  attendance_pct: number
}

interface GovPosition {
  id: string
  position_type: string
  organization_name: string
  government: string
  start_date: string | null
  source_url: string | null
}

interface MinistryContract {
  id: string
  title: string
  amount: number | null
  date: string | null
  awarding_body: string | null
}

interface Props {
  pol: Record<string, unknown>
  votes: Record<string, unknown>[]
  totalVotes: number | null
  votePage?: number
  votePageSize?: number
  powerRels: Record<string, unknown>[]
  subordinates: Record<string, unknown>[]
  revolvingDoors: Record<string, unknown>[]
  attendance: AttendanceSummary | null
  attendanceSessions?: Record<string, unknown>[]
  attendanceTotal?: number
  attendancePage?: number
  attendancePageSize?: number
  divergentSessionIds?: string[]
  govPosition?: GovPosition | null
  ministryContracts?: MinistryContract[]
}

export function PoliticianProfile({
  pol: p,
  votes: v,
  totalVotes,
  votePage = 1,
  votePageSize = 30,
  powerRels: pr,
  subordinates,
  revolvingDoors: rd,
  attendance,
  attendanceSessions = [],
  attendanceTotal = 0,
  attendancePage = 1,
  attendancePageSize = 50,
  divergentSessionIds,
  govPosition,
  ministryContracts = [],
}: Props) {
  const searchParams = useSearchParams()

  function tabHref(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(updates)) {
      if (v === null) params.delete(k)
      else params.set(k, v)
    }
    const query = params.toString()
    return query ? `?${query}` : "?"
  }

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
    ...(attendanceTotal > 0 ? [{ value: "asistencia", label: "Asistencia", count: attendanceTotal }] : []),
    { value: "trajectory", label: "Trayectoria" },
    ...(bio ? [{ value: "bio", label: "Biografía" }] : []),
    ...(econDecls.length ? [{ value: "declarations", label: "Declaraciones" }] : []),
    { value: "annotations", label: "Anotaciones" },
  ]

  // Salary calculation — official figures from Congreso transparency page (updated 2026-03-02)
  const SALARY_BASE = 3366.99
  const SALARY_RESIDENCE_MADRID = 1032.38
  const SALARY_RESIDENCE_OTHER = 2162.85
  const isMadrid = curConstituency.toLowerCase() === "madrid"
  const residenceAllowance = isMadrid ? SALARY_RESIDENCE_MADRID : SALARY_RESIDENCE_OTHER
  const baseMonthly = current ? SALARY_BASE + residenceAllowance : null

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
              <PartyBadge acronym={curParty.acronym} color={curParty.color} partyId={curParty.id} className="text-sm" />
            ) : null}
            {curConstituency ? (
              <span className="text-sm text-muted-foreground">{curConstituency}</span>
            ) : null}
            {p.twitter ? (
              <a
                href={`https://twitter.com/${String(p.twitter).replace(/^@/, "")}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                @{String(p.twitter).replace(/^@/, "")}
              </a>
            ) : null}
            {p.website ? (
              <a
                href={String(p.website)}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                Web oficial
              </a>
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
          ...(baseMonthly !== null
            ? [
                {
                  label: "Retribución mensual",
                  value: `${Math.round(baseMonthly).toLocaleString("es-ES")} €`,
                  hint: `Asignación constitucional (${SALARY_BASE.toLocaleString("es-ES")} €) + indemnización por residencia (${residenceAllowance.toLocaleString("es-ES")} €). No incluye complementos por cargos en Mesa, comisiones o portavocías. Fuente: Congreso, mar. 2026.`,
                },
              ]
            : []),
        ]}
      />

      {/* Cargo gubernamental actual */}
      {govPosition && (
        <Card className="border-primary/20">
          <CardContent className="px-4 py-4">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {POSITION_LABELS[govPosition.position_type] ?? govPosition.position_type}
                </div>
                <div className="mt-0.5 font-semibold">
                  <ResponsiveLink
                    href={`/ministerios/${govPosition.id}`}
                    className="underline-offset-2 hover:underline"
                  >
                    {govPosition.organization_name}
                  </ResponsiveLink>
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {govPosition.government}
                  {govPosition.start_date ? ` · desde ${formatProfileDate(govPosition.start_date)}` : ""}
                </div>
              </div>
              {govPosition.source_url && (
                <a
                  href={govPosition.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 text-xs text-muted-foreground underline-offset-2 hover:underline"
                >
                  BOE →
                </a>
              )}
            </div>

            {ministryContracts.length > 0 && (
              <div className="mt-4 space-y-1.5">
                <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Contratos recientes del ministerio
                </div>
                {ministryContracts.map((c) => (
                  <a
                    key={c.id}
                    href={`/contratos/${c.id}`}
                    className="flex min-w-0 items-baseline justify-between gap-3 rounded-[2px] border border-border/50 bg-background/60 px-3 py-2 text-sm transition-colors hover:bg-background"
                  >
                    <span className="min-w-0 truncate">{c.title}</span>
                    <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                      {formatAmount(c.amount)}
                    </span>
                  </a>
                ))}
                <a
                  href={`/contratos?q=${encodeURIComponent(govPosition.organization_name)}`}
                  className="block pt-1 text-xs text-muted-foreground underline-offset-2 hover:underline"
                >
                  Ver todos los contratos del ministerio →
                </a>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {voteDistribution.length > 0 ? (
        <Card>
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
                    className="h-2.5 w-2.5 shrink-0"
                    style={{ backgroundColor: getVoteColor(vote) }}
                  />
                  <span className="font-medium">{vote}</span>
                  <span className="text-muted-foreground">
                    {Math.round((count / v.length) * 100)}%
                  </span>
                </div>
              ))}
            </div>
            <div className="flex h-2.5 overflow-hidden rounded-[2px] bg-muted">
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
                      const superiorId = relation.superior_id as string | undefined
                      const relType = String(relation.relationship_type || "")

                      return (
                        <div
                          key={index}
                          className="flex flex-wrap items-center gap-2 rounded-[2px] border border-border/60 bg-card px-3 py-3 text-sm"
                        >
                          {party ? (
                            <PartyBadge
                              acronym={party.acronym}
                              color={party.color}
                              partyId={party.id}
                              className="text-xs"
                            />
                          ) : null}
                          <span className="text-xs text-muted-foreground">
                            {RELATION_LABELS[relType] || relType}
                          </span>
                          {superiorId ? (
                            <ResponsiveLink
                              href={`/diputados/${superiorId}`}
                              className="font-medium underline-offset-2 hover:underline"
                            >
                              {superior?.full_name || "—"}
                            </ResponsiveLink>
                          ) : (
                            <span className="font-medium">{superior?.full_name || "—"}</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : govPosition ? (
                  <div className="rounded-[2px] border border-border/60 bg-card px-4 py-4 space-y-1">
                    <span className="inline-block rounded-[2px] bg-muted px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {POSITION_LABELS[govPosition.position_type] ?? govPosition.position_type}
                    </span>
                    <p className="text-sm font-medium">
                      <ResponsiveLink
                        href={`/ministerios/${govPosition.id}`}
                        className="underline-offset-2 hover:underline"
                      >
                        {govPosition.organization_name}
                      </ResponsiveLink>
                      {govPosition.government ? ` — ${govPosition.government}` : ""}
                    </p>
                    {govPosition.start_date ? (
                      <p className="text-xs text-muted-foreground">
                        Desde {formatProfileDate(govPosition.start_date)}
                      </p>
                    ) : null}
                    <p className="text-xs text-muted-foreground pt-1">
                      Máxima autoridad en su ámbito — no tiene superior en el ejecutivo.
                    </p>
                  </div>
                ) : subordinates.length > 0 ? (() => {
                  const sub = subordinates[0] as Record<string, unknown>
                  const subType = String(sub.relationship_type || "")
                  const subParty = sub.party as Record<string, string> | undefined
                  const roleLabel = subType === "spokesperson"
                    ? "Portavoz del grupo parlamentario"
                    : "Líder del grupo parlamentario"
                  return (
                    <div className="rounded-[2px] border border-border/60 bg-card px-4 py-4 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {subParty ? (
                          <PartyBadge
                            acronym={subParty.acronym}
                            color={subParty.color}
                            partyId={subParty.id}
                            className="text-xs"
                          />
                        ) : null}
                        <span className="inline-block rounded-[2px] bg-muted px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {roleLabel}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Encabeza la cadena de mando de su grupo parlamentario.
                        Los diputados{subParty ? ` del ${subParty.acronym}` : ""} rinden cuentas ante este cargo.
                      </p>
                    </div>
                  )
                })() : (
                  <p className="text-sm italic text-muted-foreground">
                    Sin datos de cadena de mando.
                  </p>
                )}

                {rd.length > 0 ? (
                  <Card>
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
                  <EmptyState
                    title="Sin votaciones registradas"
                    description="Aún no hay votos individuales capturados para esta persona."
                  />
                ) : (
                  v.map((vote: Record<string, unknown>, index: number) => {
                    const session = vote.voting_sessions as Record<string, string> | undefined
                    const sessionId = session?.id ?? String(vote.voting_session_id ?? "")
                    const voteValue = String(vote.vote || "")
                    const isDivergent = sessionId ? divergentSessionIds?.includes(sessionId) : false
                    const dateStr = session?.date
                      ? new Date(session.date).toLocaleDateString("es-ES", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })
                      : ""

                    const inner = (
                      <CardContent className="flex items-start gap-3 px-4 py-4">
                        <VoteBadge vote={voteValue} className="mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-balance">
                            {session?.title}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                            <span>{dateStr}</span>
                            {session?.initiative_number && (
                              <span>· Exp. {session.initiative_number}</span>
                            )}
                            {isDivergent && (
                              <span className="rounded border border-accent/35 bg-accent/10 px-2 py-0.5 font-mono text-xs uppercase tracking-[0.08em] text-accent">
                                Votó distinto a su grupo
                              </span>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    )

                    return sessionId ? (
                      <ResponsiveLink key={index} href={`/votaciones/${sessionId}`}>
                        <Card className="transition-colors hover:bg-card">
                          {inner}
                        </Card>
                      </ResponsiveLink>
                    ) : (
                      <Card key={index}>
                        {inner}
                      </Card>
                    )
                  })
                )}
                {totalVotes !== null && totalVotes > votePageSize ? (
                  <Pagination
                    page={votePage}
                    totalPages={Math.ceil(totalVotes / votePageSize)}
                    hrefForPage={(nextPage) => tabHref({ tab: "votes", page: String(nextPage) })}
                    label="Paginación del historial de voto"
                    className="pt-2"
                  />
                ) : null}
              </div>
            ) : null}

            {active === "asistencia" ? (
              <div className="space-y-3">
                {attendanceSessions.length === 0 ? (
                  <EmptyState
                    title="Sin datos de asistencia"
                    description="No hay sesiones nominales registradas para esta persona en la legislatura activa."
                  />
                ) : (
                  <>
                    <div className="overflow-hidden rounded-[2px] border border-border bg-card">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border/50 text-xs text-muted-foreground">
                            <th className="px-4 py-2 text-left font-medium">Sesión</th>
                            <th className="px-4 py-2 text-left font-medium">Fecha</th>
                            <th className="px-4 py-2 text-right font-medium">Asistencia</th>
                            <th className="hidden px-4 py-2 text-right font-medium sm:table-cell">Votos emitidos</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                          {attendanceSessions.map((s, i) => {
                            const dateStr = s.session_date
                              ? new Date(s.session_date as string).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })
                              : "—"
                            return (
                              <tr key={i} className="text-sm">
                                <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                                  Pleno {String(s.session_number ?? "—")}
                                </td>
                                <td className="px-4 py-2 text-muted-foreground">{dateStr}</td>
                                <td className="px-4 py-2 text-right">
                                  {s.was_present ? (
                                    <span className="text-green-600 dark:text-green-400">Presente</span>
                                  ) : (
                                    <span className="text-red-600 dark:text-red-400">Ausente</span>
                                  )}
                                </td>
                                <td className="hidden px-4 py-2 text-right tabular-nums text-muted-foreground sm:table-cell">
                                  {s.was_present ? String(s.votes_cast ?? 0) : "—"}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                    {attendanceTotal > attendancePageSize ? (
                      <Pagination
                        page={attendancePage}
                        totalPages={Math.ceil(attendanceTotal / attendancePageSize)}
                        hrefForPage={(nextPage) => tabHref({ tab: "asistencia", apage: String(nextPage) })}
                        label="Paginación de asistencia"
                      />
                    ) : null}
                  </>
                )}
              </div>
            ) : null}

            {active === "trajectory" ? (
              <Card>
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
                              partyId={party.id}
                              className="text-xs"
                            />
                          ) : null}
                          {membership.is_active ? (
                            <Badge
                              variant="outline"
                              className="shrink-0 border-green-300 bg-green-100 text-xs text-green-700 dark:border-green-700 dark:bg-green-900/30 dark:text-green-300"
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
              <Card>
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
