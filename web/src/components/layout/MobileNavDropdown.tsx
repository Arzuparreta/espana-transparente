"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { SearchForm } from "@/components/search/SearchForm"
import { useAuth } from "@/lib/auth/AuthContext"
import { getSectionForPath, PRIMARY_NAV, SECONDARY_NAV } from "@/lib/nav-config"
import { cn } from "@/lib/utils"

export function MobileNavDropdown() {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()
  const { user, openModal, signOut } = useAuth()

  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  return (
    <div className="lg:hidden">
      <DialogPrimitive.Root open={isOpen} onOpenChange={setIsOpen}>
        <DialogPrimitive.Trigger
          aria-label="Abrir menú"
          className="flex h-11 w-11 items-center justify-center text-foreground transition-opacity select-none active:opacity-70"
        >
          <span className="flex h-4 w-6 flex-col justify-between">
            <span
              className={cn(
                "h-[2px] w-full bg-foreground transition-all duration-200",
                isOpen && "translate-y-[7px] rotate-45"
              )}
            />
            <span
              className={cn(
                "h-[2px] w-full bg-foreground transition-all duration-200",
                isOpen && "opacity-0"
              )}
            />
            <span
              className={cn(
                "h-[2px] w-full bg-foreground transition-all duration-200",
                isOpen && "-translate-y-[7px] -rotate-45"
              )}
            />
          </span>
        </DialogPrimitive.Trigger>

        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-foreground/30 backdrop-blur-sm data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
          <DialogPrimitive.Popup className="fixed inset-x-0 top-0 z-50 max-h-[100dvh] overflow-y-auto border-b border-border bg-background data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-top-4 data-closed:animate-out data-closed:fade-out-0 data-closed:slide-out-to-top-4">
            <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
              <span className="min-w-0 truncate font-display text-lg font-bold tracking-tight">Menú</span>
              <DialogPrimitive.Close
                aria-label="Cerrar menú"
                className="flex h-11 w-11 items-center justify-center text-foreground active:opacity-70"
              >
                <span className="relative flex h-4 w-6 items-center justify-center">
                  <span className="absolute h-[2px] w-full rotate-45 bg-foreground" />
                  <span className="absolute h-[2px] w-full -rotate-45 bg-foreground" />
                </span>
              </DialogPrimitive.Close>
            </div>
            <div className="border-b border-border/60 px-5 py-3">
              <SearchForm size="header" live className="w-full" />
            </div>
            <nav className="flex flex-col px-5 pb-8 pt-2">
              <div className="border-b border-border/40 py-4">
                <div className="pb-3 text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">
                  Explorar
                </div>
                <div className="flex flex-col">
                  {PRIMARY_NAV.map((item) => {
                    const isActive =
                      pathname === item.href ||
                      pathname?.startsWith(`${item.href}/`) ||
                      getSectionForPath(pathname)?.groupLabel === item.label
                    return (
                      <ResponsiveLink
                        key={item.href}
                        href={item.href}
                        onClick={() => setIsOpen(false)}
                        className={cn(
                          "flex min-h-12 items-center text-xl font-semibold tracking-tight transition-colors",
                          isActive ? "text-foreground" : "text-muted-foreground active:text-foreground"
                        )}
                      >
                        {item.label}
                      </ResponsiveLink>
                    )
                  })}
                </div>
              </div>
              <div className="py-4">
                <div className="pb-3 text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">
                  El portal
                </div>
                <div className="flex flex-col">
                  {SECONDARY_NAV.map((item) => (
                    <ResponsiveLink
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsOpen(false)}
                      className="flex min-h-11 items-center text-[16px] font-semibold text-muted-foreground transition-colors active:text-foreground"
                    >
                      {item.label}
                    </ResponsiveLink>
                  ))}
                </div>
              </div>
            </nav>

            <div className="border-t border-border/60 px-5 py-4">
              {user ? (
                <div className="flex min-w-0 items-center justify-between gap-4">
                  <ResponsiveLink
                    href="/perfil"
                    onClick={() => setIsOpen(false)}
                    className="min-w-0 text-[13px] font-semibold text-foreground transition-colors hover:text-primary"
                  >
                    Perfil
                  </ResponsiveLink>
                  <button
                    type="button"
                    onClick={() => { signOut(); setIsOpen(false) }}
                    className="text-[12px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Cerrar sesión
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => { openModal("login"); setIsOpen(false) }}
                  className="w-full rounded-[2px] border border-border py-2 text-[13px] font-semibold text-primary transition-colors hover:border-primary"
                >
                  Iniciar sesión
                </button>
              )}
            </div>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </div>
  )
}
