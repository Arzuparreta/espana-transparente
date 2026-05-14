"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { GITHUB_URL } from "@/lib/brand"
import { cn } from "@/lib/utils"

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
  { href: "/contratos", label: "Contratos públicos" },
  { href: "/subvenciones", label: "Subvenciones" },
  { href: "/puertas-giratorias", label: "Puertas Giratorias" },
  { href: GITHUB_URL, label: "GitHub" },
]

export function MobileNavDropdown() {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()

  return (
    <div className="sm:hidden">
      <DialogPrimitive.Root open={isOpen} onOpenChange={setIsOpen}>
        <DialogPrimitive.Trigger
          className="flex items-center gap-2 rounded-full border border-border/60 bg-card px-3 py-2 text-sm font-medium text-muted-foreground shadow-sm select-none active:bg-muted active:text-foreground"
        >
          <span className="flex h-5 w-5 flex-col justify-center gap-1">
            <span
              className={cn(
                "h-0.5 w-full rounded bg-foreground transition-all duration-200",
                isOpen && "translate-y-[3px] rotate-45"
              )}
            />
            <span
              className={cn(
                "h-0.5 w-full rounded bg-foreground transition-all duration-200",
                isOpen && "opacity-0"
              )}
            />
            <span
              className={cn(
                "h-0.5 w-full rounded bg-foreground transition-all duration-200",
                isOpen && "-translate-y-[3px] -rotate-45"
              )}
            />
          </span>
          <span>Menú</span>
        </DialogPrimitive.Trigger>

        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
          <DialogPrimitive.Popup className="fixed top-2 left-1/2 z-50 w-[calc(100%-1.5rem)] max-w-lg -translate-x-1/2 rounded-xl border border-border/70 bg-card p-3 shadow-lg data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-top-2 data-closed:animate-out data-closed:fade-out-0 data-closed:slide-out-to-top-2">
            <nav className="flex flex-col gap-1.5">
              {navItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/" && pathname?.startsWith(item.href))

                return (
                  <ResponsiveLink
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={cn(
                      "flex items-center rounded-lg px-3 py-2.5 text-sm font-medium select-none",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground active:bg-muted active:text-foreground"
                    )}
                  >
                    {item.label}
                  </ResponsiveLink>
                )
              })}
            </nav>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </div>
  )
}
