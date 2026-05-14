import { notFound } from "next/navigation"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { PoliticianCard } from "@/components/politicians/PoliticianCard"
import { PageHeader } from "@/components/domain/PageHeader"
import { getPartyPageData } from "@/lib/data"
import type { PoliticianWithMemberships } from "@/types"

export const revalidate = 3600

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function PartyPage({ params }: PageProps) {
  const { id } = await params

  const { party, memberships } = await getPartyPageData(id)
  if (!party) notFound()

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
            {memberships.length} diputados activos
          </CardTitle>
        </CardHeader>
      </Card>

      <div className="ui-grid-cards">
        {memberships.map((m) => {
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
