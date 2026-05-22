import { LogoHero } from "@/components/layout/LogoHero"
import { AnchorCard } from "@/components/domain/AnchorCard"
import { EntityLink } from "@/components/domain/EntityLink"
import { PartyBadge } from "@/components/domain/PartyBadge"
import { SectionIndexCard } from "@/components/domain/SectionIndexCard"
import { SectionIcon, groupIconName, sectionIconForKey } from "@/components/brand/SectionIcon"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import {
  getHomeData,
  getLatestInflationAnchor,
  getSectionIndex,
  getTopContractOfMonth,
  type SessionDivergenceExample,
} from "@/lib/data"
import { getPartyColor } from "@/lib/domain-style"
import { ATLAS_GROUPS } from "@/lib/nav-config"

export const revalidate = 3600

function formatAmount(n: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n)
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function windowLabel(days: 30 | 60 | 90 | null): string {
  if (days === 30) return "últimos 30 días"
  if (days === 60) return "últimos 60 días"
  if (days === 90) return "últimos 90 días"
  return "histórico"
}

function formatPercent(value: number): string {
  const sign = value > 0 ? "+" : ""
  return `${sign}${value.toLocaleString("es-ES", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`
}

function formatPeriod(period: string): string {
  const [year, month] = period.split("-")
  const date = new Date(Number(year), Number(month) - 1, 1)
  return date.toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric",
  })
}

function formatCount(n: number): string {
  return n.toLocaleString("es-ES")
}

