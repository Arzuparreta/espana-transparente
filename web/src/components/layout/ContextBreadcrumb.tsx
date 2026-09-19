"use client"
import { usePathname } from "next/navigation"
import { getAreaForPath, getSectionForPath } from "@/lib/nav-config"
import { Breadcrumb } from "@/components/navigation/Breadcrumb"

export function ContextBreadcrumb() {
  const pathname = usePathname()
  const section = getSectionForPath(pathname)
  const area = getAreaForPath(pathname)
  if (!section || pathname !== section.href) return null
  const items = [{ href: "/", label: "Inicio" }]
  if (area && area.href !== pathname)
    items.push({ href: area.href, label: area.label })
  return (
    <Breadcrumb
      items={[
        ...items,
        { label: area?.href === pathname ? area.label : section.label },
      ]}
    />
  )
}
