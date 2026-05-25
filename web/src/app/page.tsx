import type { ReactNode } from "react"
import { LogoHero } from "@/components/layout/LogoHero"
import { RevealSection } from "@/components/layout/RevealSection"
import { AnchorCard } from "@/components/domain/AnchorCard"
import { PartyBadge } from "@/components/domain/PartyBadge"
import { ThreadCard } from "@/components/domain/ThreadCard"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import {
  getEtlFreshnessSummary,
  getEuFundsSummary,
  getHomeData,
  getLatestInflationAnchor,
  getSectionIndex,
  getTopContractOfMonth,
} from "@/lib/data"
import { getAutonomicLanding, getMunicipalLanding } from "@/lib/data/multilevel"
import { getPartyColor } from "@/lib/domain-style"
import { THREADS, getThread, type ThreadConfig } from "@/lib/thread-config"

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

function formatShortDate(d: string): string {
  return new Date(d).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
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
  return date.toLocaleDateString("es-ES", { month: "long", year: "numeric" })
}

function formatCount(n: number): string {
  return n.toLocaleString("es-ES")
}

// Sequenced narrative section. Each thread is introduced by its citizen
// question, anchored by real numbers, and exits with a link into the thread.
function NarrativeSection({
  thread,
  children,
  delayMs,
}: {
  thread: ThreadConfig
  children: ReactNode
  delayMs?: number
}) {
  return (
    <RevealSection delayMs={delayMs}>
      <section
        aria-labelledby={`thread-${thread.key}`}
        className="border-t border-border pt-8 sm:pt-10"
      >
        <div className="mb-5 flex min-w-0 items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground/80">
              {thread.question}
            </p>
            <h2
              id={`thread-${thread.key}`}
              className="font-display text-3xl font-black uppercase tracking-[-0.02em] sm:text-4xl"
            >
              {thread.label}
            </h2>
          </div>
          <ResponsiveLink
            href={thread.href}
            className="inline-flex shrink-0 items-end py-2 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Explorar {thread.label} →
          </ResponsiveLink>
        </div>
        {children}
      </section>
    </RevealSection>
  )
}

