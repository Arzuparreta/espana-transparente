import { supabase } from "@/lib/supabase/client"
import { notFound } from "next/navigation"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { PoliticianCard } from "@/components/politicians/PoliticianCard"
import { PageHeader } from "@/components/domain/PageHeader"
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
      <PageHeader
        title={party.acronym}
        description={party.name}
        eyebrow={
          <div
            className="h-3 w-3 rounded-full border border-border/60"
            style={{ backgroundColor: party.color }}
          />
        }
      />

      <Card className="bg-card/80">
        <CardHeader>
          <CardTitle className="text-lg">
            {memberships?.length || 0} diputados activos
          </CardTitle>
        </CardHeader>
      </Card>

      <div className="ui-grid-cards">
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
