import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { cn } from "@/lib/utils"

export interface SectionViewItem {
  href: string
  label: string
  value: string
}

interface SectionViewNavProps {
  label: string
  active: string
  items: SectionViewItem[]
  className?: string
}

export function SectionViewNav({ label, active, items, className }: SectionViewNavProps) {
  return (
    <nav
      aria-label={label}
      className={cn(
        "overflow-x-auto rounded-[2px] border border-border bg-card p-1",
        className
      )}
    >
      <div className="flex min-w-max items-center gap-1">
        {items.map((item) => {
          const isActive = item.value === active
          return (
            <ResponsiveLink
              key={item.value}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "inline-flex min-h-10 items-center rounded-[2px] px-3 text-sm font-semibold transition-colors",
                isActive
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {item.label}
            </ResponsiveLink>
          )
        })}
      </div>
    </nav>
  )
}
