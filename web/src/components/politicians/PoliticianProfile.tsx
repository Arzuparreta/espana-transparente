"use client"

import { TabBar, TabPanel } from "@/components/ui/tab-bar"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PoliticianTimeline } from "@/components/politicians/PoliticianTimeline"
import { VotingHistory } from "@/components/politicians/VotingHistory"
import { VoteStats } from "@/components/politicians/VoteStats"
import { PowerChain } from "@/components/politicians/PowerChain"
import { RevolvingDoorList } from "@/components/politicians/RevolvingDoorList"
import { EconomicDeclarationView } from "@/components/politicians/EconomicDeclaration"
import { AnnotationPanel } from "@/components/annotations/AnnotationPanel"
import type { PoliticianMembership, Vote, EconomicDeclaration } from "@/types"

interface ProfileProps {
  politician: Record<string, unknown>
  votes: Record<string, unknown>[]
  totalVotes: number | null
}

export function PoliticianProfile({ politician: polRaw, votes: votesRaw, totalVotes }: ProfileProps) {
  const pol = polRaw as unknown as {
    id: string
    full_name: string
    raw_data?: { biografia?: string }
    politician_memberships?: PoliticianMembership[]
    economic_declarations?: EconomicDeclaration[]
  }
  const votes = votesRaw
  const currentMembership = pol.politician_memberships?.find(
    (m) => m.legislature?.is_active
  )

  const tabs = [
    { value: "power", label: "Poder" },
    { value: "votes", label: "Votos", count: totalVotes ?? 0 },
    { value: "trajectory", label: "Trayectoria" },
    ...(pol.raw_data?.biografia ? [{ value: "bio" as const, label: "Biografía" }] : []),
    ...(pol.economic_declarations?.length
      ? [{ value: "declarations" as const, label: "Declaraciones" }] : []),
    { value: "annotations", label: "Anotaciones" },
  ]

  return (
    <div className="max-w-4xl mx-auto">
      {/* Hero */}
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          {currentMembership?.party && (
            <Badge
              style={{ backgroundColor: currentMembership.party.color + "18", color: currentMembership.party.color, borderColor: currentMembership.party.color + "40" }}
              variant="outline" className="font-semibold text-sm px-3 py-1"
            >
              {currentMembership.party.acronym}
            </Badge>
          )}
          {currentMembership?.constituency && (
            <span className="text-sm text-muted-foreground">{currentMembership.constituency}</span>
          )}
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{pol.full_name}</h1>
        {currentMembership?.group_parliamentary && (
          <p className="text-sm text-muted-foreground mt-1">{currentMembership.group_parliamentary}</p>
        )}
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <Card><CardContent className="py-3 px-3 text-center">
          <div className="text-xl font-bold">{totalVotes ?? 0}</div>
          <div className="text-[11px] text-muted-foreground">votos</div>
        </CardContent></Card>
        <Card><CardContent className="py-3 px-3 text-center">
          <div className="text-xl font-bold">{pol.politician_memberships?.length ?? 0}</div>
          <div className="text-[11px] text-muted-foreground">legislaturas</div>
        </CardContent></Card>
        <Card><CardContent className="py-3 px-3 text-center">
          <div className="text-xl font-bold">{pol.economic_declarations?.length ?? 0}</div>
          <div className="text-[11px] text-muted-foreground">declaraciones</div>
        </CardContent></Card>
      </div>

      <VoteStats politicianId={pol.id} />

      {/* Tabs */}
      <div className="mt-6">
        <TabBar tabs={tabs} defaultTab="power">
          <TabPanel value="power">
            <div className="space-y-4">
              <PowerChain politicianId={pol.id} />
              <RevolvingDoorList politicianId={pol.id} />
            </div>
          </TabPanel>
          <TabPanel value="votes">
            <VotingHistory votes={votes as unknown as Vote[]} politicianId={pol.id} />
          </TabPanel>
          <TabPanel value="trajectory">
            <PoliticianTimeline memberships={pol.politician_memberships || []} />
          </TabPanel>
          {pol.raw_data?.biografia && (
            <TabPanel value="bio">
              <Card>
                <CardContent className="p-4 sm:p-6">
                  <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">{pol.raw_data.biografia}</p>
                </CardContent>
              </Card>
            </TabPanel>
          )}
          {pol.economic_declarations?.length ? (
            <TabPanel value="declarations">
              {pol.economic_declarations.map((d) => (
                <EconomicDeclarationView key={d.id} declaration={d} />
              ))}
            </TabPanel>
          ) : null}
          <TabPanel value="annotations">
            <AnnotationPanel entityType="politician" entityId={pol.id} />
          </TabPanel>
        </TabBar>
      </div>
    </div>
  )
}
