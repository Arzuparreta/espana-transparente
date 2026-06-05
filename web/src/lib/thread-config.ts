export type ThreadKey = "personas" | "dinero" | "economia"

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
    question: "Cargos, decisiones y conducta",
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
        href: "/asistencia",
        label: "Asistencia",
        description: "Ranking de asistencia a plenos por diputado.",
        section: "Cargos",
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
        href: "/divergencias",
        label: "Divergencias",
        description: "Diputados que han votado distinto a la posición oficial de su grupo parlamentario.",
        section: "Decisiones",
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
      {
        href: "/grupos-de-interes",
        label: "Grupos de interés",
        description: "Organizaciones inscritas en el Registro de Grupos de Interés de la CNMC.",
        section: "Conducta",
        countKey: "grupos-de-interes",
        countUnit: "registros",
      },
    ],
  },
  {
    key: "dinero",
    href: "/dinero",
    label: "Dinero",
    question: "Gasto público, contratos y territorio",
    description:
      "Presupuestos, contratos, subvenciones y fondos europeos: a quién se adjudica, cuánto importa, qué organismo lo autoriza y cómo aterriza por territorio.",
    curationRule:
      "Ordena primero los importes trazables más recientes y conserva siempre el enlace al registro fuente.",
    sources: [
      {
        href: "/dinero-publico",
        label: "Trazabilidad del gasto",
        description: "Cascada desde presupuesto hasta contratos y subvenciones por ministerio.",
        section: "Visión general",
      },
      {
        href: "/presupuestos",
        label: "Presupuestos",
        description: "Secciones y programas de los Presupuestos Generales del Estado.",
        section: "Fuentes",
        countKey: "presupuestos",
        countUnit: "secciones-año",
      },
      {
        href: "/contratos",
        label: "Contratos",
        description: "Adjudicaciones publicadas por la Plataforma de Contratación.",
        section: "Fuentes",
        countKey: "contratos",
        countUnit: "licitaciones",
      },
      {
        href: "/subvenciones",
        label: "Subvenciones",
        description: "Concesiones publicadas en la Base de Datos Nacional de Subvenciones.",
        section: "Fuentes",
        countKey: "subvenciones",
        countUnit: "concesiones",
      },
      {
        href: "/fondos-ue",
        label: "Fondos UE",
        description: "Beneficiarios españoles de fondos europeos 2014-2027.",
        section: "Fuentes",
        countKey: "fondos-ue",
        countUnit: "beneficiarios",
      },
      {
        href: "/organizaciones",
        label: "Organizaciones",
        description: "Empresas y entidades vinculadas a registros de gasto público.",
        section: "Contrapartes",
        countKey: "organizaciones",
        countUnit: "entidades",
      },
      {
        href: "/territorio",
        label: "Mapa del gasto",
        description: "Vista autonómica del gasto registrado para orientarse antes del drilldown.",
        section: "Por territorio",
      },
      {
        href: "/ccaa",
        label: "Gasto autonómico",
        description: "Contratos y subvenciones agrupados por comunidad autónoma.",
        section: "Por territorio",
        countKey: "ccaa",
      },
      {
        href: "/municipios",
        label: "Gasto municipal",
        description: "Contratos y subvenciones agrupados por municipio o entidad local.",
        section: "Por territorio",
        countKey: "municipios",
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
]

export function getThread(key: ThreadKey): ThreadConfig {
  const thread = THREADS.find((item) => item.key === key)
  if (!thread) throw new Error(`Unknown thread: ${key}`)
  return thread
}
