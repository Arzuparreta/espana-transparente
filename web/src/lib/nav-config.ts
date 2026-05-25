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
        countKey: "dinero-publico",
        href: "/dinero-publico",
        label: "Trazabilidad del gasto",
        description: "Recorrido del dinero público desde el PGE hasta contratos y subvenciones.",
      },
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
      {
        countKey: "ccaa",
        href: "/ccaa",
        label: "Gasto autonómico",
        description: "Subvenciones y contratos con ámbito de comunidad autónoma en BDNS y PCSP.",
      },
      {
        countKey: "municipios",
        href: "/municipios",
        label: "Gasto municipal",
        description: "Subvenciones y contratos con ámbito local publicados en fuentes abiertas.",
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
      {
        countKey: "corrupcion",
        href: "/corrupcion",
        label: "Procesos judiciales",
        description: "Procedimientos publicados por fuentes judiciales oficiales con vínculos a personas y organizaciones.",
        countUnit: "casos",
      },
      {
        countKey: "declaraciones",
        href: "/declaraciones",
        label: "Declaraciones económicas",
        description: "Bienes, rentas, actividades e intereses económicos declarados por los diputados.",
        countUnit: "declaraciones",
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
