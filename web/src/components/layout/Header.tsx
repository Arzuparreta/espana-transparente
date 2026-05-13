import Link from "next/link"
import Image from "next/image"

export function Header() {
  return (
    <header className="border-b bg-card">
      <div className="mx-auto px-4 max-w-6xl flex items-center justify-between h-14 sm:h-16">
        <Link href="/" className="flex items-center gap-2.5 sm:gap-3 group shrink-0">
          <Image
            src="/logo.svg"
            alt="Acción Humana"
            width={28}
            height={28}
            className="dark:invert sm:w-9 sm:h-9"
          />
          <span className="font-bold text-base sm:text-lg tracking-tight">
            Acción Humana
          </span>
        </Link>
        <nav className="flex items-center gap-3 sm:gap-5 text-xs sm:text-sm text-muted-foreground">
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
