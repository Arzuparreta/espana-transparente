import { PageHeader } from "@/components/domain/PageHeader"
import { InfoPanel } from "@/components/domain/InfoPanel"
import { StatGrid } from "@/components/domain/StatGrid"
import { PartyBadge } from "@/components/domain/PartyBadge"
import { EntityLink } from "@/components/domain/EntityLink"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { getGobiernoActual, type GobiernoMember } from "@/lib/data"
import { getPartyColor } from "@/lib/domain-style"

export const revalidate = 3600 * 24

export const metadata = {
  title: "Ministerios",
  description:
    "Ministerios y vicepresidencias del Gobierno de España ordenados por el importe en contratos públicos que adjudica cada órgano, con su titular y partido.",
}

function formatAmount(eur: number): string {
  if (eur >= 1_000_000_000) return `${(eur / 1_000_000_000).toFixed(1)} MM€`
  if (eur >= 1_000_000) return `${(eur / 1_000_000).toFixed(1)} M€`
  if (eur >= 1_000) return `${Math.round(eur / 1_000)} K€`
  return `${Math.round(eur)} €`
}

function formatName(personName: string): string {
  return personName
    .split(",")
    .map((s) => s.trim())
    .reverse()
    .join(" ")
}

function MinistrioRow({ member, rank }: { member: GobiernoMember; rank: number }) {
  const color = getPartyColor(member.party_color)
  return (
    <EntityLink
      kind="ministry"
      id={member.id}
      className="flex min-w-0 items-center justify-between gap-4 border-t border-border/50 py-3 first:border-0 hover:bg-muted/40 -mx-4 px-4 transition-colors"
      style={{ borderColor: `${color}1f` }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="w-6 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">
          {rank}
        </span>
        <div className="min-w-0">
          <p className="font-medium leading-snug line-clamp-2">
            {member.organization_name}
            {member.position_type === "vicepresidente" && (
              <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                Vicepresidencia
              </span>
            )}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {formatName(member.person_name)}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <PartyBadge acronym={member.political_party} color={member.party_color ?? undefined} />
        <div className="w-20 text-right">
          <p className="font-mono font-semibold">{formatAmount(member.total_amount_eur)}</p>
          <p className="font-mono text-xs text-muted-foreground">
            {member.contract_count.toLocaleString("es-ES")} contrato{member.contract_count !== 1 ? "s" : ""}
          </p>
        </div>
      </div>
    </EntityLink>
  )
}

export default async function MinisteriosPage() {
  const members = await getGobiernoActual()

  const ministries = members
    .filter((m) => m.position_type === "ministro" || m.position_type === "vicepresidente")
    .sort((a, b) => b.total_amount_eur - a.total_amount_eur)

  const government = members[0]?.government ?? "Gobierno actual"
  const totalContracts = ministries.reduce((s, m) => s + m.contract_count, 0)
  const totalAmount = ministries.reduce((s, m) => s + m.total_amount_eur, 0)

  return (
    <div className="ui-page">
      <PageHeader
        title="Ministerios"
        description={`Cada ministerio adjudica contratos públicos con dinero del Estado. Aquí están los del ${government}, ordenados por el importe que adjudica cada órgano: qué ministerio mueve más dinero, quién lo dirige y de qué partido es.`}
      />

      <StatGrid
        items={[
          { label: "Ministerios y vicepresidencias", value: ministries.length.toString() },
          { label: "Contratos adjudicados", value: totalContracts.toLocaleString("es-ES") },
          { label: "Importe total", value: formatAmount(totalAmount) },
        ]}
      />

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Por importe adjudicado
        </h2>
        <div className="rounded-[2px] border border-border bg-card px-4 py-1">
          {ministries.map((m, i) => (
            <MinistrioRow key={m.id} member={m} rank={i + 1} />
          ))}
        </div>
      </section>

      <InfoPanel title="Fuente y cobertura">
        Composición del gabinete a partir del BOE y registros oficiales. El importe en contratos
        procede de la Plataforma de Contratación del Sector Público (PCSP) y se asocia al ministerio
        adjudicador. La cobertura puede ser parcial si el nombre del órgano ha variado históricamente.
        Para ver al gabinete por cargos (presidencia, vicepresidencias y ministerios), consulta{" "}
        <ResponsiveLink href="/gobierno" className="underline underline-offset-2">
          Gobierno
        </ResponsiveLink>
        .
      </InfoPanel>
    </div>
  )
}
