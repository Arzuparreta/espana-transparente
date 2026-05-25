import { LogoHero } from "@/components/layout/LogoHero"
import { AnchorCard } from "@/components/domain/AnchorCard"
import { PartyBadge } from "@/components/domain/PartyBadge"
import { ThreadCard } from "@/components/domain/ThreadCard"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import {
  getHomeData,
  getLatestInflationAnchor,
  getSectionIndex,
  getTopContractOfMonth,
} from "@/lib/data"
import { getPartyColor } from "@/lib/domain-style"
import { THREADS } from "@/lib/thread-config"

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
    { parties, gobierno, deudaPerCapita, deudaYear },
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

      <section aria-labelledby="threads-heading">
        <div className="mb-5">
          <p className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground/80">
            Cinco temas
          </p>
          <h2
            id="threads-heading"
            className="font-display text-3xl font-black uppercase tracking-[-0.02em] sm:text-4xl"
          >
            Explora por lo que te importa
          </h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {THREADS.map((thread) => (
            <ThreadCard key={thread.key} thread={thread} />
          ))}
        </div>
      </section>

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

    </div>
  )
}
