"use client"

import { ArrowLeft, ChevronRight } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import {
  INTERNAL_HISTORY_KEY,
  type InternalHistoryItem,
} from "@/components/navigation/InternalHistoryTracker"
import { buttonVariants } from "@/components/ui/button"
import { getSectionForPath } from "@/lib/nav-config"
import { cn } from "@/lib/utils"

export interface ContextTrailLink {
  href: string
  label: string
  meta?: string
  external?: boolean
}

export interface ContextTrailSection {
  href: string
  label: string
  groupLabel?: string
}

interface ContextTrailProps {
  section: ContextTrailSection
  current: string
  meta?: string
  fallbackHref: string
  fallbackLabel: string
  related?: Array<ContextTrailLink | null | false | undefined>
  className?: string
}

interface ReturnTarget {
  href: string
  label: string
}

function readStoredHistory(): InternalHistoryItem[] {
  try {
    const raw = window.sessionStorage.getItem(INTERNAL_HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is InternalHistoryItem => {
      return (
        item &&
        typeof item === "object" &&
        typeof item.href === "string" &&
        typeof item.pathname === "string"
      )
    })
  } catch {
    return []
  }
}

function pathnameFromHref(href: string): string {
  try {
    return new URL(href, window.location.origin).pathname
  } catch {
    return href.split("?")[0] ?? href
  }
}

function buildReturnLabel(item: InternalHistoryItem): string {
  if (item.pathname === "/buscar") return "Volver a resultados"

  const section = getSectionForPath(item.pathname)
  if (section) return `Volver a ${section.shortLabel ?? section.label}`

  return "Volver a la página anterior"
}

function getReturnTarget(fallback: ReturnTarget): ReturnTarget {
  const currentPath = window.location.pathname
  const history = readStoredHistory()

  const previous = history.find((item) => {
    const itemPath = pathnameFromHref(item.href)
    return itemPath !== currentPath && itemPath.startsWith("/")
  })

  if (!previous) return fallback

  return {
    href: previous.href,
    label: buildReturnLabel(previous),
  }
}

export function ContextTrail({
  section,
  current,
  meta,
  fallbackHref,
  fallbackLabel,
  related = [],
  className,
}: ContextTrailProps) {
  const fallback = useMemo(
    () => ({ href: fallbackHref, label: fallbackLabel }),
    [fallbackHref, fallbackLabel]
  )
  const [returnTarget, setReturnTarget] = useState<ReturnTarget>(fallback)

  useEffect(() => {
    setReturnTarget(getReturnTarget(fallback))
  }, [fallback])

  const visibleRelated = related.filter(Boolean) as ContextTrailLink[]
  const derivedSection = getSectionForPath(section.href)
  const groupLabel = section.groupLabel ?? derivedSection?.groupLabel

  return (
    <nav
      aria-label="Navegación contextual"
      className={cn(
        "border-y border-border bg-card/55 px-3 py-3 sm:px-4",
        className
      )}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-2">
          <ol className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <li>
              <ResponsiveLink
                href="/"
                className="font-mono uppercase tracking-[0.08em] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                Inicio
              </ResponsiveLink>
            </li>
            {groupLabel ? (
              <>
                <li aria-hidden className="text-muted-foreground/60">
                  <ChevronRight className="size-3" />
                </li>
                <li className="font-mono uppercase tracking-[0.08em] text-muted-foreground">
                  {groupLabel}
                </li>
              </>
            ) : null}
            <li aria-hidden className="text-muted-foreground/60">
              <ChevronRight className="size-3" />
            </li>
            <li>
              <ResponsiveLink
                href={section.href}
                className="font-mono uppercase tracking-[0.08em] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                {section.label}
              </ResponsiveLink>
            </li>
            <li aria-hidden className="text-muted-foreground/60">
              <ChevronRight className="size-3" />
            </li>
            <li
              aria-current="page"
              className="min-w-0 max-w-[70ch] truncate font-medium text-foreground"
              title={current}
            >
              {current}
            </li>
            {meta ? (
              <li className="font-mono text-xs text-muted-foreground">
                {meta}
              </li>
            ) : null}
          </ol>

          {visibleRelated.length > 0 ? (
            <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
              <div className="flex min-w-max items-center gap-2 text-xs">
                <span className="shrink-0 font-mono uppercase tracking-[0.08em] text-muted-foreground">
                  Relacionado
                </span>
                {visibleRelated.map((link) =>
                  link.external ? (
                    <a
                      key={`${link.href}-${link.label}`}
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex shrink-0 items-center gap-1 border border-border bg-background px-2 py-1 text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                    >
                      <span>{link.label}</span>
                      {link.meta ? <span className="font-mono opacity-70">{link.meta}</span> : null}
                    </a>
                  ) : (
                    <ResponsiveLink
                      key={`${link.href}-${link.label}`}
                      href={link.href}
                      className="inline-flex shrink-0 items-center gap-1 border border-border bg-background px-2 py-1 text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                    >
                      <span>{link.label}</span>
                      {link.meta ? <span className="font-mono opacity-70">{link.meta}</span> : null}
                    </ResponsiveLink>
                  )
                )}
              </div>
            </div>
          ) : null}
        </div>

        <ResponsiveLink
          href={returnTarget.href}
          className={buttonVariants({
            variant: "outline",
            size: "sm",
            className: "min-h-10 w-fit gap-1.5",
          })}
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          {returnTarget.label}
        </ResponsiveLink>
      </div>
    </nav>
  )
}