function SectionHeader({
  eyebrow,
  title,
  subtitle,
  href,
  linkLabel = "Ver todo →",
}: {
  eyebrow?: string
  title: string
  subtitle?: string
  href: string
  linkLabel?: string
}) {
  return (
    <div className="mb-5 flex min-w-0 items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground/80">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="font-display text-3xl font-black uppercase tracking-[-0.02em] sm:text-4xl">
          {title}
        </h2>
        {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      <ResponsiveLink
        href={href}
        className="inline-flex shrink-0 items-end py-2 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
      >
        {linkLabel}
      </ResponsiveLink>
    </div>
  )
}

export default async function HomePage() {
  const [
    { parties, recentSessions, sessionDivergenceExamples, revolvingDoorCases, gobierno, deudaPerCapita, deudaYear, sessionCount },
    topContract,
    inflation,
    sectionIndex,
  ] = await Promise.all([
    getHomeData(),
    getTopContractOfMonth(),
    getLatestInflationAnchor(),
    getSectionIndex(),
  ])

  const sectionFacts = new Map(
    sectionIndex.map((row) => [
      row.section_key,
      { count: row.record_count, latestDate: row.latest_date },
    ])
  )

  const gobiernoCount = sectionFacts.get("gobierno")?.count ?? gobierno.length
  const revolvingDoorCount = sectionFacts.get("puertas_giratorias")?.count ?? null

  return (
    <div className="space-y-10 sm:space-y-14">
      <LogoHero parties={parties ?? []} />

      <div className="grid gap-4 lg:grid-cols-3">
        {deudaPerCapita != null && (
          <AnchorCard
            label={`Deuda pública por ciudadano${deudaYear ? ` · ${deudaYear}` : ""}`}
            value={`${deudaPerCapita.toLocaleString("es-ES")} €`}
            description="Por cada persona en España, esto es lo que debe el Estado: deuda pública total dividida entre la población."
            source="Fuente: Eurostat (criterio de Maastricht)."
            href="/indicadores"
            linkLabel="Ver indicadores →"
          />
        )}

        {topContract && topContract.amount != null && (
          <AnchorCard
            label={`Mayor contrato · ${windowLabel(topContract.windowDays)}`}
            value={formatAmount(topContract.amount)}
            description={
              <>
                <span className="line-clamp-2 font-medium text-foreground">
                  {topContract.title}
                </span>
                {topContract.awarding_body ? (
                  <span className="mt-1 block text-xs text-muted-foreground line-clamp-1">
                    {topContract.awarding_body}
                    {topContract.date ? ` · ${formatDate(topContract.date)}` : ""}
                  </span>
                ) : null}
              </>
            }
            href={`/contratos/${topContract.id}`}
            linkLabel="Ver contrato →"
          />
        )}

        {inflation ? (
          <AnchorCard
            label={`IPC mensual · ${formatPeriod(inflation.period)}`}
            value={formatPercent(inflation.monthlyValue)}
            description={
              <>
                <span className="line-clamp-2 font-medium text-foreground">
                  Variación mensual del índice general de precios.
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {inflation.annualValue != null
                    ? `Variación anual: ${formatPercent(inflation.annualValue)}`
                    : "Serie mensual nacional"}
                  {inflation.dataType ? ` · ${inflation.dataType}` : ""}
                </span>
              </>
            }
            source="Fuente: INE, serie nacional del IPC."
            href="/indicadores/IPC_VAR_MENSUAL"
            linkLabel="Ver serie →"
          />
        ) : null}
      </div>

      {gobierno.length > 0 && (
        <section>
          <SectionHeader
            eyebrow="Miembros del ejecutivo"
            title="Gobierno"
            href="/gobierno"
            linkLabel={gobiernoCount ? `Gabinete completo (${formatCount(gobiernoCount)}) →` : "Gabinete completo →"}
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {gobierno.map((m) => {
              const color = getPartyColor(m.party_color)
              const nameFormatted = (m.person_name as string)
                .split(",")
                .map((s: string) => s.trim())
                .reverse()
                .join(" ")
              const cardContent = (
                <>
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {m.organization_name as string}
                  </p>
                  <p className="mt-1 font-semibold leading-snug">{nameFormatted}</p>
                  <div className="mt-2">
                    <PartyBadge
                      acronym={m.political_party as string}
                      color={m.party_color as string | undefined}
                    />
                  </div>
                </>
              )
              return m.politician_id ? (
                <div key={m.id as string} className="relative rounded border bg-card p-4" style={{ borderColor: `${color}28` }}>
                  {cardContent}
                  <ResponsiveLink
                    href={`/diputados/${m.politician_id as string}`}
                    className="absolute inset-0 rounded"
                    aria-label={nameFormatted}
                  />
                </div>
              ) : (
                <div key={m.id as string} className="rounded border bg-card p-4" style={{ borderColor: `${color}28` }}>
                  {cardContent}
                </div>
              )
            })}
          </div>
        </section>
      )}

      <section aria-labelledby="atlas-heading" className="space-y-6">
        <div className="flex min-w-0 items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground/80">
              Atlas del portal
            </p>
            <h2
              id="atlas-heading"
              className="font-display text-3xl font-black uppercase tracking-[-0.02em] sm:text-4xl"
            >
              Qué hay aquí
            </h2>
          </div>
          <ResponsiveLink
            href="/estado-datos"
            className="hidden shrink-0 py-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline sm:inline-flex"
          >
            Estado de los datos →
          </ResponsiveLink>
        </div>

        {ATLAS_GROUPS.map((group) => {
          const groupIcon = groupIconName(group.label)
          return (
            <div key={group.label} className="space-y-3">
              <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                {groupIcon ? (
                  <SectionIcon name={groupIcon} size={16} className="text-foreground/80" />
                ) : null}
                {group.label}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.items.map((item) => {
                  const facts = sectionFacts.get(item.countKey)
                  return (
                    <SectionIndexCard
                      key={item.href}
                      href={item.href}
                      label={item.label}
                      description={item.description}
                      count={facts?.count ?? null}
                      countUnit={item.countUnit}
                      latestDate={facts?.latestDate ?? null}
                      icon={sectionIconForKey(item.countKey)}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </section>

      {recentSessions.length > 0 && (
        <section>
          <SectionHeader
            eyebrow="Sesiones recientes"
            title="Votaciones"
            subtitle="Sesiones del Congreso con diputados que votaron diferente a su grupo"
            href="/votaciones"
            linkLabel={sessionCount ? `Ver las ${formatCount(sessionCount)} votaciones →` : "Ver todas →"}
          />
          <ul className="space-y-2">
            {recentSessions.map((s) => {
              const sessionId = s.id as string
              const example = sessionDivergenceExamples?.[sessionId]
              const divergenceCount = (s.divergence_count as number) ?? 0
              return (
                <li key={sessionId}>
                  <EntityLink
                    kind="voting-session"
                    id={sessionId}
                    className="flex min-w-0 flex-col gap-1.5 rounded-[2px] border border-border/60 bg-card px-4 py-3 text-sm transition-colors hover:border-foreground/40"
                  >
                    <div className="flex min-w-0 items-baseline justify-between gap-4">
                      <span className="min-w-0 truncate font-medium">{s.title as string}</span>
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">
                        {divergenceCount > 0 && (
                          <span className="mr-2 rounded border border-accent/35 bg-accent/10 px-2 py-0.5 font-mono text-xs uppercase tracking-[0.08em] text-accent">
                            {divergenceCount} divergencia{divergenceCount !== 1 ? "s" : ""}
                          </span>
                        )}
                        {new Date(s.date as string).toLocaleDateString("es-ES", {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    </div>
                    {example ? <DivergenceTrace example={example} /> : null}
                  </EntityLink>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {revolvingDoorCases.length > 0 && (
        <section>
          <SectionHeader
            eyebrow="Casos verificados"
            title="Puertas giratorias"
            subtitle="Cargos públicos que pasaron al sector privado tras dejar sus funciones"
            href="/puertas-giratorias"
            linkLabel={
              revolvingDoorCount
                ? `Ver los ${formatCount(revolvingDoorCount)} casos →`
                : "Ver todos los casos →"
            }
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {revolvingDoorCases.map((c) => (
              <ResponsiveLink
                key={c.id as string}
                href={c.person_id ? `/diputados/${c.person_id as string}` : "/puertas-giratorias"}
                className="rounded border border-border bg-card px-4 py-3 transition-colors hover:border-foreground/30"
              >
                <p className="font-semibold">{c.person_name as string}</p>
                <p className="mt-0.5 text-sm text-muted-foreground line-clamp-1">
                  {c.public_role as string} → {c.private_organization as string}
                </p>
                {c.sector && (
                  <p className="mt-1 text-xs text-muted-foreground">{c.sector as string}</p>
                )}
              </ResponsiveLink>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function DivergenceTrace({ example }: { example: SessionDivergenceExample }) {
  // Reformat "APELLIDOS, Nombre" already-canonical surname-first names.
  const nameDisplay = example.full_name.includes(",")
    ? example.full_name
    : (() => {
        // Heuristic for "Nombre Apellidos" → "APELLIDOS, Nombre" (best-effort).
        const parts = example.full_name.trim().split(/\s+/)
        if (parts.length < 2) return example.full_name
        const given = parts[0]
        const surname = parts.slice(1).join(" ")
        return `${surname.toUpperCase()}, ${given}`
      })()
  const majorityFragment = example.party_majority
    ? ` · su grupo votó ${example.party_majority}`
    : ""
  return (
    <p className="font-mono text-[11px] leading-snug text-muted-foreground">
      <span className="text-accent">▲</span>{" "}
      <span className="text-foreground">{nameDisplay}</span>
      {example.party_acronym ? <span> ({example.party_acronym})</span> : null}{" "}
      votó {example.vote}
      {majorityFragment}
    </p>
  )
}

