"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { GITHUB_URL } from "@/lib/brand"
import { cn } from "@/lib/utils"

interface NavGroup {
  label: string
  items: { href: string; label: string }[]
}

const navGroups: NavGroup[] = [
  {
    label: "Personas",
    items: [
      { href: "/diputados", label: "Diputados" },
      { href: "/senado", label: "Senado" },
      { href: "/partidos", label: "Partidos" },
      { href: "/gobierno", label: "Gobierno" },
      { href: "/instituciones", label: "Instituciones" },
      { href: "/votaciones", label: "Votaciones" },
    ],
  },
  {
    label: "Dinero público",
    items: [
      { href: "/presupuestos", label: "Presupuestos" },
      { href: "/contratos", label: "Contratos públicos" },
      { href: "/subvenciones", label: "Subvenciones" },
      { href: "/fondos-ue", label: "Fondos europeos" },
      { href: "/organizaciones", label: "Organizaciones" },
    ],
  },
  {
    label: "Contexto",
    items: [
      { href: "/indicadores", label: "Indicadores económicos" },
      { href: "/puertas-giratorias", label: "Puertas giratorias" },
    ],
  },
  {
    label: "Más",
    items: [
      { href: "/buscar", label: "Búsqueda" },
      { href: "/estado-datos", label: "Estado de los datos" },
      { href: GITHUB_URL, label: "GitHub" },
    ],
  },
]

export function MobileNavDropdown() {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()

  return (
    <div className="sm:hidden">
      <DialogPrimitive.Root open={isOpen} onOpenChange={setIsOpen}>
        <DialogPrimitive.Trigger
          className="flex items-center gap-2 px-1 py-1 text-sm font-semibold text-foreground transition-opacity select-none active:opacity-70"
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
          <DialogPrimitive.Popup className="fixed top-2 left-1/2 z-50 w-[calc(100%-1.5rem)] max-w-lg -translate-x-1/2 rounded-none border border-border/70 bg-card p-3 shadow-lg data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-top-2 data-closed:animate-out data-closed:fade-out-0 data-closed:slide-out-to-top-2">
            <nav className="flex flex-col">
              {navGroups.map((group, gi) => (
                <div key={group.label} className={gi > 0 ? "mt-2 border-t border-border/60 pt-2" : undefined}>
                  <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                    {group.label}
                  </div>
                  {group.items.map((item) => {
                    const isActive =
                      pathname === item.href ||
                      (item.href !== "/" && !item.href.startsWith("http") && pathname?.startsWith(item.href))

                    return (
                      <ResponsiveLink
                        key={item.href}
                        href={item.href}
                        onClick={() => setIsOpen(false)}
                        className={cn(
                          "flex items-center px-3 py-2 text-sm font-semibold select-none transition-colors",
                          isActive
                            ? "text-foreground"
                            : "text-muted-foreground hover:text-foreground active:text-foreground"
                        )}
                      >
                        {item.label}
                      </ResponsiveLink>
                    )
                  })}
                </div>
              ))}
            </nav>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </div>
  )
}
