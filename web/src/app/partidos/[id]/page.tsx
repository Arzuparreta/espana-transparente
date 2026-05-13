import { supabase } from "@/lib/supabase/client"
import { notFound } from "next/navigation"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { PoliticianCard } from "@/components/politicians/PoliticianCard"
import type { PoliticianWithMemberships } from "@/types"

export const revalidate = 3600

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function PartyPage({ params }: PageProps) {
  const { id } = await params

  const { data: party } = await supabase
    .from("parties")
    .select("*")
    .eq("id", id)
    .single()

  if (!party) notFound()

  const { data: memberships } = await supabase
    .from("politician_memberships")
    .select("constituency, party:parties(*), politician:politicians(*)")
    .eq("party_id", id)
    .eq("is_active", true)
    .order("constituency")

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <div
          className="w-12 h-12 rounded-full shrink-0"
          style={{ backgroundColor: party.color }}
        />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {party.acronym}
          </h1>
          <p className="text-muted-foreground">{party.name}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {memberships?.length || 0} diputados activos
          </CardTitle>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {memberships?.map((m) => {
          const pol = m.politician as unknown as Record<string, unknown>
          return (
            <PoliticianCard
              key={pol.id as string}
              politician={{ ...pol, politician_memberships: [m] } as unknown as PoliticianWithMemberships}
            />
          )
        })}
      </div>
    </div>
  )
}
