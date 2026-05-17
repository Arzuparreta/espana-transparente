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

export const PRIMARY_NAV: NavGroup[] = [
  {
    label: "Personas",
    items: [
      { href: "/diputados", label: "Diputados" },
      { href: "/senado", label: "Senado" },
      { href: "/partidos", label: "Partidos" },
      { href: "/gobierno", label: "Gobierno" },
      { href: "/instituciones", label: "Instituciones" },
      { href: "/votaciones", label: "Votaciones" },
    ],
  },
  {
    label: "Dinero público",
    items: [
      { href: "/presupuestos", label: "Presupuestos" },
      { href: "/contratos", label: "Contratos", longLabel: "Contratos públicos" },
      { href: "/subvenciones", label: "Subvenciones" },
      { href: "/fondos-ue", label: "Fondos UE", longLabel: "Fondos europeos" },
      { href: "/organizaciones", label: "Organizaciones" },
    ],
  },
  {
    label: "Contexto",
    items: [
      { href: "/indicadores", label: "Indicadores", longLabel: "Indicadores económicos" },
      { href: "/puertas-giratorias", label: "Puertas giratorias" },
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
