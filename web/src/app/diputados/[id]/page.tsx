import type { PoliticianMembership, Vote, EconomicDeclaration } from "@/types"
import { supabase } from "@/lib/supabase/client"
import { notFound } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PoliticianTimeline } from "@/components/politicians/PoliticianTimeline"
import { VotingHistory } from "@/components/politicians/VotingHistory"
import { EconomicDeclarationView } from "@/components/politicians/EconomicDeclaration"
import { VoteStats } from "@/components/politicians/VoteStats"
import { AnnotationPanel } from "@/components/annotations/AnnotationPanel"

export const revalidate = 3600

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params
  const { data } = await supabase
    .from("politicians")
    .select("full_name")
    .eq("id", id)
    .single()
  return { title: data?.full_name || "Diputado" }
}

export default async function PoliticianPage({ params }: PageProps) {
  const { id } = await params

  const { data: pol } = await supabase
    .from("politicians")
    .select(
      `*,
      politician_memberships(*, party:parties(*), legislature:legislatures(*)),
      economic_declarations(*)`
    )
    .eq("id", id)
    .single()

  if (!pol) notFound()

  const currentMembership = pol.politician_memberships?.find(
    (m: PoliticianMembership) => m.legislature?.is_active
  )

  const { data: votes } = await supabase
    .from("votes")
    .select("vote, voting_sessions!inner(date, title, initiative_number)")
    .eq("politician_id", id)
    .order("date", {
      ascending: false,
      foreignTable: "voting_sessions",
    })
    .limit(50)

  const { count: totalVotes } = await supabase
    .from("votes")
    .select("*", { count: "exact", head: true })
    .eq("politician_id", id)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {pol.full_name}
          </h1>
          {currentMembership && (
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {currentMembership.party && (
                <Badge
                  style={{
                    backgroundColor: currentMembership.party.color + "20",
                    color: currentMembership.party.color,
                    borderColor: currentMembership.party.color,
                  }}
                  variant="outline"
                  className="font-semibold"
                >
                  {currentMembership.party.acronym}
                </Badge>
              )}
              <span className="text-muted-foreground">
                {currentMembership.constituency} ·{" "}
                {currentMembership.group_parliamentary}
              </span>
            </div>
          )}
        </div>
        {totalVotes !== null && (
          <Card className="w-fit shrink-0">
            <CardContent className="py-3 px-4">
              <div className="text-2xl font-bold text-center">
                {totalVotes}
              </div>
              <div className="text-xs text-muted-foreground text-center">
                votos registrados
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <VoteStats politicianId={id} />

      <Tabs defaultValue="info" className="w-full">
        <TabsList>
          <TabsTrigger value="info">Información</TabsTrigger>
          <TabsTrigger value="votes">
            Historial de voto
            {totalVotes && totalVotes > 0 && (
              <span className="ml-1.5 text-xs text-muted-foreground">
                ({totalVotes})
              </span>
            )}
          </TabsTrigger>
          {pol.economic_declarations?.length > 0 && (
            <TabsTrigger value="declarations">
              Declaraciones ({pol.economic_declarations.length})
            </TabsTrigger>
          )}
          <TabsTrigger value="annotations">Anotaciones</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="space-y-4 mt-4">
          <PoliticianTimeline memberships={pol.politician_memberships || []} />
          {pol.raw_data?.biografia && (
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold mb-2">Biografía</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-line">
                  {String(pol.raw_data.biografia)}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="votes" className="mt-4">
          <VotingHistory votes={(votes as unknown as Vote[]) || []} politicianId={id} />
        </TabsContent>

        <TabsContent value="declarations" className="mt-4">
          {pol.economic_declarations?.map((d: EconomicDeclaration) => (
            <EconomicDeclarationView key={d.id} declaration={d} />
          ))}
        </TabsContent>

        <TabsContent value="annotations" className="mt-4">
          <AnnotationPanel entityType="politician" entityId={id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
