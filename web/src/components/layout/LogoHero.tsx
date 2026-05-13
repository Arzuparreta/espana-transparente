import Image from "next/image"

export function LogoHero() {
  return (
    <section className="relative overflow-hidden rounded-[calc(var(--radius)+0.4rem)] border border-border/70 bg-card px-5 py-8 shadow-sm sm:px-8 sm:py-10">
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-accent/80 to-transparent" />
      <div className="relative flex flex-col items-center gap-5 text-center">
        <div className="rounded-full border border-border/60 bg-background p-4 shadow-sm">
          <Image
            src="/logo.svg"
            alt="Acción Humana"
            width={80}
            height={80}
            className="dark:invert"
            priority
          />
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
