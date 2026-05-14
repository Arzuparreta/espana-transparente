import { supabase } from "@/lib/supabase/client"
import { notFound } from "next/navigation"
import { PoliticianProfile } from "@/components/politicians/PoliticianProfile"
import { getPoliticianProfileData } from "@/lib/data"

export const revalidate = 3600

interface PageProps { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params
  const { data } = await supabase.from("politicians").select("full_name").eq("id", id).single()
  return { title: data?.full_name || "Diputado" }
}

export default async function PoliticianPage({ params }: PageProps) {
  const { id } = await params

  const { pol, votes, totalVotes, powerRels, revolvingDoors, attendance } =
    await getPoliticianProfileData(id)
  if (!pol) notFound()

  return (
    <PoliticianProfile
      pol={pol as Record<string, unknown>}
      votes={votes as Record<string, unknown>[]}
      totalVotes={totalVotes}
      powerRels={powerRels as Record<string, unknown>[]}
      revolvingDoors={revolvingDoors as Record<string, unknown>[]}
      attendance={attendance as { total_sessions: number; sessions_present: number; attendance_pct: number } | null}
    />
  )
}
