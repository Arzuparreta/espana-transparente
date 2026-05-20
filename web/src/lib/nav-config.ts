import { GITHUB_URL } from "@/lib/brand"

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
}

export const PRIMARY_NAV: NavGroup[] = [
  {
    label: "Personas",
    items: [
      { href: "/diputados", label: "Diputados" },
      { href: "/senado", label: "Senado" },
      { href: "/gobierno", label: "Gobierno" },
      { href: "/partidos", label: "Partidos" },
      { href: "/instituciones", label: "Instituciones" },
    ],
  },
  {
    label: "Dinero y leyes",
    items: [
      { href: "/votaciones", label: "Votaciones" },
      { href: "/presupuestos", label: "Presupuestos" },
      { href: "/contratos", label: "Contratos", longLabel: "Contratos públicos" },
      { href: "/subvenciones", label: "Subvenciones" },
      { href: "/fondos-ue", label: "Fondos UE", longLabel: "Fondos europeos" },
    ],
  },
  {
    label: "Conexiones y contexto",
    items: [
      { href: "/puertas-giratorias", label: "Puertas giratorias" },
      { href: "/organizaciones", label: "Organizaciones" },
      { href: "/indicadores", label: "Indicadores", longLabel: "Indicadores económicos" },
    ],
  },
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
  { key: "diputados", href: "/diputados", label: "Diputados" },
  { key: "senado", href: "/senado", label: "Senado" },
  { key: "gobierno", href: "/gobierno", label: "Gobierno" },
  { key: "partidos", href: "/partidos", label: "Partidos" },
  { key: "instituciones", href: "/instituciones", label: "Instituciones" },
  { key: "votaciones", href: "/votaciones", label: "Votaciones" },
  { key: "presupuestos", href: "/presupuestos", label: "Presupuestos" },
  { key: "contratos", href: "/contratos", label: "Contratos" },
  { key: "subvenciones", href: "/subvenciones", label: "Subvenciones" },
  { key: "fondos-ue", href: "/fondos-ue", label: "Fondos UE" },
  { key: "puertas-giratorias", href: "/puertas-giratorias", label: "Puertas giratorias" },
  { key: "organizaciones", href: "/organizaciones", label: "Organizaciones" },
  { key: "indicadores", href: "/indicadores", label: "Indicadores" },
  { key: "buscar", href: "/buscar", label: "Resultados", shortLabel: "resultados" },
  { key: "estado-datos", href: "/estado-datos", label: "Estado de los datos" },
  { key: "iniciativas", href: "/iniciativas", label: "Iniciativas" },
  { key: "ministerios", href: "/ministerios", label: "Ministerios" },
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
