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
    sessionsCount,
    contractCount,
    subsidyCount,
    revolvingDoorCount,
    budgetTotal,
    latestIpc,
  } = await getHomeData()

  const ipcValue = latestIpc?.value != null
    ? `${Number(latestIpc.value).toFixed(1)}`
    : "—"
  const ipcPeriod = latestIpc?.period
    ? (latestIpc.period as string).replace(/^(\d{4})-(\d{2})$/, "$2/$1")
    : null

  return (
    <div className="space-y-8 sm:space-y-12">
      <LogoHero parties={parties ?? []} />

      {/* Personas y sus decisiones */}
      <StatGrid
        items={[
          {
            label: "Diputados activos",
            value: `${politicianCount}`,
            hint: "Con ficha individual, trayectoria y voto registrados.",
          },
          {
            label: "Partidos con escaños",
            value: `${parties.length}`,
            hint: "Con representación en la XV Legislatura.",
          },
          {
            label: "Votaciones",
            value: `${sessionsCount}`,
            hint: "Sesiones con voto individual desglosado.",
          },
        ]}
      />

      {/* Dinero público que gestionan */}
      <StatGrid
        items={[
          {
            label: "Presupuesto del Estado 2023",
            value: formatBig(budgetTotal),
            hint: "Crédito inicial consolidado. Fuente: Civio / SEPG.",
          },
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
        ]}
      />

      {/* Contexto: IPC y puertas giratorias */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <ResponsiveLink
          href="/indicadores"
          className="rounded-xl border border-border/70 bg-card/70 px-4 py-3 transition-colors hover:bg-card"
        >
          <div className="text-2xl font-semibold tabular-nums">{ipcValue}</div>
          <div className="text-xs text-muted-foreground">
            IPC{ipcPeriod ? ` · ${ipcPeriod}` : ""}
          </div>
        </ResponsiveLink>
        <ResponsiveLink
          href="/puertas-giratorias"
          className="rounded-xl border border-border/70 bg-card/70 px-4 py-3 transition-colors hover:bg-card"
        >
          <div className="text-2xl font-semibold tabular-nums">{revolvingDoorCount}</div>
          <div className="text-xs text-muted-foreground">Puertas giratorias documentadas</div>
        </ResponsiveLink>
      </div>

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
