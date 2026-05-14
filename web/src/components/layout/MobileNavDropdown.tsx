"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

interface NavItem {
  href: string
  label: string
}

const navItems: NavItem[] = [
  { href: "/diputados", label: "Diputados" },
  { href: "/votaciones", label: "Votaciones" },
  { href: "/partidos", label: "Partidos" },
  { href: "/indicadores", label: "IPC" },
  { href: "/distorsion", label: "Distorsión" },
  { href: "/puertas-giratorias", label: "Puertas Giratorias" },
  { href: "https://github.com/Arzuparreta/accion-humana", label: "GitHub" },
]

export function MobileNavDropdown() {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()

  const toggleOpen = () => setIsOpen((prev) => !prev)

  return (
    <div className="sm:hidden">
      <button
        type="button"
        onClick={toggleOpen}
        aria-expanded={isOpen}
        aria-controls="mobile-nav-menu"
        className="flex items-center gap-2 rounded-full border border-border/60 bg-card px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
      >
        <span className="flex h-5 w-5 flex-col justify-center gap-1">
          <span
            className={cn(
              "h-0.5 w-full rounded bg-foreground transition-all duration-200",
              isOpen ? "translate-y-[3px] rotate-45" : ""
            )}
          />
          <span
            className={cn(
              "h-0.5 w-full rounded bg-foreground transition-all duration-200",
              isOpen ? "opacity-0" : "opacity-100"
            )}
          />
          <span
            className={cn(
              "h-0.5 w-full rounded bg-foreground transition-all duration-200",
              isOpen ? "-translate-y-[3px] -rotate-45" : ""
            )}
          />
        </span>
        <span className="text-muted-foreground">Menú</span>
        <svg
          className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", isOpen ? "rotate-180" : "")}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <div
        id="mobile-nav-menu"
        className={cn(
          "overflow-hidden transition-all duration-300 ease-out",
          isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <nav className="mt-2 rounded-xl border border-border/70 bg-card/95 p-2 shadow-lg backdrop-blur">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href))

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={cn(
                  "flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
