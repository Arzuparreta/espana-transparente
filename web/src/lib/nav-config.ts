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
  { key: "declaraciones", href: "/declaraciones", label: "Declaraciones económicas", shortLabel: "Declaraciones" },
  { key: "perfil", href: "/perfil", label: "Perfil" },
  { key: "usuarios", href: "/usuarios", label: "Usuarios" },
]

/** Home "Qué hay aquí" map. Each item carries a factual description used by
 *  SectionIndexCard. `countKey` matches a section_key returned by the
 *  get_section_index() RPC. */
export interface AtlasItem {
  countKey: string
  href: string
  label: string
  description: string
  countUnit?: string
}

export interface AtlasGroup {
  label: string
  items: AtlasItem[]
}

export const ATLAS_GROUPS: AtlasGroup[] = [
  {
    label: "Personas",
    items: [
      {
        countKey: "diputados",
        href: "/diputados",
        label: "Diputados",
        description: "Diputados activos del Congreso con su grupo y circunscripción.",
        countUnit: "activos",
      },
      {
        countKey: "senado",
        href: "/senado",
        label: "Senado",
        description: "Senadores en activo y composición de la cámara alta.",
        countUnit: "activos",
      },
      {
        countKey: "gobierno",
        href: "/gobierno",
        label: "Gobierno",
        description: "Presidencia, vicepresidencias y ministerios del gabinete actual.",
        countUnit: "cargos",
      },
      {
        countKey: "partidos",
        href: "/partidos",
        label: "Partidos",
        description: "Partidos y grupos parlamentarios con representación.",
        countUnit: "registrados",
      },
      {
        countKey: "instituciones",
        href: "/instituciones",
        label: "Instituciones",
        description: "Nombramientos en TC, CGPJ, RTVE y SEPI.",
        countUnit: "nombramientos",
      },
    ],
  },
  {
    label: "Dinero público",
    items: [
      {
        countKey: "presupuestos",
        href: "/presupuestos",
        label: "Presupuestos",
        description: "Presupuestos Generales del Estado por sección y programa desde 2016.",
        countUnit: "secciones-año",
      },
      {
        countKey: "contratos",
        href: "/contratos",
        label: "Contratos",
        description: "Adjudicaciones del sector público estatal, autonómico y local.",
        countUnit: "licitaciones",
      },
      {
        countKey: "subvenciones",
        href: "/subvenciones",
        label: "Subvenciones",
        description: "Concesiones a organizaciones publicadas en la BDNS.",
        countUnit: "concesiones",
      },
      {
        countKey: "fondos-ue",
        href: "/fondos-ue",
        label: "Fondos UE",
        description: "Beneficiarios españoles de los fondos europeos 2014-2027.",
        countUnit: "beneficiarios",
      },
      {
        countKey: "organizaciones",
        href: "/organizaciones",
        label: "Organizaciones",
        description: "Empresas y entidades que aparecen en contratos o subvenciones.",
        countUnit: "entidades",
      },
    ],
  },
  {
    label: "Decisiones",
    items: [
      {
        countKey: "votaciones",
        href: "/votaciones",
        label: "Votaciones",
        description: "Sesiones del Congreso con el voto de cada diputado.",
        countUnit: "sesiones",
      },
      {
        countKey: "iniciativas",
        href: "/iniciativas",
        label: "Iniciativas",
        description: "Proyectos de ley, proposiciones y mociones en tramitación parlamentaria.",
        countUnit: "registradas",
      },
      {
        countKey: "distorsion",
        href: "/distorsion",
        label: "Distorsión electoral",
        description: "Diferencia entre votos recibidos y escaños obtenidos por circunscripción.",
      },
      {
        countKey: "puertas-giratorias",
        href: "/puertas-giratorias",
        label: "Puertas giratorias",
        description: "Cargos públicos que pasaron al sector privado, verificados con fuentes.",
        countUnit: "casos",
      },
    ],
  },
  {
    label: "Fuentes y cobertura",
    items: [
      {
        countKey: "indicadores",
        href: "/indicadores",
        label: "Indicadores",
        description: "Series del INE y Eurostat: IPC, deuda pública, PIB, empleo.",
        countUnit: "series",
      },
      {
        countKey: "estado-datos",
        href: "/estado-datos",
        label: "Estado de los datos",
        description: "Frescura de pipelines ETL y cobertura por nivel de administración.",
      },
      {
        countKey: "buscar",
        href: "/buscar",
        label: "Búsqueda",
        description: "Buscador transversal por persona, organización, contrato o votación.",
      },
    ],
  },
]

export function getSectionForPath(pathname: string): SectionMeta | null {
  const cleanPath = pathname.split("?")[0]?.replace(/\/$/, "") || "/"
  return (
    SECTION_META
      .filter((section) => cleanPath === section.href || cleanPath.startsWith(`${section.href}/`))
      .sort((a, b) => b.href.length - a.href.length)[0] ?? null
  )
}
