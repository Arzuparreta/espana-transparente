import { PageHeader } from "@/components/domain/PageHeader"
import { InfoPanel } from "@/components/domain/InfoPanel"
import { StatGrid } from "@/components/domain/StatGrid"
import { PartyBadge } from "@/components/domain/PartyBadge"
import { EntityLink } from "@/components/domain/EntityLink"
import { getGobiernoActual, getPartyAcronymMap, type GobiernoMember } from "@/lib/data"
import { getPartyColor } from "@/lib/domain-style"

export const revalidate = 3600 * 24

export const metadata = {
  title: "Gobierno",
  description: "Composición actual del Gobierno de España: ministras y ministros, partido, ministerio y enlace a su ficha pública.",
}

const POSITION_LABEL: Record<string, string> = {
  presidente_gobierno: "Presidencia del Gobierno",
  vicepresidente: "Vicepresidencias",
  ministro: "Ministerios",
}

function formatAmount(eur: number): string {
  if (eur >= 1_000_000) return `${(eur / 1_000_000).toFixed(1)} M€`
  if (eur >= 1_000) return `${Math.round(eur / 1_000)} K€`
  return `${Math.round(eur)} €`
}

function MemberCard({ member, partyId }: { member: GobiernoMember; partyId: string | null }) {
  const color = getPartyColor(member.party_color)
  const nameFormatted = member.person_name
    .split(",")
    .map((s) => s.trim())
    .reverse()
    .join(" ")

  const isMinistry = member.position_type === "ministro" || member.position_type === "vicepresidente"
  const orgLink = isMinistry ? (
    <EntityLink kind="ministry" id={member.id}>
      <p className="text-xs font-medium leading-snug text-muted-foreground line-clamp-2 underline-offset-2 hover:underline">
        {member.organization_name}
      </p>
    </EntityLink>
  ) : (
    <p className="text-xs font-medium leading-snug text-muted-foreground line-clamp-2">
      {member.organization_name}
    </p>
  )

  const nameNode = member.politician_id ? (
    <EntityLink kind="politician" id={member.politician_id}>
      <p className="font-semibold leading-snug underline-offset-2 hover:underline">{nameFormatted}</p>
    </EntityLink>
  ) : (
    <p className="font-semibold leading-snug">{nameFormatted}</p>
  )

  return (
    <div
      data-slot="card"
      className="flex min-h-[5.5rem] flex-col justify-between rounded-[2px] border bg-card p-4 transition-colors hover:border-foreground/40"
      style={{ borderColor: `${color}28` }}
    >
      <div className="space-y-1">
        {orgLink}
        {nameNode}
      </div>
      <div className="mt-3 flex min-w-0 items-center justify-between gap-2">
        <PartyBadge
          acronym={member.political_party}
          color={member.party_color ?? undefined}
          partyId={partyId}
        />
        {member.contract_count > 0 ? (
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {member.contract_count} contrato{member.contract_count !== 1 ? "s" : ""}{" "}
            · {formatAmount(member.total_amount_eur)}
          </span>
        ) : null}
      </div>
    </div>
  )
}

export default async function GobiernoPage() {
  const [members, partyMap] = await Promise.all([
    getGobiernoActual(),
    getPartyAcronymMap(),
  ])

  const byType = members.reduce<Record<string, GobiernoMember[]>>((acc, m) => {
    acc[m.position_type] = [...(acc[m.position_type] ?? []), m]
    return acc
  }, {})

  const government = members[0]?.government ?? "Gobierno actual"
  const ministerCount = byType["ministro"]?.length ?? 0
  const partyCount = new Set(members.map((m) => m.political_party)).size
  const totalContracts = members.reduce((s, m) => s + m.contract_count, 0)
  const totalAmount = members.reduce((s, m) => s + m.total_amount_eur, 0)

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader
        title="Gobierno"
        description={`Las personas que dirigen el Estado ahora mismo: presidente, vicepresidentes y ministros del ${government}. A qué partido pertenecen y qué contratos adjudica cada ministerio.`}
      />

      <StatGrid
        items={[
          { label: "Ministerios", value: ministerCount.toString() },
          { label: "Partidos en coalición", value: partyCount.toString() },
          { label: "Contratos vinculados", value: totalContracts.toLocaleString("es-ES") },
          { label: "Importe contratos", value: formatAmount(totalAmount) },
        ]}
      />

      {(["presidente_gobierno", "vicepresidente", "ministro"] as const).map((type) => {
        const group = byType[type]
        if (!group?.length) return null
        return (
          <section key={type} className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              {POSITION_LABEL[type]}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.map((m) => (
                <MemberCard
                  key={m.id}
                  member={m}
                  partyId={m.political_party ? partyMap[m.political_party.toLowerCase()] ?? null : null}
                />
              ))}
            </div>
          </section>
        )
      })}

      <InfoPanel title="Fuente y cobertura">
        Composición del gabinete a partir de datos del BOE y registros oficiales.
        Los contratos públicos vinculados provienen de la Plataforma de Contratación del Sector Público (PCSP)
        y se asocian al ministerio adjudicador. La cobertura puede ser parcial si el nombre del órgano ha variado.
        Las tarjetas con enlace dirigen a la ficha completa del/la diputado/a.
      </InfoPanel>
    </div>
  )
}
