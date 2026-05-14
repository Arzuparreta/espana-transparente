import { SearchBox } from "@/components/search/SearchBox"
import { PartyBadge } from "@/components/domain/PartyBadge"

interface LogoHeroProps {
  parties?: { acronym: string; color: string | null }[]
}

const COPIES = 6

export function LogoHero({ parties }: LogoHeroProps) {
  const uniqueParties = parties
    ? Array.from(new Map(parties.map(p => [p.acronym, p])).values())
    : []

  return (
    <section className="relative overflow-hidden rounded-[calc(var(--radius)+0.4rem)] border border-border/70 bg-card px-5 py-10 shadow-sm sm:px-8 sm:py-14">
      <div className="flex flex-col items-center gap-6 text-center">
        <div className="space-y-2">
          <h1 className="text-6xl font-bold tracking-tighter text-primary sm:text-8xl">
            350
          </h1>
          <p className="text-xl font-medium tracking-tight text-muted-foreground sm:text-2xl">
            personas bajo la lupa
          </p>
        </div>
        <p className="mx-auto max-w-2xl text-balance text-base leading-7 text-muted-foreground">
          Datos del Congreso de los Diputados. Cada voto, cada declaración, cada contrato,
          enlazado a la persona que lo decide.
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
