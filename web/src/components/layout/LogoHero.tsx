import type { ReactNode } from "react"
import { SearchBox } from "@/components/search/SearchBox"
import { PartyMarquee } from "@/components/layout/PartyMarquee"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import type { HomeHeroAnchor } from "@/lib/data"

interface LogoHeroProps {
  parties?: { acronym: string; color: string | null }[]
  anchor: HomeHeroAnchor | null
}

export function LogoHero({ parties, anchor }: LogoHeroProps) {
  const uniqueParties = parties
    ? Array.from(new Map(parties.map(p => [p.acronym, p])).values())
    : []

  return (
    <section className="relative rounded border border-border bg-card px-5 py-6 sm:px-8 sm:py-8">
      <div className="relative flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-10">
        <div className="lg:flex-[1.4]">
          {anchor ? <HeroAnchor anchor={anchor} /> : <HeroFallback />}
        </div>
        <div className="lg:flex-1 lg:pt-8">
          <SearchBox />
        </div>
      </div>

      {uniqueParties.length > 0 && <PartyMarquee parties={uniqueParties} />}
    </section>
  )
}

function HeroAnchor({ anchor }: { anchor: HomeHeroAnchor }) {
  const resolver: ReactNode =
    anchor.kind === "contract" ? (
      <>
        <span className="block font-medium text-foreground">{anchor.resolver}</span>
        {anchor.resolverDetail ? (
          <span className="mt-1 block text-xs text-muted-foreground">
            {anchor.resolverDetail}
          </span>
        ) : null}
      </>
    ) : (
      anchor.resolver
    )

  return (
    <div className="min-w-0">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        {anchor.label}
      </p>
      <h1
        data-value
        className="mt-3 font-display text-6xl font-black tabular-nums leading-[0.9] tracking-[-0.03em] text-foreground sm:text-7xl lg:text-8xl"
      >
        {anchor.value}
      </h1>
      <p className="mt-5 max-w-xl text-sm leading-6 text-muted-foreground">
        {resolver}
      </p>
      <p className="mt-2 font-mono text-[11px] text-muted-foreground">
        {anchor.source}
      </p>
      <ResponsiveLink
        href={anchor.href}
        className="mt-4 inline-flex text-sm font-semibold underline underline-offset-4 hover:text-foreground"
      >
        {anchor.hrefLabel}
      </ResponsiveLink>
    </div>
  )
}

function HeroFallback() {
  return (
    <div className="min-w-0">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        El Estado español, sin filtros
      </p>
      <h1 className="mt-3 font-display text-5xl font-black uppercase leading-[0.9] tracking-[-0.03em] text-foreground sm:text-6xl lg:text-7xl">
        Datos públicos en bruto.
      </h1>
      <p className="mt-5 max-w-xl text-sm leading-6 text-muted-foreground">
        Diputados, votaciones, contratos, subvenciones y puertas giratorias —
        todo trazado a documentos primarios.
      </p>
    </div>
  )
}
