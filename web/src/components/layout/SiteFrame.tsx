"use client"

import type { ReactNode } from "react"
import { usePathname } from "next/navigation"
import { ContextBreadcrumb } from "@/components/layout/ContextBreadcrumb"
import { Footer } from "@/components/layout/Footer"

export function SiteFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const immersive = pathname === "/territorio"

  if (immersive) {
    return (
      <main className="min-h-[calc(100dvh-3.5rem)] overflow-hidden lg:min-h-[calc(100dvh-6rem)]">
        {children}
      </main>
    )
  }

  return (
    <>
      <main className="ui-shell overflow-x-hidden py-5 sm:py-8">
        <ContextBreadcrumb />
        {children}
      </main>
      <Footer />
    </>
  )
}
