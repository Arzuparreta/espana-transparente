import { LogoHero } from "@/components/layout/LogoHero"
import { RevealSection } from "@/components/layout/RevealSection"
import { ThreadCard } from "@/components/domain/ThreadCard"
import { getEtlFreshnessSummary, getHomeData } from "@/lib/data"
import { THREADS } from "@/lib/thread-config"

export const revalidate = 3600

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
  const [{ parties }, freshness] = await Promise.all([
    getHomeData(),
    getEtlFreshnessSummary(),
  ])

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
        <section aria-labelledby="threads-heading">
          <div className="mb-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground/80">
              Cinco temas
            </p>
            <h2
              id="threads-heading"
              className="mt-1 font-display text-2xl font-black uppercase tracking-[-0.02em] sm:text-3xl"
            >
              ¿Qué quieres explorar?
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
