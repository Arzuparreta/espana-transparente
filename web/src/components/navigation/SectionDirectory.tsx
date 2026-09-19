"use client"

import { usePathname } from "next/navigation"
import {
  getAreaForPath,
  getSectionForPath,
  getSectionsByHub,
  groupSections,
} from "@/lib/nav-config"
import { ResponsiveLink } from "./NavigationProgress"

export function SectionDirectory({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const area = getAreaForPath(pathname)
  const active = getSectionForPath(pathname)
  return (
    <nav aria-label="Directorio de datos" className="space-y-2">
      {getSectionsByHub().map(({ hub, sections }) => (
        <details
          key={`${hub.href}-${area?.key}`}
          open={area?.href === hub.href}
          className="border-b border-border pb-2"
        >
          <summary className="cursor-pointer py-3 font-semibold text-sm">
            {hub.label}
          </summary>
          <ResponsiveLink
            href={hub.href}
            onClick={onNavigate}
            className="block py-2 text-sm underline underline-offset-4"
          >
            Explorar {hub.label.toLowerCase()}
          </ResponsiveLink>
          {groupSections(sections).map((group) => (
            <div key={group.label} className="pb-3">
              <p className="py-2 text-xs text-muted-foreground">
                {group.label}
              </p>
              {group.items.map((item) => (
                <ResponsiveLink
                  key={item.key}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active?.href === item.href ? "page" : undefined}
                  className={`block rounded px-2 py-2 text-sm ${active?.href === item.href ? "bg-secondary font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {item.label}
                </ResponsiveLink>
              ))}
            </div>
          ))}
        </details>
      ))}
    </nav>
  )
}
