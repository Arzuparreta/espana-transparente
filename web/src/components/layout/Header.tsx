import { LogoMark } from "@/components/brand/LogoMark"
import { MobileNavDropdown } from "@/components/layout/MobileNavDropdown"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { SearchTrigger } from "@/components/search/SearchTrigger"
import { BRAND_NAME, GITHUB_URL } from "@/lib/brand"

const pill = "rounded-full border border-border/60 bg-card px-3 py-2 text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
const divider = <span className="h-4 w-px shrink-0 bg-border/60" aria-hidden />

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/92 backdrop-blur">
      <div className="ui-shell flex min-h-14 flex-row items-center justify-between gap-3 py-3 sm:min-h-16">
        <ResponsiveLink href="/" prefetch className="flex min-w-0 items-center gap-3 group">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-primary/15 bg-primary text-primary-foreground shadow-sm transition-colors group-hover:bg-foreground sm:h-11 sm:w-11">
            <LogoMark className="h-7 w-7" variant="inverse" />
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold tracking-tight text-foreground sm:text-base">
              {BRAND_NAME}
            </div>
            <div className="truncate text-[11px] text-muted-foreground sm:text-xs">
              Datos públicos de la política española
            </div>
          </div>
        </ResponsiveLink>
        <div className="flex shrink-0 items-center justify-end">
          <MobileNavDropdown />
          <nav className="hidden sm:flex sm:flex-wrap sm:items-center sm:justify-end sm:gap-1.5">
            {/* Personas */}
            <ResponsiveLink href="/diputados" prefetch className={pill}>Diputados</ResponsiveLink>
            <ResponsiveLink href="/partidos" prefetch className={pill}>Partidos</ResponsiveLink>
            <ResponsiveLink href="/gobierno" prefetch className={pill}>Gobierno</ResponsiveLink>
            <ResponsiveLink href="/votaciones" prefetch className={pill}>Votaciones</ResponsiveLink>
            <ResponsiveLink href="/divergencias" prefetch className={pill}>Divergencias</ResponsiveLink>
            {divider}
            {/* Dinero público */}
            <ResponsiveLink href="/presupuestos" prefetch className={pill}>Presupuestos</ResponsiveLink>
            <ResponsiveLink href="/contratos" prefetch className={pill}>Contratos</ResponsiveLink>
            <ResponsiveLink href="/subvenciones" prefetch className={pill}>Subvenciones</ResponsiveLink>
            {divider}
            {/* Contexto */}
            <ResponsiveLink href="/indicadores" prefetch className={pill}>Indicadores</ResponsiveLink>
            <ResponsiveLink href="/puertas-giratorias" prefetch className={pill}>Puertas giratorias</ResponsiveLink>
            {/* Búsqueda */}
            <SearchTrigger />
            {/* GitHub: icono sin texto */}
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border/60 bg-card text-muted-foreground transition-colors hover:text-foreground"
            >
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
              </svg>
            </a>
          </nav>
        </div>
      </div>
    </header>
  )
}
