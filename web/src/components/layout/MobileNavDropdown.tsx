"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { useAuth } from "@/lib/auth/AuthContext"
import { PRIMARY_NAV, SECONDARY_NAV } from "@/lib/nav-config"
import { cn } from "@/lib/utils"

const navGroups = [...PRIMARY_NAV, SECONDARY_NAV]

export function MobileNavDropdown() {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()
  const { user, openModal, signOut } = useAuth()

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
            <nav className="flex flex-col px-5 pb-8 pt-2">
              {navGroups.map((group) => (
                <div key={group.label} className="border-b border-border/40 py-4 last:border-b-0">
                  <div className="pb-3 text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">
                    {group.label}
                  </div>
                  <div className="flex flex-col">
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
                            "flex min-h-11 items-center text-[17px] font-semibold tracking-tight select-none transition-colors",
                            isActive
                              ? "text-foreground"
                              : "text-muted-foreground active:text-foreground"
                          )}
                        >
                          {item.longLabel ?? item.label}
                        </ResponsiveLink>
                      )
                    })}
                  </div>
                </div>
              ))}
            </nav>

            <div className="border-t border-border/60 px-5 py-4">
              {user ? (
                <div className="flex min-w-0 items-center justify-between gap-4">
                  <ResponsiveLink
                    href="/perfil"
                    onClick={() => setIsOpen(false)}
                    className="min-w-0 text-[13px] font-semibold text-[#EEEDE9] transition-colors hover:text-[#C8FF00]"
                  >
                    Perfil
                  </ResponsiveLink>
                  <button
                    type="button"
                    onClick={() => { signOut(); setIsOpen(false) }}
                    className="text-[12px] font-semibold text-[#999992] hover:text-[#EEEDE9] transition-colors"
                  >
                    Cerrar sesión
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => { openModal("login"); setIsOpen(false) }}
                  className="w-full rounded-[2px] border border-[#2A2A27] py-2 text-[13px] font-semibold text-[#C8FF00] transition-colors hover:border-[#C8FF00]"
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
