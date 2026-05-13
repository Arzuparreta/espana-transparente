"use client"

import { useState, createContext, useContext } from "react"
import { cn } from "@/lib/utils"

interface Tab {
  value: string
  label: string
  count?: number
}

const TabContext = createContext<string>("")

export function useTab() {
  return useContext(TabContext)
}

interface TabBarProps {
  tabs: Tab[]
  defaultTab: string
  children: React.ReactNode
}

export function TabBar({ tabs, defaultTab, children }: TabBarProps) {
  const [active, setActive] = useState(defaultTab)

  return (
    <TabContext.Provider value={active}>
      <div>
        <div className="flex border-b border-border overflow-x-auto -mx-3 sm:-mx-6 px-3 sm:px-6">
          {tabs.map((t) => {
            const isActive = active === t.value
            return (
              <button
                key={t.value}
                onClick={() => setActive(t.value)}
                className={cn(
                  "relative shrink-0 px-3 sm:px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
                  isActive
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t.label}
                {t.count !== undefined && (
                  <span className="ml-1 opacity-60 text-xs">{t.count}</span>
                )}
                {isActive && (
                  <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-foreground rounded-full" />
                )}
              </button>
            )
          })}
        </div>
        <div className="mt-6">{children}</div>
      </div>
    </TabContext.Provider>
  )
}

export function TabPanel({ value, children }: { value: string; children: React.ReactNode }) {
  const active = useTab()
  if (value !== active) return null
  return <>{children}</>
}
