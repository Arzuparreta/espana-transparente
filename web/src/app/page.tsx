import type { PoliticianWithMemberships } from "@/types"
import { PoliticianCard } from "@/components/politicians/PoliticianCard"
import { LogoHero } from "@/components/layout/LogoHero"
import { StatGrid } from "@/components/domain/StatGrid"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { getHomeData } from "@/lib/data"

export const revalidate = 3600

function formatBig(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(0)}B €`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M €`
  if (n >= 1_000) return `${Math.round(n / 1_000)}K €`
  return `${Math.round(n)} €`
}

export default async function HomePage() {
  const {
    politicians,
    politicianCount,
    parties,
    contractCount,
    subsidyCount,
    currentBudget,
  } = await getHomeData()
  const stats = [
    {
      label: "Diputados activos",
      value: `${politicianCount}`,
      hint: "Con ficha individual, trayectoria y voto registrados.",
    },
    ...(currentBudget
      ? [
          {
            label: `Presupuesto vigente ${currentBudget.year}`,
            value: formatBig(currentBudget.total),
            hint:
              currentBudget.budgetType === "prorroga"
                ? "Crédito inicial hoy en vigor por prórroga presupuestaria."
                : "Crédito inicial hoy en vigor.",
          },
        ]
      : []),
    {
      label: "Contratos públicos",
      value: contractCount.toLocaleString("es-ES"),
      hint: "Licitaciones en PCSP con importe publicado.",
    },
    {
      label: "Subvenciones",
      value: subsidyCount.toLocaleString("es-ES"),
      hint: "Concesiones en BDNS a entidades organizativas.",
    },
  ]

  return (
    <div className="space-y-8 sm:space-y-12">
      <LogoHero parties={parties ?? []} />

      <StatGrid items={stats} className={stats.length === 3 ? "xl:grid-cols-3" : "xl:grid-cols-4"} />

      {/* Diputados — punto de entrada principal a personas */}
      <section>
        <div className="mb-4 flex min-w-0 items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold tracking-tight">Diputados</h3>
            <p className="text-sm text-muted-foreground">
              Fichas individuales con trayectoria, votaciones y relaciones registradas.
            </p>
          </div>
          <ResponsiveLink
            href="/diputados"
            className="shrink-0 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Ver todos →
          </ResponsiveLink>
        </div>
        <div className="ui-grid-cards">
          {(politicians as unknown as PoliticianWithMemberships[]).map((p) => (
            <PoliticianCard key={p.id} politician={p} />
          ))}
        </div>
      </section>
    </div>
  )
}
