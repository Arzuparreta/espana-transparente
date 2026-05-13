import type { PoliticianMembership, Vote } from "@/types"
import { supabase } from "@/lib/supabase/client"
import { notFound } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PoliticianTimeline } from "@/components/politicians/PoliticianTimeline"
import { VotingHistory } from "@/components/politicians/VotingHistory"
import { VoteStats } from "@/components/politicians/VoteStats"
import { PowerChain } from "@/components/politicians/PowerChain"
import { RevolvingDoorList } from "@/components/politicians/RevolvingDoorList"
import { EconomicDeclarationView } from "@/components/politicians/EconomicDeclaration"
import { AnnotationPanel } from "@/components/annotations/AnnotationPanel"
import type { EconomicDeclaration } from "@/types"

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

  const currentMembership = (pol.politician_memberships as PoliticianMembership[] | undefined)?.find(
    (m) => m.legislature?.is_active
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

      <Tabs defaultValue="power" className="w-full">
        <TabsList className="inline-flex h-9 items-center justify-start rounded-lg bg-muted p-1 text-muted-foreground w-auto">
          <TabsTrigger value="power" className="px-3 py-1 text-sm">Cadena de mando</TabsTrigger>
          <TabsTrigger value="votes" className="px-3 py-1 text-sm">
            Votos
            {totalVotes && totalVotes > 0 && (
              <span className="ml-1 text-xs text-muted-foreground">
                ({totalVotes})
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="info" className="px-3 py-1 text-sm">Trayectoria</TabsTrigger>
          {pol.economic_declarations?.length > 0 && (
            <TabsTrigger value="declarations" className="px-3 py-1 text-sm">
              Declaraciones
            </TabsTrigger>
          )}
          <TabsTrigger value="annotations" className="px-3 py-1 text-sm">Anotaciones</TabsTrigger>
        </TabsList>

        <div className="min-h-[350px] mt-3">
        <TabsContent value="power" className="space-y-4 mt-0">
          <PowerChain politicianId={id} />
          <RevolvingDoorList politicianId={id} />
        </TabsContent>

        <TabsContent value="votes" className="mt-0">
          <VotingHistory votes={(votes as unknown as Vote[]) || []} politicianId={id} />
        </TabsContent>

        <TabsContent value="info" className="space-y-4 mt-0">
          <PoliticianTimeline memberships={(pol.politician_memberships as PoliticianMembership[]) || []} />
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

        <TabsContent value="declarations" className="mt-0">
          {(pol.economic_declarations as EconomicDeclaration[])?.map((d) => (
            <EconomicDeclarationView key={d.id} declaration={d} />
          ))}
        </TabsContent>

        <TabsContent value="annotations" className="mt-0">
          <AnnotationPanel entityType="politician" entityId={id} />
        </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
