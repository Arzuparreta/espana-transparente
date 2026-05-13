import { supabase } from "@/lib/supabase/client"
import { notFound } from "next/navigation"
import { PoliticianProfile } from "@/components/politicians/PoliticianProfile"

export const revalidate = 3600

interface PageProps { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params
  const { data } = await supabase.from("politicians").select("full_name").eq("id", id).single()
  return { title: data?.full_name || "Diputado" }
}

export default async function PoliticianPage({ params }: PageProps) {
  const { id } = await params

  const { data: pol } = await supabase
    .from("politicians")
    .select(`*, politician_memberships(*, party:parties(*), legislature:legislatures(*)), economic_declarations(*)`)
    .eq("id", id).single()

  if (!pol) notFound()

  const { data: votes } = await supabase
    .from("votes")
    .select("vote, voting_sessions!inner(date, title, initiative_number)")
    .eq("politician_id", id)
    .order("date", { ascending: false, foreignTable: "voting_sessions" })
    .limit(30)

  const { count: totalVotes } = await supabase
    .from("votes")
    .select("*", { count: "exact", head: true })
    .eq("politician_id", id)

  return <PoliticianProfile politician={pol as Record<string, unknown>} votes={(votes || []) as Record<string, unknown>[]} totalVotes={totalVotes} />
}
