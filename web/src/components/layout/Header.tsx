"use client"

import { Fragment } from "react"
import { LogoMark } from "@/components/brand/LogoMark"
import { MobileNavDropdown } from "@/components/layout/MobileNavDropdown"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { SearchTrigger } from "@/components/search/SearchTrigger"
import { BRAND_NAME } from "@/lib/brand"
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
      { href: "/puertas-giratorias", label: "P. giratorias" },
    ],
  },
] as const

const navLinkBase =
  "relative inline-flex shrink-0 items-center text-[12.5px] font-semibold tracking-tight text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:text-foreground"
const navLinkActive =
  "text-foreground after:absolute after:-bottom-[15px] after:left-0 after:right-0 after:h-[2px] after:bg-foreground"

export function Header() {
  const pathname = usePathname()

  function isActive(href: string) {
    return pathname === href || (href !== "/" && pathname?.startsWith(href))
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <div className="flex h-14 w-full items-center gap-4 px-4 sm:px-6 lg:gap-5">
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

        <nav className="hidden min-w-0 flex-1 items-center gap-x-2.5 lg:flex 2xl:gap-x-4">
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
          <div className="hidden items-center gap-1 lg:flex">
            <SearchTrigger />
          </div>
          <MobileNavDropdown />
        </div>
      </div>
    </header>
  )
}
