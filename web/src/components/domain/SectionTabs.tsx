"use client"

import type { ReactNode } from "react"
import { Suspense } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"

interface TabItem {
  value: string
  label: string
  count?: number
}

interface SectionTabsProps {
  tabs: TabItem[]
  defaultTab: string
  panels?: Record<string, ReactNode>
  children?: (activeTab: string) => ReactNode
  paramName?: string
}

function TabRow({
  tabs,
  activeTab,
  onChange,
}: {
  tabs: TabItem[]
  activeTab: string
  onChange: (next: string) => void
}) {
  return (
    <div
      role="tablist"
      aria-orientation="horizontal"
      className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0"
    >
      <div className="inline-flex min-w-full gap-2 border-b border-border/80 pb-1">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.value
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-current={isActive ? "page" : undefined}
              onClick={() => onChange(tab.value)}
              className={cn(
                "min-h-11 shrink-0 rounded px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {tab.label}
              {tab.count !== undefined ? (
                <span
                  className={cn(
                    "ml-1.5 text-xs",
                    isActive ? "text-background/70" : "text-muted-foreground"
                  )}
                >
                  {tab.count}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function SectionTabsBody({
  tabs,
  defaultTab,
  panels,
  children,
  paramName,
}: SectionTabsProps & { paramName: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const validValues = tabs.map((t) => t.value)
  const fromUrl = searchParams.get(paramName)
  const activeTab = fromUrl && validValues.includes(fromUrl) ? fromUrl : defaultTab

  function setActiveTab(next: string) {
    if (next === activeTab) return
    const params = new URLSearchParams(searchParams.toString())
    if (next === defaultTab) params.delete(paramName)
    else params.set(paramName, next)
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  return (
    <div className="space-y-6">
      <TabRow tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
      {panels ? panels[activeTab] : children?.(activeTab)}
    </div>
  )
}

export function SectionTabs(props: SectionTabsProps) {
  const paramName = props.paramName ?? "tab"
  // Pre-render the default tab as a fallback while the URL-driven body resolves
  // (covers Next.js useSearchParams Suspense requirement on statically rendered routes).
  const fallback = (
    <div className="space-y-6">
      <TabRow tabs={props.tabs} activeTab={props.defaultTab} onChange={() => {}} />
      {props.panels ? props.panels[props.defaultTab] : props.children?.(props.defaultTab)}
    </div>
  )

  return (
    <Suspense fallback={fallback}>
      <SectionTabsBody {...props} paramName={paramName} />
    </Suspense>
  )
}