export default async function HomePage() {
  const [
    { parties, gobierno, deudaPerCapita, deudaYear },
    topContract,
    inflation,
    sectionIndex,
    euSummary,
    freshness,
    autonomic,
    municipal,
  ] = await Promise.all([
    getHomeData(),
    getTopContractOfMonth(),
    getLatestInflationAnchor(),
    getSectionIndex(),
    getEuFundsSummary(),
    getEtlFreshnessSummary(),
    getAutonomicLanding(),
    getMunicipalLanding(),
  ])

  const sectionFacts = new Map(
    sectionIndex.map((row) => [
      row.section_key,
      { count: row.record_count ?? 0, latestDate: row.latest_date },
    ])
  )
  const factCount = (key: string): number => sectionFacts.get(key)?.count ?? 0

  const economia = getThread("economia")
  const dinero = getThread("dinero")
  const integridad = getThread("integridad")
  const poder = getThread("poder")
  const territorio = getThread("territorio")

  const judicialCount = factCount("corrupcion")
  const revolvingCount = factCount("puertas-giratorias")
  const institutionsCount = factCount("instituciones")
  const votacionesCount = factCount("votaciones")
  const iniciativasCount = factCount("iniciativas")

  return (
    <div className="space-y-10 sm:space-y-12">
      <RevealSection>
        <LogoHero parties={parties ?? []} />
        {freshness.latestFinishedAt ? (
          <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground/80">
            Datos actualizados · {formatShortDate(freshness.latestFinishedAt)} ·{" "}
            {formatCount(freshness.pipelineCount)} fuentes públicas
          </p>
        ) : null}
      </RevealSection>

      {/* Economía — Curation: latest available period for each series; periods never mixed. */}
      {(deudaPerCapita != null || inflation) && (
        <NarrativeSection thread={economia}>
          <div className="grid gap-4 lg:grid-cols-2">
            {deudaPerCapita != null && (
              <AnchorCard
                label={`Deuda pública por ciudadano${deudaYear ? ` · ${deudaYear}` : ""}`}
                value={`${deudaPerCapita.toLocaleString("es-ES")} €`}
                description="Por cada persona en España, esto es lo que debe el Estado: deuda pública total dividida entre la población."
                source="Fuente: Eurostat (criterio de Maastricht)."
                href="/indicadores/DEUDA_PUBLICA"
                linkLabel="Ver serie →"
              />
            )}
            {inflation && (
              <AnchorCard
                label={`IPC mensual · ${formatPeriod(inflation.period)}`}
                value={formatPercent(inflation.monthlyValue)}
                description={
                  <>
                    <span className="block font-medium text-foreground">
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
            )}
          </div>
        </NarrativeSection>
      )}

      {/* Dinero — Curation: single largest contract in the most recent non-empty 30/60/90-day window. */}
      <NarrativeSection thread={dinero}>
        <div className="grid gap-4 lg:grid-cols-2">
          {topContract && topContract.amount != null ? (
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
              source="Fuente: Plataforma de Contratación del Sector Público."
              href={`/contratos/${topContract.id}`}
              linkLabel="Ver contrato →"
            />
          ) : null}
          {euSummary ? (
            <AnchorCard
              label="Fondos europeos · 2014-2027"
              value={formatAmount(Number(euSummary.total_eu_budget))}
              description={`${Number(euSummary.beneficiary_count).toLocaleString("es-ES")} beneficiarios españoles registrados en Kohesio.`}
              source="Fuente: Comisión Europea · Kohesio."
              href="/fondos-ue"
              linkLabel="Ver fondos UE →"
            />
          ) : null}
        </div>
      </NarrativeSection>

      {/* Integridad — Curation: published record counts only; no individual case is singled out on the home. */}
      {(judicialCount > 0 || revolvingCount > 0 || institutionsCount > 0) && (
        <NarrativeSection thread={integridad}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <AnchorCard
              variant="compact"
              label="Procesos judiciales"
              value={formatCount(judicialCount)}
              description="Casos publicados por fuentes judiciales o registros públicos revisados."
              href="/corrupcion"
              linkLabel="Ver procesos →"
            />
            <AnchorCard
              variant="compact"
              label="Puertas giratorias"
              value={formatCount(revolvingCount)}
              description="Casos con fuente primaria o revisión documental antes de publicarse."
              href="/puertas-giratorias"
              linkLabel="Ver casos →"
            />
            <AnchorCard
              variant="compact"
              label="Nombramientos institucionales"
              value={formatCount(institutionsCount)}
              description="Cargos en TC, CGPJ, RTVE y SEPI con persona y fuente asociada."
              href="/instituciones"
              linkLabel="Ver instituciones →"
            />
          </div>
        </NarrativeSection>
      )}

      {/* Poder — Curation: sitting president + vice-presidents from v_gobierno_actual. */}
      {gobierno.length > 0 && (
        <NarrativeSection thread={poder}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {gobierno.map((m) => {
              const color = getPartyColor(m.party_color as string | undefined)
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
                <div
                  key={m.id as string}
                  className="relative rounded border bg-card p-4"
                  style={{ borderColor: `${color}28` }}
                >
                  {cardContent}
                  <ResponsiveLink
                    href={`/diputados/${m.politician_id as string}`}
                    className="absolute inset-0 rounded"
                    aria-label={nameFormatted}
                  />
                </div>
              ) : (
                <div
                  key={m.id as string}
                  className="rounded border bg-card p-4"
                  style={{ borderColor: `${color}28` }}
                >
                  {cardContent}
                </div>
              )
            })}
          </div>
          {(votacionesCount > 0 || iniciativasCount > 0) && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {votacionesCount > 0 && (
                <AnchorCard
                  variant="compact"
                  label="Votaciones nominales"
                  value={formatCount(votacionesCount)}
                  description="Sesiones con voto nominal y resultado individual por diputado."
                  href="/votaciones"
                  linkLabel="Ver votaciones →"
                />
              )}
              {iniciativasCount > 0 && (
                <AnchorCard
                  variant="compact"
                  label="Iniciativas registradas"
                  value={formatCount(iniciativasCount)}
                  description="Proyectos de ley, proposiciones y mociones en tramitación."
                  href="/iniciativas"
                  linkLabel="Ver iniciativas →"
                />
              )}
            </div>
          )}
        </NarrativeSection>
      )}

      {/* Territorio — Curation: territory coverage counts; no territory ranked or highlighted. */}
      {(autonomic.territories.length > 0 || municipal.territories.length > 0) && (
        <NarrativeSection thread={territorio}>
          <div className="grid gap-4 sm:grid-cols-2">
            <AnchorCard
              variant="compact"
              label="Ámbito autonómico"
              value={formatCount(autonomic.territories.length)}
              description={`${formatCount(autonomic.summary.subsidyCount + autonomic.summary.contractCount)} registros autonómicos con contratos o subvenciones.`}
              href="/ccaa"
              linkLabel="Ver CCAA →"
            />
            <AnchorCard
              variant="compact"
              label="Ámbito local"
              value={formatCount(municipal.territories.length)}
              description={`${formatCount(municipal.summary.subsidyCount + municipal.summary.contractCount)} registros municipales o locales publicados por fuente.`}
              href="/municipios"
              linkLabel="Ver municipios →"
            />
          </div>
        </NarrativeSection>
      )}

      <RevealSection>
        <section
          aria-labelledby="threads-heading"
          className="border-t border-border pt-8 sm:pt-10"
        >
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
      </RevealSection>
    </div>
  )
}
