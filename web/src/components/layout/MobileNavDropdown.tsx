"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog"

interface NavItem {
  href: string
  label: string
}

const navItems: NavItem[] = [
  { href: "/", label: "Inicio" },
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

  return (
    <div className="sm:hidden">
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger
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
        </DialogTrigger>

        <DialogContent
          className="top-2 left-1/2 -translate-x-1/2 translate-y-0 max-w-lg rounded-xl"
          showCloseButton={false}
        >
          <nav className="flex flex-col gap-1 p-2">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/" && pathname?.startsWith(item.href))

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
        </DialogContent>
      </Dialog>
    </div>
  )
}
