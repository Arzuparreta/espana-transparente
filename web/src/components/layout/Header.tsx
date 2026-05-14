import { LogoMark } from "@/components/brand/LogoMark"
import { MobileNavDropdown } from "@/components/layout/MobileNavDropdown"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/92 backdrop-blur">
      <div className="ui-shell flex min-h-14 flex-row items-center justify-between gap-3 py-3 sm:min-h-16">
        <ResponsiveLink href="/" prefetch className="flex min-w-0 items-center gap-3 group">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[1rem] border border-primary/15 bg-primary text-primary-foreground shadow-sm transition-transform group-hover:-rotate-3 sm:h-11 sm:w-11">
            <LogoMark className="h-7 w-7" />
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold tracking-tight text-foreground sm:text-base">
              Acción Humana
            </div>
            <div className="truncate text-[11px] text-muted-foreground sm:text-xs">
              Personas, poder y trazabilidad
            </div>
          </div>
        </ResponsiveLink>
        <div className="flex shrink-0 items-center justify-end">
          <MobileNavDropdown />
          <nav className="hidden sm:flex sm:flex-wrap sm:items-center sm:justify-end sm:gap-2">
            <ResponsiveLink href="/" prefetch className="rounded-full border border-border/60 bg-card px-3 py-2 text-center text-xs text-muted-foreground transition-colors hover:text-foreground">
              Inicio
            </ResponsiveLink>
            <ResponsiveLink href="/diputados" prefetch className="rounded-full border border-border/60 bg-card px-3 py-2 text-center text-xs text-muted-foreground transition-colors hover:text-foreground">
              Diputados
            </ResponsiveLink>
            <ResponsiveLink href="/votaciones" prefetch className="rounded-full border border-border/60 bg-card px-3 py-2 text-center text-xs text-muted-foreground transition-colors hover:text-foreground">
              Votaciones
            </ResponsiveLink>
            <ResponsiveLink href="/partidos" prefetch className="rounded-full border border-border/60 bg-card px-3 py-2 text-center text-xs text-muted-foreground transition-colors hover:text-foreground">
              Partidos
            </ResponsiveLink>
            <ResponsiveLink href="/indicadores" prefetch className="rounded-full border border-border/60 bg-card px-3 py-2 text-center text-xs text-muted-foreground transition-colors hover:text-foreground">
              IPC
            </ResponsiveLink>
            <ResponsiveLink href="/distorsion" prefetch className="rounded-full border border-border/60 bg-card px-3 py-2 text-center text-xs text-muted-foreground transition-colors hover:text-foreground">
              Distorsión
            </ResponsiveLink>
            <ResponsiveLink href="/contratos" prefetch className="rounded-full border border-border/60 bg-card px-3 py-2 text-center text-xs text-muted-foreground transition-colors hover:text-foreground">
              Contratos
            </ResponsiveLink>
            <ResponsiveLink href="/subvenciones" prefetch className="rounded-full border border-border/60 bg-card px-3 py-2 text-center text-xs text-muted-foreground transition-colors hover:text-foreground">
              Subvenciones
            </ResponsiveLink>
            <ResponsiveLink href="/puertas-giratorias" prefetch className="rounded-full border border-border/60 bg-card px-3 py-2 text-center text-xs text-muted-foreground transition-colors hover:text-foreground">
              Puertas
            </ResponsiveLink>
            <ResponsiveLink
              href="https://github.com/Arzuparreta/accion-humana"
              target="_blank"
              className="rounded-full border border-border/60 bg-card px-3 py-2 text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              GH
            </ResponsiveLink>
          </nav>
        </div>
      </div>
    </header>
  )
}
