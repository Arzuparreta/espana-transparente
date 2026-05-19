import Link from "next/link"
import { Fragment } from "react"
import { cn } from "@/lib/utils"

export interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
  className?: string
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  if (items.length === 0) return null
  const trail: BreadcrumbItem[] = [{ label: "Inicio", href: "/" }, ...items]

  return (
    <nav aria-label="Migas de pan" className={cn("text-xs text-muted-foreground", className)}>
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        {trail.map((item, index) => {
          const isLast = index === trail.length - 1
          return (
            <Fragment key={`${item.label}-${index}`}>
              {item.href && !isLast ? (
                <li>
                  <Link
                    href={item.href}
                    className="underline-offset-2 hover:text-foreground hover:underline"
                  >
                    {item.label}
                  </Link>
                </li>
              ) : (
                <li
                  aria-current={isLast ? "page" : undefined}
                  className={cn(isLast && "max-w-[60ch] truncate text-foreground")}
                >
                  {item.label}
                </li>
              )}
              {!isLast ? (
                <li aria-hidden className="text-muted-foreground/60">
                  ›
                </li>
              ) : null}
            </Fragment>
          )
        })}
      </ol>
    </nav>
  )
}
