import Link from "next/link"
import { PageHeader } from "@/components/domain/PageHeader"
import { InfoPanel } from "@/components/domain/InfoPanel"
import { StatGrid } from "@/components/domain/StatGrid"
import { PartyBadge } from "@/components/domain/PartyBadge"
import { getGobiernoActual, type GobiernoMember } from "@/lib/data"
import { getPartyColor } from "@/lib/domain-style"

export const revalidate = 3600 * 24

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

function MemberCard({ member }: { member: GobiernoMember }) {
  const color = getPartyColor(member.party_color)
  const nameFormatted = member.person_name
    .split(",")
    .map((s) => s.trim())
    .reverse()
    .join(" ")

  const inner = (
    <div
      className="flex min-h-[5.5rem] flex-col justify-between rounded-xl border bg-card/80 p-4 transition-colors hover:bg-card"
      style={{ borderColor: `${color}28` }}
    >
      <div className="space-y-1">
        <p className="text-xs font-medium leading-snug text-muted-foreground line-clamp-2">
          {member.organization_name}
        </p>
        <p className="font-semibold leading-snug">{nameFormatted}</p>
      </div>
      <div className="mt-3 flex min-w-0 items-center justify-between gap-2">
        <PartyBadge
          acronym={member.political_party}
          color={member.party_color ?? undefined}
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

  if (member.politician_id) {
    return (
      <Link href={`/diputados/${member.politician_id}`} className="block">
        {inner}
      </Link>
    )
  }
  return inner
}

export default async function GobiernoPage() {
  const members = await getGobiernoActual()

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
        description={`Composición del ${government}. Cargos actuales, partido y contratos públicos adjudicados por ministerio.`}
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
                <MemberCard key={m.id} member={m} />
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
