import { SearchBox } from "@/components/search/SearchBox"
import { PartyBadge } from "@/components/domain/PartyBadge"
import { LogoMark } from "@/components/brand/LogoMark"
import { BRAND_LONG_DESCRIPTION } from "@/lib/brand"

interface LogoHeroProps {
  parties?: { acronym: string; color: string | null }[]
}

const COPIES = 6

export function LogoHero({ parties }: LogoHeroProps) {
  const uniqueParties = parties
    ? Array.from(new Map(parties.map(p => [p.acronym, p])).values())
    : []

  return (
    <section className="relative overflow-hidden rounded-xl border border-border/80 bg-card px-5 py-10 shadow-sm sm:px-8 sm:py-14">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,hsl(var(--brand-signal)/0.08),transparent_28%),radial-gradient(circle_at_20%_10%,hsl(var(--foreground)/0.08),transparent_22%)]" />
      <div className="flex flex-col items-center gap-6 text-center">
        <div className="grid h-20 w-20 place-items-center rounded-2xl border border-border bg-background shadow-sm">
          <LogoMark className="h-14 w-14" variant="accent" />
        </div>
        <div className="space-y-2">
          <h1 className="font-display text-5xl font-semibold tracking-[-0.055em] text-primary sm:text-7xl">
            Datos públicos
          </h1>
          <p className="text-lg font-medium tracking-tight text-muted-foreground sm:text-2xl">
            de la política española
          </p>
        </div>
        <p className="mx-auto max-w-2xl text-balance text-base leading-7 text-muted-foreground">
          {BRAND_LONG_DESCRIPTION}
        </p>
        <SearchBox />
      </div>

      {uniqueParties.length > 0 && (
        <div className="relative mt-10 overflow-hidden" aria-hidden="true">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 bg-gradient-to-r from-card via-card/80 to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 bg-gradient-to-l from-card via-card/80 to-transparent" />
          <div className="flex w-max animate-marquee items-center gap-4 py-3">
            {Array.from({ length: COPIES }, (_, i) =>
              uniqueParties.map((p) => (
                <PartyBadge
                  key={`${p.acronym}-${i}`}
                  acronym={p.acronym}
                  color={p.color}
                  className="px-4 py-1.5 text-sm"
                />
              ))
            )}
          </div>
        </div>
      )}
    </section>
  )
}
