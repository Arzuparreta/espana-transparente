import { GITHUB_URL } from "@/lib/brand"
import { THREADS } from "@/lib/thread-config"

export interface NavItem {
  href: string
  label: string
  /** Long form used by the mobile menu when it differs from the desktop label. */
  longLabel?: string
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export interface SectionMeta {
  key: string
  href: string
  label: string
  shortLabel?: string
  groupLabel?: string
}

export const PRIMARY_NAV: NavGroup[] = [
  ...THREADS.map((thread) => ({
    label: thread.label,
    items: [
      { href: thread.href, label: "Vista general", longLabel: thread.question },
      ...thread.sources.map((source) => ({ href: source.href, label: source.label })),
    ],
  })),
]

/** Extra surfacing for the mobile drawer (Header surfaces these via the search trigger + footer). */
export const SECONDARY_NAV: NavGroup = {
  label: "Más",
  items: [
    { href: "/buscar", label: "Búsqueda" },
    { href: "/estado-datos", label: "Estado de los datos" },
    { href: GITHUB_URL, label: "GitHub" },
  ],
}

export const SECTION_META: SectionMeta[] = [
  { key: "dinero", href: "/dinero", label: "Dinero" },
  { key: "economia", href: "/economia", label: "Economía" },
  { key: "integridad", href: "/integridad", label: "Integridad" },
  { key: "poder", href: "/poder", label: "Poder" },
  { key: "territorio", href: "/territorio", label: "Territorio" },
  { key: "diputados", href: "/diputados", label: "Diputados", groupLabel: "Poder" },
  { key: "senado", href: "/senado", label: "Senado", groupLabel: "Poder" },
  { key: "gobierno", href: "/gobierno", label: "Gobierno", groupLabel: "Poder" },
  { key: "partidos", href: "/partidos", label: "Partidos", groupLabel: "Poder" },
  { key: "instituciones", href: "/instituciones", label: "Instituciones", groupLabel: "Integridad" },
  { key: "votaciones", href: "/votaciones", label: "Votaciones", groupLabel: "Poder" },
  { key: "corrupcion", href: "/corrupcion", label: "Procesos judiciales", shortLabel: "procesos judiciales", groupLabel: "Integridad" },
  { key: "presupuestos", href: "/presupuestos", label: "Presupuestos", groupLabel: "Dinero" },
  { key: "contratos", href: "/contratos", label: "Contratos", groupLabel: "Dinero" },
  { key: "subvenciones", href: "/subvenciones", label: "Subvenciones", groupLabel: "Dinero" },
  { key: "fondos-ue", href: "/fondos-ue", label: "Fondos UE", groupLabel: "Dinero" },
  { key: "puertas-giratorias", href: "/puertas-giratorias", label: "Puertas giratorias", groupLabel: "Integridad" },
  { key: "organizaciones", href: "/organizaciones", label: "Organizaciones", groupLabel: "Dinero" },
  { key: "indicadores", href: "/indicadores", label: "Indicadores", groupLabel: "Economía" },
  { key: "buscar", href: "/buscar", label: "Resultados", shortLabel: "resultados" },
  { key: "estado-datos", href: "/estado-datos", label: "Estado de los datos" },
  { key: "iniciativas", href: "/iniciativas", label: "Iniciativas", groupLabel: "Poder" },
  { key: "ministerios", href: "/ministerios", label: "Ministerios", groupLabel: "Poder" },
  { key: "declaraciones", href: "/declaraciones", label: "Declaraciones económicas", shortLabel: "Declaraciones", groupLabel: "Integridad" },
  { key: "dinero-publico", href: "/dinero-publico", label: "Trazabilidad del gasto", shortLabel: "Trazabilidad", groupLabel: "Dinero" },
  { key: "ccaa", href: "/ccaa", label: "Gasto autonómico", shortLabel: "CCAA", groupLabel: "Territorio" },
  { key: "municipios", href: "/municipios", label: "Gasto municipal", shortLabel: "Municipios", groupLabel: "Territorio" },
  { key: "perfil", href: "/perfil", label: "Perfil" },
  { key: "usuarios", href: "/usuarios", label: "Usuarios" },
]


export function getSectionForPath(pathname: string): SectionMeta | null {
  const cleanPath = pathname.split("?")[0]?.replace(/\/$/, "") || "/"
  return (
    SECTION_META
      .filter((section) => cleanPath === section.href || cleanPath.startsWith(`${section.href}/`))
      .sort((a, b) => b.href.length - a.href.length)[0] ?? null
  )
}
