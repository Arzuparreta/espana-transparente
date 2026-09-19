import { ResponsiveLink } from "./NavigationProgress"
export interface BreadcrumbItem {
  label: string
  href?: string
}
export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Ubicación" className="mb-3 text-sm text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {items.map((item, index) => (
          <li
            key={`${item.href}-${index}`}
            className="flex min-w-0 items-center gap-2"
          >
            {index > 0 && <span aria-hidden="true">›</span>}
            {item.href ? (
              <ResponsiveLink
                href={item.href}
                className="underline-offset-4 hover:underline"
              >
                {item.label}
              </ResponsiveLink>
            ) : (
              <span aria-current="page" className="break-words text-foreground">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
