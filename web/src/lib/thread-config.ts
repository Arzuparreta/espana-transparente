export type ThreadKey = "personas" | "dinero" | "economia" | "territorio"

export interface ThreadSource {
  href: string
  label: string
  description: string
  /** Optional sub-group caption (e.g. "Cargos" / "Decisiones") for grouped threads. */
  section?: string
  countKey?: string
  countUnit?: string
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

export const THREADS: ThreadConfig[] = [
  {
    key: "personas",
    href: "/personas",
    label: "Personas",
    question: "Cargos públicos, sus decisiones y su conducta",
    description:
      "Diputados, senado, gobierno y partidos; sus votaciones e iniciativas; y su conducta: declaraciones, puertas giratorias y procesos judiciales.",
    curationRule:
      "Prioriza cargos y decisiones actuales; las votaciones divergentes y los procesos se quedan en páginas de detalle.",
    sources: [
      {
        href: "/diputados",
        label: "Diputados",
        description: "Diputados activos del Congreso con grupo y circunscripción.",
        section: "Cargos",
        countKey: "diputados",
        countUnit: "activos",
      },
      {
        href: "/senado",
        label: "Senado",
        description: "Senadores activos y composición de la cámara alta.",
        section: "Cargos",
        countKey: "senado",
        countUnit: "activos",
      },
      {
        href: "/gobierno",
        label: "Gobierno",
        description: "Presidencia, vicepresidencias y ministerios del gabinete actual.",
        section: "Cargos",
        countKey: "gobierno",
        countUnit: "cargos",
      },
      {
        href: "/partidos",
        label: "Partidos",
        description: "Partidos y grupos parlamentarios con representación.",
        section: "Cargos",
        countKey: "partidos",
        countUnit: "registrados",
      },
      {
        href: "/instituciones",
        label: "Nombramientos",
        description: "Personas nombradas en TC, CGPJ, RTVE y SEPI, y por qué partido fue propuesta cada una.",
        section: "Cargos",
        countKey: "instituciones",
        countUnit: "nombramientos",
      },
      {
        href: "/votaciones",
        label: "Votaciones",
        description: "Sesiones con voto nominal y resultado individual.",
        section: "Decisiones",
        countKey: "votaciones",
        countUnit: "sesiones",
      },
      {
        href: "/iniciativas",
        label: "Iniciativas",
        description: "Proyectos de ley, proposiciones y mociones en tramitación.",
        section: "Decisiones",
        countKey: "iniciativas",
        countUnit: "registradas",
      },
      {
        href: "/declaraciones",
        label: "Declaraciones",
        description: "Bienes, rentas, actividades e intereses económicos declarados.",
        section: "Conducta",
        countKey: "declaraciones",
        countUnit: "declaraciones",
      },
      {
        href: "/puertas-giratorias",
        label: "Puertas giratorias",
        description: "Casos verificados de paso entre cargo público y sector privado.",
        section: "Conducta",
        countKey: "puertas-giratorias",
        countUnit: "casos",
      },
      {
        href: "/corrupcion",
        label: "Procesos judiciales",
        description: "Procedimientos publicados por fuentes judiciales oficiales.",
        section: "Conducta",
        countKey: "corrupcion",
        countUnit: "casos",
      },
    ],
  },
  {
    key: "dinero",
    href: "/dinero",
    label: "Dinero",
    question: "A dónde va el dinero público",
    description:
      "Presupuestos, contratos, subvenciones y fondos europeos: a quién se adjudica, cuánto importa y qué organismo lo autoriza.",
    curationRule:
      "Ordena primero los importes trazables más recientes y conserva siempre el enlace al registro fuente.",
    sources: [
      {
        href: "/dinero-publico",
        label: "Trazabilidad del gasto",
        description: "Cascada desde presupuesto hasta contratos y subvenciones por ministerio.",
        countKey: "dinero-publico",
      },
      {
        href: "/presupuestos",
        label: "Presupuestos",
        description: "Secciones y programas de los Presupuestos Generales del Estado.",
        countKey: "presupuestos",
        countUnit: "secciones-año",
      },
      {
        href: "/contratos",
        label: "Contratos",
        description: "Adjudicaciones publicadas por la Plataforma de Contratación.",
        countKey: "contratos",
        countUnit: "licitaciones",
      },
      {
        href: "/subvenciones",
        label: "Subvenciones",
        description: "Concesiones publicadas en la Base de Datos Nacional de Subvenciones.",
        countKey: "subvenciones",
        countUnit: "concesiones",
      },
      {
        href: "/fondos-ue",
        label: "Fondos UE",
        description: "Beneficiarios españoles de fondos europeos 2014-2027.",
        countKey: "fondos-ue",
        countUnit: "beneficiarios",
      },
      {
        href: "/organizaciones",
        label: "Organizaciones",
        description: "Empresas y entidades vinculadas a registros de gasto público.",
        countKey: "organizaciones",
        countUnit: "entidades",
      },
    ],
  },
  {
    key: "economia",
    href: "/economia",
    label: "Economía",
    question: "Precios, deuda, empleo y salarios",
    description:
      "Series económicas públicas con explicación directa: precios, deuda, empleo, salarios y actividad.",
    curationRule:
      "Muestra el último dato disponible de cada serie con su periodo y fuente; no mezcles periodos sin etiquetarlos.",
    sources: [
      {
        href: "/indicadores",
        label: "Indicadores",
        description: "IPC, deuda pública, PIB, empleo y salario medio.",
        countKey: "indicadores",
        countUnit: "series",
      },
    ],
  },
  {
    key: "territorio",
    href: "/territorio",
    label: "Territorio",
    question: "El gasto público desde tu comunidad o municipio",
    description:
      "Gasto autonómico, gasto municipal y fondos europeos: el dinero público visto desde tu comunidad o municipio.",
    curationRule:
      "Agrupa por territorio administrativo y etiqueta la cobertura real de cada fuente.",
    sources: [
      {
        href: "/ccaa",
        label: "CCAA",
        description: "Contratos y subvenciones con ámbito autonómico.",
        countKey: "ccaa",
      },
      {
        href: "/municipios",
        label: "Municipios",
        description: "Contratos y subvenciones con ámbito local.",
        countKey: "municipios",
      },
    ],
  },
]

export function getThread(key: ThreadKey): ThreadConfig {
  const thread = THREADS.find((item) => item.key === key)
  if (!thread) throw new Error(`Unknown thread: ${key}`)
  return thread
}
