import { notFound } from "next/navigation"
import { ContextTrail } from "@/components/navigation/ContextTrail"
import { PageHeader } from "@/components/domain/PageHeader"
import { StatGrid } from "@/components/domain/StatGrid"
import { InfoPanel } from "@/components/domain/InfoPanel"
import { PartyBadge } from "@/components/domain/PartyBadge"
import { EntityLink } from "@/components/domain/EntityLink"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { getMinistrioDetail, getPartyAcronymMap, type MinistrioContract } from "@/lib/data"
import { getPartyColor } from "@/lib/domain-style"

export const revalidate = 3600 * 6

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params
  const { member } = await getMinistrioDetail(id)
  return { title: member?.organization_name ?? "Ministerio" }
}

function formatAmount(eur: number): string {
  if (eur >= 1_000_000_000) return `${(eur / 1_000_000_000).toFixed(1)} MM€`
  if (eur >= 1_000_000) return `${(eur / 1_000_000).toFixed(1)} M€`
  if (eur >= 1_000) return `${Math.round(eur / 1_000)} K€`
  return `${Math.round(eur)} €`
}

function ContractRow({ contract }: { contract: MinistrioContract }) {
  return (
    <EntityLink
      kind="contract"
      id={contract.id}
      className="flex min-w-0 items-start justify-between gap-4 border-t border-border/50 py-3 text-sm first:border-0 hover:bg-muted/40 -mx-4 px-4 transition-colors"
    >
      <div className="min-w-0">
        <p className="font-medium leading-snug line-clamp-2">{contract.title}</p>
        {contract.contractor && (
          <p className="mt-0.5 text-xs text-muted-foreground truncate">{contract.contractor}</p>
        )}
      </div>
      <div className="shrink-0 text-right">
        {contract.amount != null && (
          <p className="font-mono font-semibold">{formatAmount(contract.amount)}</p>
        )}
        {contract.date && (
          <p className="text-xs text-muted-foreground">
            {new Date(contract.date).toLocaleDateString("es-ES", { year: "numeric", month: "short" })}
          </p>
        )}
      </div>
    </EntityLink>
  )
}

export default async function MinistrioPage({ params }: PageProps) {
  const { id } = await params
  const [{ member, contracts }, partyMap] = await Promise.all([
    getMinistrioDetail(id),
    getPartyAcronymMap(),
  ])
  if (!member) notFound()
  const partyId = member.political_party ? partyMap[member.political_party.toLowerCase()] ?? null : null

  const color = getPartyColor(member.party_color)
  const nameFormatted = member.person_name
    .split(",")
    .map((s) => s.trim())
    .reverse()
    .join(" ")

  const startDate = member.start_date
    ? new Date(member.start_date).toLocaleDateString("es-ES", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null

  return (
    <div className="ui-page">
      <ContextTrail
        section={{ href: "/gobierno", label: "Gobierno" }}
        current={member.organization_name}
        meta={member.position_type === "vicepresidente" ? "Vicepresidencia" : "Ministerio"}
        fallbackHref="/gobierno"
        fallbackLabel="Volver a Gobierno"
        related={[
          {
            href: `/diputados/${member.politician_id}`,
            label: nameFormatted,
          },
          member.political_party && partyId
            ? { href: `/partidos/${partyId}`, label: "Partido", meta: member.political_party }
            : null,
          {
            href: `/contratos?ministry=${encodeURIComponent(member.organization_name)}`,
            label: "Contratos",
            meta: String(member.contract_count),
          },
          {
            href: `/dinero-publico`,
            label: "Trazabilidad del gasto",
          },
        ]}
      />
      <PageHeader
        title={member.organization_name}
        description={member.government}
      />

      {/* Titular */}
      <div
        className="rounded-[2px] border bg-card p-5"
        style={{ borderColor: `${color}28` }}
      >
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {member.position_type === "vicepresidente" ? "Vicepresidencia" : "Titular"}
        </p>
        <div className="flex min-w-0 items-center justify-between gap-4">
          <div className="min-w-0">
            <EntityLink kind="politician" id={member.politician_id} className="text-lg font-bold underline-offset-2 hover:underline">
              {nameFormatted}
            </EntityLink>
            {startDate && (
              <p className="mt-0.5 text-sm text-muted-foreground">Desde {startDate}</p>
            )}
          </div>
          <PartyBadge
            acronym={member.political_party}
            color={member.party_color ?? undefined}
            partyId={partyId}
          />
        </div>
      </div>

      {/* Stats */}
      <StatGrid
        items={[
          { label: "Contratos adjudicados", value: member.contract_count.toLocaleString("es-ES") },
          { label: "Importe total", value: formatAmount(member.total_amount_eur) },
        ]}
      />

      {/* Contratos */}
      {contracts.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Contratos más elevados
          </h2>
          <div className="rounded-[2px] border border-border bg-card px-4 py-1">
            {contracts.map((c) => (
              <ContractRow key={c.id} contract={c} />
            ))}
          </div>
          <p className="text-right text-xs text-muted-foreground">
            Mostrando los 20 contratos de mayor importe.{" "}
            <ResponsiveLink
              href={`/contratos?ministry=${encodeURIComponent(member.organization_name)}`}
              className="underline underline-offset-2"
            >
              Ver todos →
            </ResponsiveLink>
          </p>
        </section>
      )}

      <InfoPanel title="Fuente y cobertura">
        Composición del gabinete a partir del BOE y registros oficiales.
        Contratos públicos procedentes de la Plataforma de Contratación del Sector Público (PCSP).
        La cobertura puede ser parcial si el nombre del órgano ha variado históricamente.
        {member.source_url && (
          <>
            {" "}
            <a
              href={member.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              Fuente oficial →
            </a>
          </>
        )}
      </InfoPanel>
    </div>
  )
}
