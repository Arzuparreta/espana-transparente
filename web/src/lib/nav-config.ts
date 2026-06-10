import { GITHUB_URL } from "@/lib/brand"
export interface NavItem {
  href: string
  label: string
}

export interface SectionMeta {
  key: string
  href: string
  matchHref?: string
  label: string
  shortLabel?: string
  groupLabel?: string
}

export const PRIMARY_NAV: NavItem[] = [
  { href: "/personas", label: "Personas" },
  { href: "/dinero", label: "Dinero" },
  { href: "/economia", label: "Economía" },
]

export const SECONDARY_NAV: NavItem[] = [
  { href: "/estado-datos", label: "Estado de los datos" },
  { href: GITHUB_URL, label: "GitHub" },
]

export const SECTION_META: SectionMeta[] = [
  { key: "personas", href: "/personas", label: "Personas" },
  { key: "dinero", href: "/dinero", label: "Dinero" },
  { key: "economia", href: "/economia", label: "Economía" },
  { key: "territorio", href: "/territorio", label: "Mapa del gasto", shortLabel: "Mapa", groupLabel: "Dinero" },
  { key: "diputados", href: "/diputados", label: "Diputados", groupLabel: "Personas" },
  {
    key: "asistencia",
    href: "/diputados?view=asistencia",
    matchHref: "/asistencia",
    label: "Asistencia",
    groupLabel: "Personas",
  },
  { key: "senado", href: "/senado", label: "Senado", groupLabel: "Personas" },
  { key: "gobierno", href: "/gobierno", label: "Gobierno", groupLabel: "Personas" },
  { key: "partidos", href: "/partidos", label: "Partidos", groupLabel: "Personas" },
  { key: "instituciones", href: "/instituciones", label: "Nombramientos", shortLabel: "Instituciones", groupLabel: "Personas" },
  { key: "votaciones", href: "/votaciones", label: "Votaciones", groupLabel: "Personas" },
  { key: "corrupcion", href: "/corrupcion", label: "Procesos judiciales", shortLabel: "procesos judiciales", groupLabel: "Personas" },
  { key: "presupuestos", href: "/presupuestos", label: "Presupuestos", groupLabel: "Dinero" },
  { key: "contratos", href: "/contratos", label: "Contratos", groupLabel: "Dinero" },
  { key: "subvenciones", href: "/subvenciones", label: "Subvenciones", groupLabel: "Dinero" },
  { key: "fondos-ue", href: "/fondos-ue", label: "Fondos UE", groupLabel: "Dinero" },
  { key: "puertas-giratorias", href: "/puertas-giratorias", label: "Puertas giratorias", groupLabel: "Personas" },
  { key: "organizaciones", href: "/organizaciones", label: "Organizaciones", groupLabel: "Dinero" },
  {
    key: "indicadores",
    href: "/indicadores",
    matchHref: "/indicadores",
    label: "Series",
    groupLabel: "Economía",
  },
  { key: "buscar", href: "/buscar", label: "Resultados", shortLabel: "resultados" },
  { key: "estado-datos", href: "/estado-datos", label: "Estado de los datos" },
  { key: "iniciativas", href: "/iniciativas", label: "Iniciativas", groupLabel: "Personas" },
  {
    key: "divergencias",
    href: "/diputados?view=divergencias",
    matchHref: "/divergencias",
    label: "Divergencias",
    groupLabel: "Personas",
  },
  { key: "ministerios", href: "/ministerios", label: "Ministerios", groupLabel: "Personas" },
  { key: "declaraciones", href: "/declaraciones", label: "Declaraciones económicas", shortLabel: "Declaraciones", groupLabel: "Personas" },
  { key: "grupos-de-interes", href: "/grupos-de-interes", label: "Grupos de interés", groupLabel: "Personas" },
  {
    key: "dinero-publico",
    href: "/dinero?view=trazabilidad",
    matchHref: "/dinero-publico",
    label: "Trazabilidad del gasto",
    shortLabel: "Trazabilidad",
    groupLabel: "Dinero",
  },
  {
    key: "ccaa",
    href: "/territorio?view=autonomico",
    matchHref: "/ccaa",
    label: "Gasto autonómico",
    shortLabel: "CCAA",
    groupLabel: "Dinero",
  },
  {
    key: "municipios",
    href: "/territorio?view=municipal",
    matchHref: "/municipios",
    label: "Gasto municipal",
    shortLabel: "Municipios",
    groupLabel: "Dinero",
  },
  { key: "perfil", href: "/perfil", label: "Perfil" },
  { key: "usuarios", href: "/usuarios", label: "Usuarios" },
]


export function getSectionForPath(pathname: string): SectionMeta | null {
  const cleanPath = pathname.split("?")[0]?.replace(/\/$/, "") || "/"
  return (
    SECTION_META
      .filter((section) => {
        const matchHref = section.matchHref ?? section.href.split("?")[0]
        return cleanPath === matchHref || cleanPath.startsWith(`${matchHref}/`)
      })
      .sort((a, b) => {
        const aMatch = a.matchHref ?? a.href.split("?")[0]
        const bMatch = b.matchHref ?? b.href.split("?")[0]
        return bMatch.length - aMatch.length
      })[0] ?? null
  )
}
