import { LogoHero } from "@/components/layout/LogoHero"
import { RevealSection } from "@/components/layout/RevealSection"
import { ThreadCard, type SectionCount } from "@/components/domain/ThreadCard"
import { HomePanorama } from "@/components/domain/HomePanorama"
import {
  getEtlFreshnessSummary,
  getHomeData,
  getLatestInflationAnchor,
  getSectionIndex,
  getTopContractOfMonth,
} from "@/lib/data"
import { THREADS } from "@/lib/thread-config"

export const dynamic = 'force-dynamic'

function formatShortDate(d: string): string {
  return new Date(d).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function formatCount(n: number): string {
  return n.toLocaleString("es-ES")
}

export default async function HomePage() {
  const [{ parties, deudaPerCapita, deudaYear }, freshness, sectionIndex, inflation, topContract] =
    await Promise.all([
      getHomeData(),
      getEtlFreshnessSummary(),
      getSectionIndex(),
      getLatestInflationAnchor(),
      getTopContractOfMonth(),
    ])

  // Build a lookup map from section_key → { count, unit } for ThreadCards.
  const countMap = new Map<string, SectionCount>()
  for (const row of sectionIndex) {
    if (row.record_count != null && row.record_count > 0) {
      countMap.set(row.section_key, { count: row.record_count })
    }
  }

  return (
    <div className="space-y-8 sm:space-y-10">
      <RevealSection>
        <LogoHero parties={parties ?? []} />
        {freshness.latestFinishedAt ? (
          <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground/80">
            Datos actualizados · {formatShortDate(freshness.latestFinishedAt)} ·{" "}
            {formatCount(freshness.pipelineCount)} fuentes públicas
          </p>
        ) : null}
      </RevealSection>

      <RevealSection>
        <div className="grid gap-3 sm:grid-cols-3">
          {THREADS.map((thread) => (
            <ThreadCard key={thread.key} thread={thread} counts={countMap} />
          ))}
        </div>
      </RevealSection>

      <RevealSection delayMs={150}>
        <HomePanorama
          deudaPerCapita={deudaPerCapita ?? null}
          deudaYear={deudaYear ?? null}
          topContract={topContract}
          inflation={inflation}
        />
      </RevealSection>
    </div>
  )
}
