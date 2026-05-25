export type ThreadKey = "dinero" | "economia" | "integridad" | "poder" | "territorio"

export interface ThreadSource {
  href: string
  label: string
  description: string
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
    key: "dinero",
    href: "/dinero",
    label: "Dinero",
    question: "¿A dónde va el dinero público?",
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
    question: "¿Cómo me afecta la economía?",
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
      {
        href: "/estado-datos",
        label: "Estado de los datos",
        description: "Frescura de los pipelines que alimentan las series económicas.",
        countKey: "estado-datos",
      },
    ],
  },
  {
    key: "integridad",
    href: "/integridad",
    label: "Integridad",
    question: "¿Es honesto quien me representa?",
    description:
      "Declaraciones económicas, puertas giratorias, procesos judiciales y nombramientos institucionales.",
    curationRule:
      "Publica solo registros con fuente explícita y separa hechos declarados, nombramientos y procedimientos.",
    sources: [
      {
        href: "/declaraciones",
        label: "Declaraciones",
        description: "Bienes, rentas, actividades e intereses económicos declarados.",
        countKey: "declaraciones",
        countUnit: "declaraciones",
      },
      {
        href: "/puertas-giratorias",
        label: "Puertas giratorias",
        description: "Casos verificados de paso entre cargo público y sector privado.",
        countKey: "puertas-giratorias",
        countUnit: "casos",
      },
      {
        href: "/corrupcion",
        label: "Procesos judiciales",
        description: "Procedimientos publicados por fuentes judiciales oficiales.",
        countKey: "corrupcion",
        countUnit: "casos",
      },
      {
        href: "/instituciones",
        label: "Instituciones",
        description: "Nombramientos en TC, CGPJ, RTVE y SEPI.",
        countKey: "instituciones",
        countUnit: "nombramientos",
      },
    ],
  },
  {
    key: "poder",
    href: "/poder",
    label: "Poder",
    question: "¿Quién manda y cómo decide?",
    description:
      "Personas, partidos, Gobierno, cámaras, organismos de control e iniciativas legislativas enlazadas por decisiones públicas.",
    curationRule:
      "Prioriza cargos y decisiones actuales; las votaciones divergentes se quedan en páginas de detalle.",
    sources: [
      {
        href: "/gobierno",
        label: "Gobierno",
        description: "Presidencia, vicepresidencias y ministerios del gabinete actual.",
        countKey: "gobierno",
        countUnit: "cargos",
      },
      {
        href: "/diputados",
        label: "Diputados",
        description: "Diputados activos del Congreso con grupo y circunscripción.",
        countKey: "diputados",
        countUnit: "activos",
      },
      {
        href: "/senado",
        label: "Senado",
        description: "Senadores activos y composición de la cámara alta.",
        countKey: "senado",
        countUnit: "activos",
      },
      {
        href: "/partidos",
        label: "Partidos",
        description: "Partidos y grupos parlamentarios con representación.",
        countKey: "partidos",
        countUnit: "registrados",
      },
      {
        href: "/votaciones",
        label: "Votaciones",
        description: "Sesiones con voto nominal y resultado individual.",
        countKey: "votaciones",
        countUnit: "sesiones",
      },
      {
        href: "/iniciativas",
        label: "Iniciativas",
        description: "Proyectos de ley, proposiciones y mociones en tramitación.",
        countKey: "iniciativas",
        countUnit: "registradas",
      },
      {
        href: "/instituciones",
        label: "Organismos de control",
        description: "Nombramientos en TC, CGPJ, RTVE y SEPI — quién ocupa los organismos de control.",
        countKey: "instituciones",
        countUnit: "nombramientos",
      },
    ],
  },
  {
    key: "territorio",
    href: "/territorio",
    label: "Territorio",
    question: "¿Qué pasa donde vivo?",
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
      {
        href: "/fondos-ue",
        label: "Fondos UE",
        description: "Beneficiarios españoles de fondos europeos 2014-2027, por comunidad.",
        countKey: "fondos-ue",
        countUnit: "beneficiarios",
      },
    ],
  },
]

export function getThread(key: ThreadKey): ThreadConfig {
  const thread = THREADS.find((item) => item.key === key)
  if (!thread) throw new Error(`Unknown thread: ${key}`)
  return thread
}
