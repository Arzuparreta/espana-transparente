"use client"

import { LogoMark } from "@/components/brand/LogoMark"
import { MobileNavDropdown } from "@/components/layout/MobileNavDropdown"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { SearchTrigger } from "@/components/search/SearchTrigger"
import { useAuth } from "@/lib/auth/AuthContext"
import { BRAND_NAME } from "@/lib/brand"
import { PRIMARY_NAV } from "@/lib/nav-config"
import { cn } from "@/lib/utils"
import { Menu } from "@base-ui/react/menu"
import { Menubar } from "@base-ui/react/menubar"
import { usePathname } from "next/navigation"

const triggerBase =
  "relative inline-flex h-9 shrink-0 items-center gap-1 rounded px-3 text-[13px] font-semibold tracking-tight text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:bg-muted focus-visible:text-foreground data-popup-open:bg-muted data-popup-open:text-foreground"

const triggerActive =
  "text-foreground after:absolute after:-bottom-[11px] after:left-3 after:right-3 after:h-[2px] after:bg-foreground"

const itemBase =
  "block cursor-pointer select-none rounded px-3 py-2 text-[13.5px] font-medium tracking-tight text-foreground/80 outline-none transition-colors data-highlighted:bg-muted data-highlighted:text-foreground"

const itemActive = "text-foreground"

export function Header() {
  const pathname = usePathname()
  const { user, loading: authLoading, openModal, signOut } = useAuth()

  function isItemActive(href: string) {
    return pathname === href || (href !== "/" && pathname?.startsWith(href))
  }

  function isGroupActive(items: ReadonlyArray<{ href: string }>) {
    return items.some((item) => isItemActive(item.href))
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <div className="relative flex h-14 w-full items-center px-4 sm:px-6">
        <ResponsiveLink
          href="/"
          prefetch
          className="group absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2.5"
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center bg-primary text-primary-foreground transition-colors group-hover:bg-foreground">
            <LogoMark className="h-5 w-5" variant="inverse" />
          </span>
          <span className="font-display truncate text-[17px] font-bold leading-none tracking-tight text-foreground sm:text-[18px]">
            {BRAND_NAME}
          </span>
        </ResponsiveLink>

        <Menubar className="hidden min-w-0 flex-1 items-center gap-1 lg:flex" modal={false}>
          {PRIMARY_NAV.map((group) => {
            const active = isGroupActive(group.items)
            return (
              <Menu.Root key={group.label}>
                <Menu.Trigger
                  className={cn(triggerBase, active && triggerActive)}
                  aria-current={active ? "page" : undefined}
                >
                  {group.label}
                  <svg
                    viewBox="0 0 24 24"
                    className="h-3 w-3 opacity-60 transition-transform duration-150 data-popup-open:rotate-180"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.5}
                    aria-hidden
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                  </svg>
                </Menu.Trigger>
                <Menu.Portal>
                  <Menu.Positioner sideOffset={10} align="start" className="z-50">
                    <Menu.Popup className="min-w-[200px] rounded border border-border bg-popover p-1 outline-none data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0">
                      {group.items.map((item) => (
                        <Menu.LinkItem
                          key={item.href}
                          closeOnClick
                          className={cn(itemBase, isItemActive(item.href) && itemActive)}
                          render={<ResponsiveLink href={item.href} prefetch />}
                        >
                          {item.label}
                        </Menu.LinkItem>
                      ))}
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.Root>
            )
          })}
        </Menubar>

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
            <SearchTrigger variant="pill" />
          </div>
          {!authLoading && (
            user ? (
              <div className="hidden lg:flex items-center gap-2">
                <span
                  title={user.email}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-[2px] bg-[#1D1D1A] border border-[#2A2A27] font-mono text-[11px] font-semibold text-[#C8FF00] select-none"
                >
                  {(user.email ?? "?")[0].toUpperCase()}
                </span>
                <button
                  type="button"
                  onClick={() => signOut()}
                  className="text-[12px] font-medium text-[#999992] hover:text-[#EEEDE9] transition-colors"
                >
                  Salir
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => openModal("login")}
                className="hidden lg:inline-flex h-9 items-center rounded-[2px] border border-[#2A2A27] bg-transparent px-3 text-[12px] font-semibold text-[#999992] transition-colors hover:border-[#C8FF00] hover:text-[#C8FF00]"
              >
                Iniciar sesión
              </button>
            )
          )}
          <MobileNavDropdown />
        </div>
      </div>
    </header>
  )
}
