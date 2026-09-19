import type { SectionIconName } from "@/components/brand/SectionIcon"
import { AREAS, getSectionsByHub } from "./nav-config"
export type ThreadKey = (typeof AREAS)[number]["key"]
export interface ThreadSource {
  href: string
  label: string
  description: string
  /** Optional sub-group caption (e.g. "Cargos" / "Decisiones") for grouped threads. */
  section?: string
  countKey?: string
  countUnit?: string
  /** Explicit icon override for sources without a countKey (icon otherwise derives from countKey). */
  icon?: SectionIconName
}

export interface ThreadConfig {
  key: ThreadKey
  href: string
  label: string
  question: string
  description: string
  curationRule: string
  sources: ThreadSource[]
}

export const THREADS: ThreadConfig[] = AREAS.map((area) => ({
  ...area,
  curationRule: "Cada cifra y relación debe incluir su fuente y alcance.",
  sources: (
    getSectionsByHub().find((g) => g.hub.href === area.href)?.sections ?? []
  ).map((s) => ({
    href: s.href,
    label: s.label,
    description: s.description ?? "",
    section: s.section,
    countKey: s.key,
  })),
}))
export function getThread(key: ThreadKey): ThreadConfig {
  return THREADS.find((thread) => thread.key === key)!
}
