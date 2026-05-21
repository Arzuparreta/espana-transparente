import { SearchBox } from "@/components/search/SearchBox"
import { PartyMarquee } from "@/components/layout/PartyMarquee"

interface LogoHeroProps {
  parties?: { acronym: string; color: string | null }[]
}

export function LogoHero({ parties }: LogoHeroProps) {
  const uniqueParties = parties
    ? Array.from(new Map(parties.map(p => [p.acronym, p])).values())
    : []

  return (
    <section className="relative rounded border border-border bg-card px-5 py-6 sm:px-8 sm:py-8">
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-10">
        <div className="lg:flex-1">
          <h1 className="font-display text-4xl font-black uppercase leading-[0.9] tracking-[-0.03em] text-foreground sm:text-6xl lg:text-7xl">
            El Estado español.<br />
            Sin filtros.
          </h1>
        </div>
        <div className="lg:flex-1 lg:pt-2">
          <SearchBox />
        </div>
      </div>

      {uniqueParties.length > 0 && <PartyMarquee parties={uniqueParties} />}
    </section>
  )
}
