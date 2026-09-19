"use client"

import { ArrowLeft } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { EXPLORATION_ORIGIN_KEY } from "@/components/navigation/InternalHistoryTracker"
import { buttonVariants } from "@/components/ui/button"
import { getAreaForPath, getSectionForPath } from "@/lib/nav-config"
import { isLocalHref } from "@/lib/exploration"
import { Breadcrumb } from "./Breadcrumb"
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
  ancestors?: ContextTrailLink[]
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

function getReturnTarget(fallback: ReturnTarget): ReturnTarget {
  try {
    const origin = JSON.parse(
      sessionStorage.getItem(EXPLORATION_ORIGIN_KEY) ?? "null",
    )
    if (
      origin?.href &&
      Array.isArray(origin.paths) &&
      origin.paths.includes(window.location.pathname) &&
      isLocalHref(origin.href) &&
      origin.pathname !== window.location.pathname
    )
      return {
        href: origin.href,
        label: `Volver a ${origin.title || "resultados"}`,
      }
  } catch {
    /* Direct arrivals use the canonical collection. */
  }
  return fallback
}

export function ContextTrail({
  section,
  current,
  ancestors = [],
  meta,
  fallbackHref,
  fallbackLabel,
  related = [],
  className,
}: ContextTrailProps) {
  const fallback = useMemo(
    () => ({ href: fallbackHref, label: fallbackLabel }),
    [fallbackHref, fallbackLabel],
  )
  const [returnTarget, setReturnTarget] = useState<ReturnTarget>(fallback)

  useEffect(() => {
    setReturnTarget(getReturnTarget(fallback))
  }, [fallback])

  const visibleRelated = related.filter(Boolean) as ContextTrailLink[]
  const derivedSection = getSectionForPath(section.href)
  const area = getAreaForPath(section.href)
  const sectionLabel = derivedSection?.label ?? section.label

  return (
    <div
      aria-label="Navegación contextual"
      className={cn(
        "border-y border-border bg-card/55 px-3 py-3 sm:px-4",
        className,
      )}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-2">
          <Breadcrumb
            items={[
              { href: "/", label: "Inicio" },
              ...(area && area.href !== section.href
                ? [{ href: area.href, label: area.label }]
                : []),
              { href: section.href, label: sectionLabel },
              ...ancestors.map((item) => ({
                href: item.href,
                label: item.label,
              })),
              { label: current },
            ]}
          />
          {meta && <p className="text-xs text-muted-foreground">{meta}</p>}

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
                      {link.meta ? (
                        <span className="font-mono opacity-70">
                          {link.meta}
                        </span>
                      ) : null}
                    </a>
                  ) : (
                    <ResponsiveLink
                      key={`${link.href}-${link.label}`}
                      href={link.href}
                      className="inline-flex shrink-0 items-center gap-1 border border-border bg-background px-2 py-1 text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                    >
                      <span>{link.label}</span>
                      {link.meta ? (
                        <span className="font-mono opacity-70">
                          {link.meta}
                        </span>
                      ) : null}
                    </ResponsiveLink>
                  ),
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
    </div>
  )
}
