import { LogoMark } from "@/components/brand/LogoMark"

export function LogoHero() {
  return (
    <section className="relative overflow-hidden rounded-[calc(var(--radius)+0.4rem)] border border-border/70 bg-card px-5 py-8 shadow-sm sm:px-8 sm:py-10">
      <div className="absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top,hsl(var(--accent)),transparent_68%)]" />
      <div className="absolute left-1/2 top-8 h-40 w-40 -translate-x-1/2 rounded-full border border-primary/10" />
      <div className="relative flex flex-col items-center gap-5 text-center">
        <div className="rounded-[1.45rem] border border-primary/15 bg-primary p-5 text-primary-foreground shadow-[0_20px_60px_-36px_hsl(var(--primary))]">
          <LogoMark className="h-20 w-20 sm:h-24 sm:w-24" />
        </div>
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">Acción Humana</h1>
          <p className="mx-auto max-w-2xl text-balance text-base leading-7 text-muted-foreground sm:text-lg">
            &ldquo;El Estado no existe fuera de las personas que lo conforman.&rdquo;
            La política explicada como cadena de decisiones humanas, no como teatro de siglas.
          </p>
        </div>
      </div>
    </section>
  )
}
