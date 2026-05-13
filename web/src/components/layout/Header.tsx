import Link from "next/link"
import Image from "next/image"

export function Header() {
  return (
    <header className="border-b bg-card sticky top-0 z-50">
      <div className="w-full max-w-6xl mx-auto px-3 sm:px-6 flex items-center justify-between h-12 sm:h-14">
        <Link href="/" className="flex items-center gap-2 group shrink-0">
          <Image src="/logo.svg" alt="Acción Humana" width={24} height={24} className="dark:invert sm:w-7 sm:h-7" />
          <span className="font-bold text-sm sm:text-base tracking-tight truncate">Acción Humana</span>
        </Link>
        <nav className="flex items-center gap-2.5 sm:gap-4 text-[11px] sm:text-sm text-muted-foreground overflow-x-auto">
          <Link href="/diputados" className="hover:text-foreground transition-colors shrink-0">
            Diputados
          </Link>
          <Link href="/votaciones" className="hover:text-foreground transition-colors shrink-0">
            Votaciones
          </Link>
          <Link href="/partidos" className="hover:text-foreground transition-colors shrink-0">
            Partidos
          </Link>
          <Link href="/distorsion" className="hover:text-foreground transition-colors shrink-0 hidden sm:inline">
            Distorsión
          </Link>
          <Link href="/puertas-giratorias" className="hover:text-foreground transition-colors shrink-0 hidden sm:inline">
            Puertas
          </Link>
          <Link
            href="https://github.com/Arzuparreta/accion-humana"
            target="_blank"
            className="hover:text-foreground transition-colors shrink-0"
          >
            GH
          </Link>
        </nav>
      </div>
    </header>
  )
}
