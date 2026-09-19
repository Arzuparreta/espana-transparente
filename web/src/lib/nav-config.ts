import { GITHUB_URL } from "./brand"
export interface NavItem {
  href: string
  label: string
}
export interface SectionMeta extends NavItem {
  key: string
  matchHref?: string
  shortLabel?: string
  groupLabel?: string
  area?: string
  section?: string
  description?: string
  hidden?: boolean
}
export const AREAS = [
  {
    key: "dinero",
    href: "/dinero",
    label: "Dinero público",
    question: "¿A dónde va el dinero público?",
    description: "Ingresos, gasto, presupuestos y operaciones documentadas.",
  },
  {
    key: "personas",
    href: "/personas",
    label: "Personas y entidades",
    question: "¿Quién ocupa los cargos y con quién se relaciona?",
    description:
      "Personas, organizaciones y relaciones documentadas entre ellas.",
  },
  {
    key: "decisiones",
    href: "/decisiones",
    label: "Decisiones",
    question: "¿Quién decidió qué?",
    description: "Votos individuales, iniciativas y representación electoral.",
  },
  {
    key: "economia",
    href: "/economia",
    label: "Economía",
    question: "¿Cómo cambian los precios y tus ingresos?",
    description:
      "Precios, salarios, empleo y actividad económica con sus fuentes.",
  },
  {
    key: "territorio",
    href: "/territorio",
    label: "Territorio",
    question: "¿Qué datos hay sobre tu zona?",
    description:
      "Explora el mapa y consulta las operaciones publicadas por territorio.",
  },
] as const
export const PRIMARY_NAV: NavItem[] = AREAS.map(({ href, label }) => ({
  href,
  label,
}))
export const SECONDARY_NAV: NavItem[] = [
  { href: "/estado-datos", label: "Estado de los datos" },
  { href: GITHUB_URL, label: "GitHub" },
]
const COLLECTIONS: SectionMeta[] = [
  {
    key: "cuentas-publicas",
    href: "/cuentas-publicas",
    label: "Cuentas públicas",
    area: "dinero",
    section: "Cuentas",
    description: "Ingresos, gasto realizado, déficit, deuda e intereses.",
  },
  {
    key: "presupuestos",
    href: "/presupuestos",
    label: "Presupuestos",
    area: "dinero",
    section: "Presupuestos",
    description:
      "Créditos aprobados y programas de gasto; no equivalen al gasto realizado.",
  },
  {
    key: "contratos",
    href: "/contratos",
    label: "Contratos",
    area: "dinero",
    section: "Operaciones",
    description:
      "Qué se contrata, quién contrata y quién recibe la adjudicación.",
  },
  {
    key: "subvenciones",
    href: "/subvenciones",
    label: "Subvenciones",
    area: "dinero",
    section: "Operaciones",
    description: "Concesiones publicadas y sus beneficiarios.",
  },
  {
    key: "fondos-ue",
    href: "/fondos-ue",
    label: "Fondos europeos",
    area: "dinero",
    section: "Operaciones",
    description: "Proyectos y beneficiarios de fondos europeos.",
  },
  {
    key: "dinero-publico",
    href: "/dinero-publico",
    label: "Trazabilidad del gasto",
    area: "dinero",
    section: "Recorridos",
    description:
      "Sigue los vínculos publicados entre presupuestos y operaciones.",
  },
  {
    key: "diputados",
    href: "/diputados",
    label: "Diputados",
    area: "personas",
    section: "Cargos públicos",
    description: "Representantes, actividad y voto individual.",
  },
  {
    key: "senado",
    href: "/senado",
    label: "Senadores",
    area: "personas",
    section: "Cargos públicos",
    description: "Representantes de la cámara alta.",
  },
  {
    key: "gobierno",
    href: "/gobierno",
    label: "Gobierno",
    area: "personas",
    section: "Cargos públicos",
    description: "Personas que ocupan los cargos del Gobierno.",
  },
  {
    key: "ministerios",
    href: "/ministerios",
    label: "Ministerios",
    area: "personas",
    section: "Cargos públicos",
    description: "Titulares y estructura ministerial.",
  },
  {
    key: "instituciones",
    href: "/instituciones",
    label: "Instituciones y nombramientos",
    area: "personas",
    section: "Entidades",
    description: "Personas nombradas y sus vínculos documentados.",
  },
  {
    key: "organizaciones",
    href: "/organizaciones",
    label: "Empresas y organizaciones",
    area: "personas",
    section: "Entidades",
    description: "Órganos contratantes, empresas y receptores de fondos.",
  },
  {
    key: "partidos",
    href: "/partidos",
    label: "Partidos",
    area: "personas",
    section: "Entidades",
    description: "Representantes y relaciones dentro de cada partido.",
  },
  {
    key: "declaraciones",
    href: "/declaraciones",
    label: "Declaraciones económicas",
    area: "personas",
    section: "Actividad e intereses",
    description: "Bienes, rentas y actividades declaradas.",
  },
  {
    key: "puertas-giratorias",
    href: "/puertas-giratorias",
    label: "Puertas giratorias",
    area: "personas",
    section: "Actividad e intereses",
    description:
      "Trayectorias documentadas entre cargos públicos y sector privado.",
  },
  {
    key: "grupos-de-interes",
    href: "/grupos-de-interes",
    label: "Grupos de interés",
    area: "personas",
    section: "Actividad e intereses",
    description: "Inscripciones en el registro de la CNMC.",
  },
  {
    key: "corrupcion",
    href: "/corrupcion",
    label: "Procesos judiciales",
    area: "personas",
    section: "Actividad e intereses",
    description: "Procedimientos y situación procesal documentada.",
  },
  {
    key: "votaciones",
    href: "/votaciones",
    label: "Votaciones",
    area: "decisiones",
    section: "Actividad parlamentaria",
    description: "Resultados y votos de cada representante.",
  },
  {
    key: "iniciativas",
    href: "/iniciativas",
    label: "Iniciativas",
    area: "decisiones",
    section: "Actividad parlamentaria",
    description: "Propuestas, autoría y tramitación.",
  },
  {
    key: "asistencia",
    href: "/asistencia",
    label: "Asistencia",
    area: "decisiones",
    section: "Actividad parlamentaria",
    description: "Presencia registrada en las sesiones.",
  },
  {
    key: "divergencias",
    href: "/divergencias",
    label: "Divergencias de voto",
    area: "decisiones",
    section: "Actividad parlamentaria",
    description: "Votos distintos de los emitidos por el grupo.",
  },
  {
    key: "distorsion",
    href: "/distorsion",
    label: "Representación electoral",
    area: "decisiones",
    section: "Elecciones",
    description: "Relación entre votos y escaños por territorio.",
  },
  {
    key: "indicadores",
    href: "/indicadores",
    label: "Series económicas",
    area: "economia",
    section: "Series",
    description: "Precios, salarios, empleo y actividad económica.",
  },
  {
    key: "calculadoras",
    href: "/calculadoras",
    label: "Calculadoras",
    area: "economia",
    section: "Poder adquisitivo",
    description: "Compara inflación, salarios y poder adquisitivo.",
  },
  {
    key: "territorio",
    href: "/territorio",
    label: "Mapa",
    area: "territorio",
    section: "Por lugar",
    description: "Consulta los datos disponibles por territorio.",
  },
  {
    key: "tu-zona",
    href: "/territorio/tu-zona",
    label: "Tu zona",
    area: "territorio",
    section: "Por lugar",
    description: "Encuentra tu comunidad o municipio.",
  },
]
export const SECTION_META: SectionMeta[] = [
  ...AREAS.filter((a) => a.key !== "territorio").map((a) => ({
    key: a.key,
    href: a.href,
    label: a.label,
    area: a.key,
  })),
  ...COLLECTIONS.map((s) => ({
    ...s,
    groupLabel: AREAS.find((a) => a.key === s.area)!.label,
  })),
  {
    key: "senadores",
    href: "/senado",
    matchHref: "/senadores",
    label: "Senadores",
    area: "personas",
    groupLabel: "Personas y entidades",
    hidden: true,
  },
  {
    key: "cargos",
    href: "/gobierno",
    matchHref: "/cargos",
    label: "Cargos públicos",
    area: "personas",
    groupLabel: "Personas y entidades",
    hidden: true,
  },
  ...["organizacion", "diputado", "partido"].map((type) => ({
    key: `rastro-${type}`,
    href: "/personas",
    matchHref: `/rastro/${type}`,
    label: "Relaciones documentadas",
    area: "personas",
    groupLabel: "Personas y entidades",
    hidden: true,
  })),
  ...[
    "DEUDA_PUBLICA",
    "INGRESOS_PUBLICOS",
    "GASTO_PUBLICO",
    "SALDO_PUBLICO",
    "INTERESES_PUBLICOS",
    "IMPUESTOS_PUBLICOS",
    "COTIZACIONES_SOCIALES",
  ].map((code) => ({
    key: `fiscal-${code}`,
    href: "/cuentas-publicas",
    matchHref: `/indicadores/${code}`,
    label: "Cuentas públicas",
    area: "dinero",
    groupLabel: "Dinero público",
    hidden: true,
  })),
  ...[
    { key: "buscar", label: "Búsqueda" },
    { key: "estado-datos", label: "Estado de los datos" },
    { key: "perfil", label: "Perfil" },
    { key: "usuarios", label: "Usuarios" },
  ].map((s) => ({ ...s, href: `/${s.key}` })),
]
export function getSectionsByHub() {
  return PRIMARY_NAV.map((hub) => ({
    hub,
    sections: SECTION_META.filter(
      (s) => !s.hidden && s.groupLabel === hub.label,
    ),
  }))
}
export function getSectionForPath(pathname: string): SectionMeta | null {
  const path = pathname.split("?")[0]?.replace(/\/$/, "") || "/"
  return (
    SECTION_META.filter((s) => {
      const match = s.matchHref ?? s.href
      return path === match || path.startsWith(`${match}/`)
    }).sort(
      (a, b) => (b.matchHref ?? b.href).length - (a.matchHref ?? a.href).length,
    )[0] ?? null
  )
}
export function getAreaForPath(pathname: string) {
  const section = getSectionForPath(pathname)
  return AREAS.find((a) => a.key === section?.area) ?? null
}
export function groupSections(sections: SectionMeta[]) {
  const groups = new Map<string, SectionMeta[]>()
  for (const section of sections) {
    const name = section.section ?? "Colecciones"
    groups.set(name, [...(groups.get(name) ?? []), section])
  }
  return Array.from(groups, ([label, items]) => ({ label, items }))
}
