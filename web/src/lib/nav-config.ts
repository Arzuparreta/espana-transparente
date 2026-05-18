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
