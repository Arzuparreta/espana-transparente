"use client"

import { Fragment } from "react"
import { LogoMark } from "@/components/brand/LogoMark"
import { MobileNavDropdown } from "@/components/layout/MobileNavDropdown"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { SearchTrigger } from "@/components/search/SearchTrigger"
import { BRAND_NAME, GITHUB_URL } from "@/lib/brand"
import { cn } from "@/lib/utils"
import { usePathname } from "next/navigation"

const navGroups = [
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
    label: "Dinero",
    items: [
      { href: "/presupuestos", label: "Presupuestos" },
      { href: "/contratos", label: "Contratos" },
      { href: "/subvenciones", label: "Subvenciones" },
      { href: "/fondos-ue", label: "Fondos UE" },
      { href: "/organizaciones", label: "Organizaciones" },
    ],
  },
  {
    label: "Contexto",
    items: [
      { href: "/indicadores", label: "Indicadores" },
      { href: "/puertas-giratorias", label: "Puertas giratorias" },
    ],
  },
] as const

const navLinkBase =
  "relative inline-flex shrink-0 items-center text-[13px] font-semibold tracking-tight text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:text-foreground"
const navLinkActive =
  "text-foreground after:absolute after:-bottom-[15px] after:left-0 after:right-0 after:h-[2px] after:bg-foreground"

export function Header() {
  const pathname = usePathname()

  function isActive(href: string) {
    return pathname === href || (href !== "/" && pathname?.startsWith(href))
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <div className="ui-shell flex h-14 items-center gap-4 lg:gap-6">
        <ResponsiveLink
          href="/"
          prefetch
          className="group flex min-w-0 shrink-0 items-center gap-2.5"
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center bg-primary text-primary-foreground transition-colors group-hover:bg-foreground">
            <LogoMark className="h-5 w-5" variant="inverse" />
          </span>
          <span className="font-display truncate text-[17px] font-bold leading-none tracking-tight text-foreground sm:text-[18px]">
            {BRAND_NAME}
          </span>
        </ResponsiveLink>

        <nav className="ml-2 hidden min-w-0 flex-1 items-center gap-x-3 xl:flex xl:gap-x-4 2xl:gap-x-5">
          {navGroups.map((group, gi) => (
            <Fragment key={group.label}>
              {gi > 0 && (
                <span className="h-4 w-px shrink-0 bg-border" aria-hidden />
              )}
              {group.items.map((item) => (
                <ResponsiveLink
                  key={item.href}
                  href={item.href}
                  prefetch
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={cn(navLinkBase, isActive(item.href) && navLinkActive)}
                >
                  {item.label}
                </ResponsiveLink>
              ))}
            </Fragment>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <div className="hidden items-center gap-1 xl:flex">
            <SearchTrigger />
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub"
              title="GitHub"
              className="grid h-9 w-9 shrink-0 place-items-center text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:text-foreground"
            >
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden>
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
              </svg>
            </a>
          </div>
          <MobileNavDropdown />
        </div>
      </div>
    </header>
  )
}
