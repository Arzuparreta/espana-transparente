import type { PoliticianWithMemberships } from "@/types"
import { PoliticianCard } from "@/components/politicians/PoliticianCard"
import { LogoHero } from "@/components/layout/LogoHero"
import { EntityLink } from "@/components/domain/EntityLink"
import { StatGrid } from "@/components/domain/StatGrid"
import { PartyBadge } from "@/components/domain/PartyBadge"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { getHomeData } from "@/lib/data"
import { getPartyColor } from "@/lib/domain-style"

export const revalidate = 3600

function formatBig(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(0)}B €`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M €`
  if (n >= 1_000) return `${Math.round(n / 1_000)}K €`
  return `${Math.round(n)} €`
}


function SectionHeader({
  title,
  subtitle,
  href,
  linkLabel = "Ver todo →",
}: {
  title: string
  subtitle?: string
  href: string
  linkLabel?: string
}) {
  return (
    <div className="mb-4 flex min-w-0 items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      <ResponsiveLink
        href={href}
        className="shrink-0 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
      >
        {linkLabel}
      </ResponsiveLink>
    </div>
  )
}

export default async function HomePage() {
  const {
    politicians,
    politicianCount,
    parties,
    contractCount,
    subsidyCount,
    sessionCount,
    currentBudget,
    recentSessions,
    revolvingDoorCases,
    gobierno,
    deudaPerCapita,
    deudaYear,
  } = await getHomeData()

  const stats = [
    { label: "Diputados activos", value: `${politicianCount}` },
    { label: "Licitaciones publicadas", value: contractCount.toLocaleString("es-ES") },
    { label: "Subvenciones registradas", value: subsidyCount.toLocaleString("es-ES") },
    { label: "Votaciones en el Congreso", value: sessionCount.toLocaleString("es-ES") },
    ...(currentBudget
      ? [{ label: `Presupuesto ${currentBudget.year}`, value: formatBig(currentBudget.total) }]
      : []),
  ]

  return (
    <div className="space-y-10 sm:space-y-14">
      <LogoHero parties={parties ?? []} />

      {/* Hero: deuda pública per cápita */}
      {deudaPerCapita != null && (
        <section className="rounded-2xl border border-border/60 bg-card/60 px-6 py-8 sm:px-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Deuda pública del Estado español por ciudadano{deudaYear ? ` · ${deudaYear}` : ""}
          </p>
          <p className="mt-2 text-4xl font-extrabold tabular-nums tracking-tight sm:text-5xl">
            {deudaPerCapita.toLocaleString("es-ES")} €
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Fuente: Eurostat · Administraciones Públicas (S13) · Criterio de Maastricht
          </p>
          <ResponsiveLink
            href="/indicadores"
            className="mt-4 inline-block text-sm font-medium underline underline-offset-4 hover:text-foreground"
          >
            Ver indicadores económicos →
          </ResponsiveLink>
        </section>
      )}

      <StatGrid items={stats} />


      {/* Gobierno */}
      {gobierno.length > 0 && (
        <section>
          <SectionHeader title="Gobierno" href="/gobierno" linkLabel="Gabinete completo →" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {gobierno.map((m) => {
              const color = getPartyColor(m.party_color)
              const nameFormatted = (m.person_name as string)
                .split(",")
                .map((s: string) => s.trim())
                .reverse()
                .join(" ")
              const card = (
                <div
                  key={m.id as string}
                  className="rounded-xl border bg-card/80 p-4"
                  style={{ borderColor: `${color}28` }}
                >
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
                </div>
              )
              return m.politician_id ? (
                <EntityLink key={m.id as string} kind="politician" id={m.politician_id as string}>
                  {card}
                </EntityLink>
              ) : (
                <div key={m.id as string}>{card}</div>
              )
            })}
          </div>
        </section>
      )}

      {/* Votaciones recientes */}
      {recentSessions.length > 0 && (
        <section>
          <SectionHeader
            title="Votaciones"
            subtitle="Sesiones del Congreso con diputados que votaron diferente a su grupo"
            href="/votaciones"
          />
          <ul className="space-y-2">
            {recentSessions.map((s) => (
              <li key={s.id as string}>
                <EntityLink
                  kind="voting-session"
                  id={s.id as string}
                  className="flex min-w-0 items-baseline justify-between gap-4 rounded-lg border border-border/60 bg-card/80 px-4 py-3 text-sm transition-colors hover:border-border hover:bg-card"
                >
                  <span className="min-w-0 truncate font-medium">{s.title as string}</span>
                  <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                    {(s.divergence_count as number) > 0 && (
                      <span className="mr-2 rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-700 dark:text-amber-400">
                        {s.divergence_count as number} divergencia{(s.divergence_count as number) !== 1 ? "s" : ""}
                      </span>
                    )}
                    {new Date(s.date as string).toLocaleDateString("es-ES", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </EntityLink>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Diputados */}
      <section>
        <SectionHeader
          title="Diputados"
          subtitle="Las 350 personas que aprueban las leyes y el presupuesto del Estado"
          href="/diputados"
        />
        <div className="ui-grid-cards">
          {(politicians as unknown as PoliticianWithMemberships[]).map((p) => (
            <PoliticianCard key={p.id} politician={p} />
          ))}
        </div>
      </section>

      {/* Puertas giratorias */}
      {revolvingDoorCases.length > 0 && (
        <section>
          <SectionHeader
            title="Puertas giratorias verificadas"
            subtitle="Cargos públicos que pasaron al sector privado tras dejar sus funciones"
            href="/puertas-giratorias"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {revolvingDoorCases.map((c) => (
              <ResponsiveLink
                key={c.id as string}
                href={c.person_id ? `/diputados/${c.person_id as string}` : "/puertas-giratorias"}
                className="rounded-xl border border-border/60 bg-card/80 px-4 py-3 transition-colors hover:border-border hover:bg-card"
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
