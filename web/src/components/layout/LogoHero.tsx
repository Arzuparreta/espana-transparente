import { SearchBox } from "@/components/search/SearchBox"
import { PartyBadge } from "@/components/domain/PartyBadge"
import { BRAND_DESCRIPTION } from "@/lib/brand"

interface LogoHeroProps {
  parties?: { acronym: string; color: string | null }[]
}

const COPIES = 6

export function LogoHero({ parties }: LogoHeroProps) {
  const uniqueParties = parties
    ? Array.from(new Map(parties.map(p => [p.acronym, p])).values())
    : []

  return (
    <section className="relative rounded border border-border bg-card px-5 py-6 sm:px-8 sm:py-8">
      <div className="relative space-y-5">
        <h1 className="font-display max-w-2xl text-4xl font-black uppercase leading-[0.9] tracking-[-0.03em] text-foreground sm:text-6xl lg:text-7xl">
          {BRAND_DESCRIPTION}
        </h1>
        <SearchBox />
      </div>

      {uniqueParties.length > 0 && (
        <div className="relative mt-6 overflow-hidden" aria-hidden="true">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-card via-card/80 to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-card via-card/80 to-transparent" />
          <div className="flex w-max animate-marquee items-center gap-3 py-2">
            {Array.from({ length: COPIES }, (_, i) =>
              uniqueParties.map((p) => (
                <PartyBadge
                  key={`${p.acronym}-${i}`}
                  acronym={p.acronym}
                  color={p.color}
                  className="px-3 py-1 text-xs"
                />
              ))
            )}
          </div>
        </div>
      )}
    </section>
  )
}
