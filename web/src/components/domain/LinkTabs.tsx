import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface LinkTab {
  href: string
  label: string
  active?: boolean
  badge?: string
}

interface LinkTabsProps {
  tabs: LinkTab[]
  ariaLabel: string
  className?: string
}

export function LinkTabs({ tabs, ariaLabel, className }: LinkTabsProps) {
  return (
    <nav aria-label={ariaLabel} className={cn("-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0", className)}>
      <div className="inline-flex min-w-full gap-2 border-b border-border/80 pb-1">
        {tabs.map((tab) => (
          <ResponsiveLink
            key={`${tab.href}-${tab.label}`}
            href={tab.href}
            aria-current={tab.active ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center gap-2 rounded px-3 py-2 text-sm font-medium transition-colors",
              tab.active
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <span>{tab.label}</span>
            {tab.badge ? (
              <Badge
                variant={tab.active ? "secondary" : "outline"}
                className={cn(
                  "h-4 text-[10px]",
                  tab.active ? "bg-background/15 text-background" : null
                )}
              >
                {tab.badge}
              </Badge>
            ) : null}
          </ResponsiveLink>
        ))}
      </div>
    </nav>
  )
}
