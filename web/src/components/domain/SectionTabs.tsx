"use client"

import type { ReactNode } from "react"
import { useState } from "react"
import { cn } from "@/lib/utils"

interface TabItem {
  value: string
  label: string
  count?: number
}

interface SectionTabsProps {
  tabs: TabItem[]
  defaultTab: string
  children: (activeTab: string) => ReactNode
}

export function SectionTabs({ tabs, defaultTab, children }: SectionTabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab)

  return (
    <div className="space-y-6">
      <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
        <div className="inline-flex min-w-full gap-2 border-b border-border/80 pb-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.value

            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveTab(tab.value)}
                className={cn(
                  "min-h-11 shrink-0 rounded-full px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {tab.label}
                {tab.count !== undefined ? (
                  <span className={cn("ml-1.5 text-xs", isActive ? "text-background/70" : "text-muted-foreground")}>
                    {tab.count}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      </div>
      {children(activeTab)}
    </div>
  )
}
