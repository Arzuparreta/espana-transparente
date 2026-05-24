import { supabase } from "@/lib/supabase/client"
import { notFound } from "next/navigation"
import { ContextTrail, type ContextTrailLink } from "@/components/navigation/ContextTrail"
import { PoliticianProfile } from "@/components/politicians/PoliticianProfile"
import { getPoliticianProfileData, getDeputyVotes, getDeputyAttendanceSessions, parsePage, PAGE_SIZE } from "@/lib/data"

export const revalidate = 3600

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ page?: string; apage?: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params
  const { data } = await supabase.from("politicians").select("full_name").eq("id", id).single()
  return { title: data?.full_name || "Diputado" }
}

export default async function PoliticianPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const { page: pageParam, apage: apageParam } = await searchParams
  const votePage = parsePage(pageParam)
  const attendancePage = parsePage(apageParam)

  const [profile, pagedVotes, attendanceData] = await Promise.all([
    getPoliticianProfileData(id),
    votePage > 1 ? getDeputyVotes(id, votePage) : Promise.resolve(null),
    getDeputyAttendanceSessions(id, attendancePage),
  ])

  const { pol, votes, totalVotes, powerRels, subordinates, revolvingDoors, attendance, divergentSessionIds, govPosition, ministryContracts, entitySummary } = profile
  if (!pol) notFound()

  const displayVotes = pagedVotes ?? votes
  const politician = pol as Record<string, unknown>
  const fullName = String(politician.full_name ?? "Diputado")
  const memberships = (politician.politician_memberships ?? []) as Array<Record<string, unknown>>
  const activeMembership = memberships.find(
    (membership) => (membership.legislature as Record<string, unknown> | undefined)?.is_active
  )
  const activeParty = activeMembership?.party as Record<string, string> | undefined
  const currentGroup = String(activeMembership?.group_parliamentary ?? "")
  const related = [
    totalVotes && totalVotes > 0
      ? { href: `/diputados/${id}?tab=votes`, label: "Votaciones", meta: String(totalVotes) }
      : null,
    activeParty?.id
      ? { href: `/partidos/${activeParty.id}`, label: "Partido", meta: activeParty.acronym }
      : null,
    powerRels.length > 0 || subordinates.length > 0 || govPosition
      ? { href: `/diputados/${id}?tab=power`, label: "Relaciones" }
      : null,
    revolvingDoors.length > 0
      ? { href: `/diputados/${id}?tab=power`, label: "Puertas giratorias", meta: String(revolvingDoors.length) }
      : null,
    govPosition
      ? { href: `/ministerios/${govPosition.id}`, label: "Ministerio" }
      : null,
    ministryContracts.length > 0
      ? { href: `/contratos?q=${encodeURIComponent(govPosition?.organization_name ?? fullName)}`, label: "Contratos" }
      : null,
  ].filter(Boolean) as ContextTrailLink[]

  return (
    <>
      <ContextTrail
        className="mx-auto w-full max-w-6xl"
        section={{ href: "/diputados", label: "Diputados" }}
        current={fullName}
        meta={currentGroup || undefined}
        fallbackHref="/diputados"
        fallbackLabel="Volver a Diputados"
        related={related}
      />
      <PoliticianProfile
        pol={politician}
        votes={displayVotes as Record<string, unknown>[]}
        totalVotes={totalVotes}
        votePage={votePage}
        votePageSize={PAGE_SIZE.deputyVotes}
        powerRels={powerRels as Record<string, unknown>[]}
        subordinates={subordinates as Record<string, unknown>[]}
        revolvingDoors={revolvingDoors as Record<string, unknown>[]}
        attendance={attendance as { total_sessions: number; sessions_present: number; attendance_pct: number } | null}
        attendanceSessions={attendanceData.sessions as Record<string, unknown>[]}
        attendanceTotal={attendanceData.total}
        attendancePage={attendancePage}
        attendancePageSize={attendanceData.pageSize}
        divergentSessionIds={divergentSessionIds}
        govPosition={govPosition as Parameters<typeof PoliticianProfile>[0]["govPosition"]}
        ministryContracts={ministryContracts as Parameters<typeof PoliticianProfile>[0]["ministryContracts"]}
        entitySummary={entitySummary}
      />
    </>
  )
}
