import { SearchBox } from "@/components/search/SearchBox"

export function LogoHero() {
  return (
    <section className="relative rounded-[2px] border border-border bg-card px-5 py-4 sm:px-8 sm:py-5">
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-4xl font-black uppercase leading-[0.9] tracking-[-0.03em] text-foreground sm:text-5xl lg:text-6xl">
          El Estado español. Sin filtros.
        </h1>
        <SearchBox />
      </div>
    </section>
  )
}
