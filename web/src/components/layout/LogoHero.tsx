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
    <section className="relative overflow-hidden rounded-xl border border-border/80 bg-card px-5 py-6 shadow-sm sm:px-8 sm:py-8">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,hsl(var(--brand-signal)/0.06),transparent_32%)]" />
      <div className="relative flex flex-col gap-5">
        <h1 className="font-display max-w-3xl text-balance text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-3xl">
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
