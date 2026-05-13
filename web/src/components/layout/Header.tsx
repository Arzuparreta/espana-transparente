import Link from "next/link"
import { LogoMark } from "@/components/brand/LogoMark"

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/92 backdrop-blur">
      <div className="ui-shell flex min-h-14 flex-col gap-3 py-3 sm:min-h-16 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/" className="flex min-w-0 items-center gap-3 group">
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
        </Link>
        <nav className="grid grid-cols-4 gap-2 text-xs text-muted-foreground sm:flex sm:flex-wrap sm:items-center sm:justify-end sm:gap-2">
          <Link href="/diputados" className="rounded-full border border-border/60 bg-card px-3 py-2 text-center transition-colors hover:text-foreground">
            Diputados
          </Link>
          <Link href="/votaciones" className="rounded-full border border-border/60 bg-card px-3 py-2 text-center transition-colors hover:text-foreground">
            Votaciones
          </Link>
          <Link href="/partidos" className="rounded-full border border-border/60 bg-card px-3 py-2 text-center transition-colors hover:text-foreground">
            Partidos
          </Link>
          <Link href="/indicadores" className="rounded-full border border-border/60 bg-card px-3 py-2 text-center transition-colors hover:text-foreground">
            IPC
          </Link>
          <Link href="/distorsion" className="rounded-full border border-border/60 bg-card px-3 py-2 text-center transition-colors hover:text-foreground">
            Distorsión
          </Link>
          <Link href="/puertas-giratorias" className="rounded-full border border-border/60 bg-card px-3 py-2 text-center transition-colors hover:text-foreground">
            Puertas
          </Link>
          <Link
            href="https://github.com/Arzuparreta/accion-humana"
            target="_blank"
            className="rounded-full border border-border/60 bg-card px-3 py-2 text-center transition-colors hover:text-foreground"
          >
            GH
          </Link>
        </nav>
      </div>
    </header>
  )
}
