"use client"

import { LogoMark } from "@/components/brand/LogoMark"
import { MobileNavDropdown } from "@/components/layout/MobileNavDropdown"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { SearchTrigger } from "@/components/search/SearchTrigger"
import { useAuth } from "@/lib/auth/AuthContext"
import { getSectionForPath, getSectionsByHub, PRIMARY_NAV, type NavItem } from "@/lib/nav-config"
import { cn } from "@/lib/utils"
import { usePathname } from "next/navigation"

const triggerBase =
  "relative inline-flex h-9 shrink-0 items-center rounded px-3 text-[13px] font-semibold tracking-tight text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:bg-muted focus-visible:text-foreground"

const triggerActive =
  "text-foreground after:absolute after:-bottom-[11px] after:left-3 after:right-3 after:h-[2px] after:bg-foreground"

export function Header() {
  const pathname = usePathname()
  const { user, loading: authLoading, openModal, signOut } = useAuth()

  function isItemActive(href: string) {
    return pathname === href || (href !== "/" && pathname?.startsWith(href))
  }

  function isPrimaryActive(item: NavItem) {
    if (isItemActive(item.href)) return true
    return getSectionForPath(pathname)?.groupLabel === item.label
  }

  const activeSection = getSectionForPath(pathname)
  const cleanPath = pathname?.split("?")[0]?.replace(/\/$/, "") || "/"
  const hubGroups = getSectionsByHub()
  // Resolve the hub whose sub-nav to show: either the hub of the active section,
  // or the hub landing page itself (/personas, /dinero, /economia), where the
  // sub-nav appears with nothing selected.
  const activeHub =
    (activeSection?.groupLabel
      ? hubGroups.find((g) => g.hub.label === activeSection.groupLabel)
      : null) ?? hubGroups.find((g) => g.hub.href === cleanPath) ?? null
  const subNav = activeHub?.sections ?? []

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <div className="relative flex h-14 w-full items-center px-4 sm:px-6">
        <ResponsiveLink
          href="/"
          prefetch
          className="group mr-6 flex shrink-0 items-center gap-2.5"
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center bg-primary text-primary-foreground transition-colors group-hover:bg-foreground">
            <LogoMark className="h-5 w-5" variant="inverse" />
          </span>
          <span className="font-display inline-flex items-baseline gap-[0.4em] whitespace-nowrap leading-none tracking-[-0.02em]">
            <span className="text-[16px] font-semibold text-foreground/50 sm:text-[17px]">España</span>
            <span className="text-[16px] font-black text-foreground sm:text-[17px]">Transparente</span>
          </span>
        </ResponsiveLink>

        <nav aria-label="Navegación principal" className="hidden min-w-0 flex-1 items-center gap-1 lg:flex">
          {PRIMARY_NAV.map((item) => (
            <ResponsiveLink
              key={item.href}
              href={item.href}
              prefetch
              aria-current={isPrimaryActive(item) ? "page" : undefined}
              className={cn(triggerBase, isPrimaryActive(item) && triggerActive)}
            >
              {item.label}
            </ResponsiveLink>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <ResponsiveLink
            href="/estado-datos"
            prefetch
            className={cn(
              "hidden h-9 items-center text-[12px] font-medium tracking-tight text-muted-foreground/80 underline-offset-4 transition-colors hover:text-foreground hover:underline lg:inline-flex",
              isItemActive("/estado-datos") && "text-foreground"
            )}
          >
            Fuentes
          </ResponsiveLink>
          <div className="hidden lg:flex">
            <SearchTrigger variant="inline" />
          </div>
          {!authLoading && (
            user ? (
              <div className="hidden lg:flex items-center gap-2">
                <ResponsiveLink
                  href="/perfil"
                  prefetch
                  aria-label="Abrir perfil"
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-[2px] bg-secondary border border-border font-mono text-[11px] font-semibold text-primary select-none"
                >
                  {(user.email ?? "?")[0].toUpperCase()}
                </ResponsiveLink>
                <button
                  type="button"
                  onClick={() => signOut()}
                  className="text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Salir
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => openModal("login")}
                className="hidden lg:inline-flex h-9 items-center rounded-[2px] border border-border bg-transparent px-3 text-[12px] font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              >
                Iniciar sesión
              </button>
            )
          )}
          <MobileNavDropdown />
        </div>
      </div>

      {subNav.length > 0 ? (
        <div className="hidden border-t border-border/60 bg-background/80 lg:block">
          <nav
            aria-label={`Secciones de ${activeHub?.hub.label}`}
            className="flex w-full items-center gap-1 overflow-x-auto px-4 sm:px-6"
          >
            {subNav.map((section) => {
              const sectionActive = activeSection?.key === section.key
              return (
                <ResponsiveLink
                  key={section.key}
                  href={section.href}
                  prefetch={false}
                  aria-current={sectionActive ? "page" : undefined}
                  className={cn(
                    "relative inline-flex h-10 shrink-0 items-center whitespace-nowrap px-2.5 text-[12px] font-medium tracking-tight transition-colors duration-150",
                    sectionActive
                      ? "text-foreground after:absolute after:bottom-0 after:left-2.5 after:right-2.5 after:h-[2px] after:bg-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {section.shortLabel ?? section.label}
                </ResponsiveLink>
              )
            })}
          </nav>
        </div>
      ) : null}
    </header>
  )
}
