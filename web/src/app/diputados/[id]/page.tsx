import { supabase } from "@/lib/supabase/client"
import { notFound } from "next/navigation"
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

  const { pol, votes, totalVotes, powerRels, subordinates, revolvingDoors, attendance, divergentSessionIds, govPosition, ministryContracts } = profile
  if (!pol) notFound()

  const displayVotes = pagedVotes ?? votes

  return (
    <PoliticianProfile
      pol={pol as Record<string, unknown>}
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
    />
  )
}
