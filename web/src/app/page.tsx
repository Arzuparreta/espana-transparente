import { LogoHero } from "@/components/layout/LogoHero"
import { AnchorCard } from "@/components/domain/AnchorCard"
import { EntityLink } from "@/components/domain/EntityLink"
import { PartyBadge } from "@/components/domain/PartyBadge"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import {
  getHomeData,
  getTopContractOfMonth,
  getTopDivergenceSessionOfMonth,
} from "@/lib/data"
import { getPartyColor } from "@/lib/domain-style"

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
  const [
    { parties, recentSessions, revolvingDoorCases, gobierno, deudaPerCapita, deudaYear },
    topContract,
    topDivergenceSession,
  ] = await Promise.all([
    getHomeData(),
    getTopContractOfMonth(),
    getTopDivergenceSessionOfMonth(),
  ])

  return (
    <div className="space-y-10 sm:space-y-14">
      <LogoHero parties={parties ?? []} />

      {/* Anclas hero — mismo primitive, identidad por repetición */}
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

        {topDivergenceSession && (topDivergenceSession.divergence_count ?? 0) > 0 && (
          <AnchorCard
            label={`Mayor divergencia · ${
              topDivergenceSession.isRecent ? "últimos 30 días" : "histórico"
            }`}
            value={
              <>
                {topDivergenceSession.divergence_count}{" "}
                <span className="text-lg font-normal text-muted-foreground">
                  diputados
                </span>
              </>
            }
            description={
              <>
                <span className="line-clamp-2 font-medium text-foreground">
                  votaron diferente a su grupo en
                </span>
                <span className="mt-1 block line-clamp-2 text-xs text-muted-foreground">
                  {topDivergenceSession.title}
                  {topDivergenceSession.date
                    ? ` · ${formatDate(topDivergenceSession.date)}`
                    : ""}
                </span>
              </>
            }
            href={`/votaciones/${topDivergenceSession.id}`}
            linkLabel="Ver votación →"
          />
        )}
      </div>

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
                <div key={m.id as string} className="relative rounded-xl border bg-card/80 p-4" style={{ borderColor: `${color}28` }}>
                  {cardContent}
                  <ResponsiveLink
                    href={`/diputados/${m.politician_id as string}`}
                    className="absolute inset-0 rounded-xl"
                    aria-label={nameFormatted}
                  />
                </div>
              ) : (
                <div key={m.id as string} className="rounded-xl border bg-card/80 p-4" style={{ borderColor: `${color}28` }}>
                  {cardContent}
                </div>
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
