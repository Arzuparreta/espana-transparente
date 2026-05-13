import Link from "next/link"
import Image from "next/image"

export function Header() {
  return (
    <header className="border-b bg-card">
      <div className="container mx-auto px-4 max-w-6xl flex items-center justify-between h-16">
        <Link href="/" className="flex items-center gap-3 group">
          <Image
            src="/logo.svg"
            alt="Acción Humana"
            width={36}
            height={36}
            className="dark:invert"
          />
          <span className="font-bold text-lg tracking-tight">
            Acción Humana
          </span>
        </Link>
        <nav className="flex items-center gap-6 text-sm text-muted-foreground">
          <Link href="/diputados" className="hover:text-foreground transition-colors">
            Diputados
          </Link>
          <Link href="/partidos" className="hover:text-foreground transition-colors">
            Partidos
          </Link>
          <Link href="/distorsion" className="hover:text-foreground transition-colors">
            Distorsión
          </Link>
          <Link href="/puertas-giratorias" className="hover:text-foreground transition-colors">
            Puertas giratorias
          </Link>
          <Link
            href="https://github.com/Arzuparreta/accion-humana"
            target="_blank"
            className="hover:text-foreground transition-colors"
          >
            GitHub
          </Link>
        </nav>
      </div>
    </header>
  )
}
