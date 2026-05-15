import { notFound } from "next/navigation"
import { PoliticianCard } from "@/components/politicians/PoliticianCard"
import { PageHeader } from "@/components/domain/PageHeader"
import { getPartyPageData } from "@/lib/data"
import type { PoliticianWithMemberships } from "@/types"

export const revalidate = 3600

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params
  const { party } = await getPartyPageData(id)
  return { title: party?.acronym ?? "Partido" }
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

      <p className="text-sm text-muted-foreground">
        {memberships.length} diputado{memberships.length !== 1 ? "s" : ""} activo{memberships.length !== 1 ? "s" : ""} en la XV Legislatura.
      </p>

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
