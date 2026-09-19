"use client"

import type { ReactNode } from "react"
import { usePathname } from "next/navigation"
import { ContextBreadcrumb } from "./ContextBreadcrumb"
import { Footer } from "./Footer"
import { SectionDirectory } from "@/components/navigation/SectionDirectory"
import { getAreaForPath } from "@/lib/nav-config"

export function SiteFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const hasDirectory =
    Boolean(getAreaForPath(pathname)) || pathname === "/buscar"
  return (
    <>
      <div
        className={hasDirectory ? "flex w-full gap-6 px-4 sm:px-6" : "ui-shell"}
      >
        {hasDirectory && (
          <aside className="hidden w-56 shrink-0 border-r border-border pr-4 xl:block">
            <div className="sticky top-14 max-h-[calc(100dvh-3.5rem)] overflow-y-auto py-5">
              <SectionDirectory />
            </div>
          </aside>
        )}
        <main id="contenido" className="min-w-0 flex-1 py-5 sm:py-8">
          <ContextBreadcrumb />
          {children}
        </main>
      </div>
      <Footer />
    </>
  )
}
