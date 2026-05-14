import { SearchBox } from "@/components/search/SearchBox"
import { PartyBadge } from "@/components/domain/PartyBadge"

interface LogoHeroProps {
  parties?: { acronym: string; color: string | null }[]
}

export function LogoHero({ parties }: LogoHeroProps) {
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

      {parties && parties.length > 0 && (
        <div className="relative mt-10 -mb-2 overflow-hidden">
          <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-card to-transparent z-10" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-card to-transparent z-10" />
          <div className="flex w-max animate-marquee">
            {parties.map((p) => (
              <PartyBadge
                key={p.acronym}
                acronym={p.acronym}
                color={p.color}
                className="mx-2 text-sm px-3 py-1"
              />
            ))}
            {parties.map((p) => (
              <PartyBadge
                key={`${p.acronym}-dup`}
                acronym={p.acronym}
                color={p.color}
                className="mx-2 text-sm px-3 py-1"
              />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
