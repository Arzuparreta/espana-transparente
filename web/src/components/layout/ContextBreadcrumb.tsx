"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { getSectionForPath } from "@/lib/nav-config"
import { THREADS } from "@/lib/thread-config"

export function ContextBreadcrumb() {
  const pathname = usePathname()
  const section = getSectionForPath(pathname)

  if (!section?.groupLabel) return null

  const thread = THREADS.find((t) => t.label === section.groupLabel)
  if (!thread) return null

  const sectionLabel = section.shortLabel ?? section.label

  return (
    <nav aria-label="Hilo temático" className="mb-3 sm:mb-4">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground/70">
        <li>
          <Link href="/" className="transition-colors hover:text-foreground">
            Inicio
          </Link>
        </li>
        <li aria-hidden className="text-muted-foreground/40">
          ›
        </li>
        <li>
          <Link href={thread.href} className="transition-colors hover:text-foreground">
            {thread.label}
          </Link>
        </li>
        <li aria-hidden className="text-muted-foreground/40">
          ›
        </li>
        <li aria-current="page" className="text-muted-foreground">
          {sectionLabel}
        </li>
      </ol>
    </nav>
  )
}
