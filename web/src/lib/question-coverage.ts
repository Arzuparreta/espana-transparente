// Which citizen questions the portal can answer, from which source, and what each
// answer leaves out. Versioned with the design contracts in docs/designs/.
// `monitor` is a key of CRITICAL_ETL_PIPELINES: a fresh pipeline proves the source
// was read, not that the answer is exhaustive.

export type CoveredQuestion = {
  area: "Dinero público" | "Personas y entidades" | "Decisiones" | "Economía" | "Territorio"
  question: string
  href: string
  source: string
  covers: string
  excludes: string
  monitor: string | null
}

export const COVERED_QUESTIONS: CoveredQuestion[] = [
  {
    area: "Dinero público",
    question: "¿Cuánto ingresaron y gastaron las administraciones y qué saldo quedó?",
    href: "/dinero",
    source: "Eurostat, cuentas de las administraciones públicas (SEC 2010)",
    covers: "España, total y cuatro subsectores, ejercicios completos desde 2016",
    excludes: "No es presupuesto autorizado ni caja; el déficit no equivale a la variación de la deuda",
    monitor: "fiscal",
  },
  {
    area: "Dinero público",
    question: "¿En qué se gastó el dinero público?",
    href: "/gasto-por-funciones",
    source: "Eurostat, gasto por funciones COFOG nivel I",
    covers: "Administraciones públicas consolidadas, diez funciones, 2016–2024",
    excludes: "Sin desglose territorial ni por programa; una función no es un ministerio",
    monitor: "cofog",
  },
  {
    area: "Dinero público",
    question: "¿Qué parte del presupuesto del Estado se comprometió y pagó?",
    href: "/ejecucion-presupuestaria",
    source: "IGAE, ejecución mensual del presupuesto del Estado",
    covers: "Estado, doce cortes acumulados de 2025 por capítulo",
    excludes: "No incluye Seguridad Social, comunidades ni ayuntamientos; no cubre 2026",
    monitor: "state-execution",
  },
  {
    area: "Dinero público",
    question: "¿Qué se compra y con cuánta competencia?",
    href: "/contratos",
    source: "PCSP, perfiles de contratante alojados en la plataforma",
    covers: "Expedientes con adjudicación publicada por año, administración y división CPV",
    excludes: "Sin contratos menores ni plataformas autonómicas propias; presupuesto de licitación, no pagos",
    monitor: "contract-purchases",
  },
  {
    area: "Dinero público",
    question: "¿Para qué se concedieron ayudas?",
    href: "/ayudas-por-finalidad",
    source: "BDNS, concesiones y finalidad de su convocatoria",
    covers: "Concesiones a organizaciones recopiladas, por año de concesión e instrumento",
    excludes: "No todas las ayudas a hogares ni las anonimizadas; concesión no acredita pago",
    monitor: "bdns-calls",
  },
  {
    area: "Dinero público",
    question: "¿Qué pagos agrarios registra cada fondo europeo?",
    href: "/fondos-ue/pac",
    source: "FEGA, cierre consolidado del ejercicio financiero 2025",
    covers: "FEAGA y FEADER por organismo pagador, 16/10/2024–15/10/2025",
    excludes: "El organismo pagador no es el lugar beneficiado; no se suman los dos fondos",
    monitor: "pac-pagos",
  },
  {
    area: "Dinero público",
    question: "¿Qué fase financiera alcanzó cada programa FEDER?",
    href: "/fondos-ue/cohesion",
    source: "Comisión Europea, Cohesion Open Data",
    covers: "Programas FEDER de España, ciclo 2014–2020, implementación y transferencias netas",
    excludes: "No acredita pagos a beneficiarios; coste previsto y transferencias tienen perímetros distintos",
    monitor: "cohesion-feder",
  },
  {
    area: "Dinero público",
    question: "¿Qué concede el programa PRTR DUS 5000 y qué financian los instrumentos ICO?",
    href: "/fondos-ue/prtr",
    source: "IDAE, resoluciones favorables; BOE, convenio y adenda ICO",
    covers: "Presupuesto y concesiones por expediente DUS 5000; compromisos ICO por anualidad 2024–2026",
    excludes: "No es todo el PRTR; sin pagos individuales acreditados",
    monitor: "prtr-dus5000",
  },
  {
    area: "Personas y entidades",
    question: "¿Quién ocupa los cargos del Gobierno y desde cuándo?",
    href: "/personas",
    source: "BOE y registro de cargos del portal",
    covers: "Puestos estatales vigentes con fecha de inicio y documento cuando consta",
    excludes: "Un nombramiento no prueba la firma de cada operación del departamento",
    monitor: "government",
  },
  {
    area: "Decisiones",
    question: "¿Qué actividad consta sobre vivienda en el Congreso?",
    href: "/decisiones",
    source: "Congreso, intervenciones por iniciativa",
    covers: "Legislatura XV, selección por palabras del título, por año de sesión",
    excludes: "No es clasificación oficial ni tiempo de debate; una intervención no es una ley",
    monitor: "parliament-activity",
  },
  {
    area: "Decisiones",
    question: "¿Qué ley se publicó a partir de este proyecto y desde cuándo rige?",
    href: "/iniciativas",
    source: "Congreso, ficha del expediente; BOE, XML del diario",
    covers: "Proyectos de ley aprobados de la legislatura XV",
    excludes: "Ausencia de enlace no prueba que no se publicara",
    monitor: "law-publication",
  },
  {
    area: "Decisiones",
    question: "¿Qué mociones e interpelaciones sobre vivienda constan en el Senado?",
    href: "/actividad-senado",
    source: "Senado, catálogo de datos abiertos",
    covers: "Legislatura XV, mociones e interpelaciones seleccionadas por título",
    excludes: "Una moción aprobada no es una ley promulgada",
    monitor: "senate-control",
  },
  {
    area: "Economía",
    question: "¿Ha subido el salario medio más que los precios?",
    href: "/economia",
    source: "INE, Encuesta Anual de Estructura Salarial e IPC",
    covers: "España, salario medio bruto anual frente a media anual del IPC, desde 2009",
    excludes: "La media no describe a cada persona; salario bruto y cesta media",
    monitor: "expanded-indicators",
  },
  {
    area: "Economía",
    question: "¿Cómo se reparte el salario?",
    href: "/distribucion-salarial",
    source: "INE, EPA, salarios por decil",
    covers: "España, asalariados, salario bruto mensual 2021–2024",
    excludes: "No es renta del hogar, salario neto ni ingreso de autónomos",
    monitor: "wage-distribution",
  },
  {
    area: "Economía",
    question: "¿Cómo cambia el precio de la vivienda en mi comunidad?",
    href: "/precios-vivienda",
    source: "INE, índice de precios de vivienda (IPV)",
    covers: "España, 17 comunidades, Ceuta y Melilla, trimestral desde 2020",
    excludes: "No son euros por metro cuadrado ni alquiler; Ceuta y Melilla sin desglose nueva/usada",
    monitor: "housing-prices",
  },
  {
    area: "Territorio",
    question: "¿Qué autorizó, reconoció y pagó mi comunidad autónoma?",
    href: "/liquidacion-autonomica",
    source: "Hacienda, liquidación de los presupuestos autonómicos",
    covers: "17 comunidades, ejercicio 2024, liquidación definitiva consolidada",
    excludes: "Sin Ceuta y Melilla; no incluye ayuntamientos de la región",
    monitor: "autonomic-liquidation",
  },
  {
    area: "Territorio",
    question: "¿Qué autorizó y pagó mi ayuntamiento?",
    href: "/liquidacion-local",
    source: "ISTAC, liquidación municipal consolidada",
    covers: "88 municipios de Canarias, ejercicio 2024",
    excludes: "Resto de España sin cobertura; cabildos excluidos del piloto",
    monitor: "local-liquidation",
  },
  {
    area: "Territorio",
    question: "¿Qué ajuste de financiación corresponde a mi comunidad?",
    href: "/financiacion-territorial",
    source: "Hacienda, liquidación del sistema de financiación 2024",
    covers: "15 comunidades de régimen común, Ceuta y Melilla",
    excludes: "Navarra y País Vasco fuera del sistema (no cero); es un ajuste, no la financiación anual",
    monitor: "territorial-financing",
  },
  {
    area: "Territorio",
    question: "¿Cuántos pacientes esperan una operación en mi comunidad?",
    href: "/servicios/sanidad",
    source: "Ministerio de Sanidad, SISLE-SNS",
    covers: "19 administraciones, corte de diciembre de 2025, edición rectificada",
    excludes: "No relaciona causalmente gasto y espera; otros servicios sin cobertura",
    monitor: "surgical-waiting",
  },
]

export type QuestionStatus = "fresh" | "delayed" | "failed" | "missing" | "unmonitored"

export function questionStatuses(
  questions: CoveredQuestion[],
  statuses: { key: string; status: string }[],
): (CoveredQuestion & { status: QuestionStatus })[] {
  const byKey = new Map(statuses.map((row) => [row.key, row.status]))
  return questions.map((question) => {
    const status = question.monitor ? byKey.get(question.monitor) : undefined
    return {
      ...question,
      status: status === "fresh" || status === "delayed" || status === "failed" || status === "missing" ? status : "unmonitored",
    }
  })
}

// Topic words → covered answers. Search finds records by text; these answers come
// first so a topic query is not answered with an unclassified list alone.
const QUESTION_TOPICS: { words: string[]; hrefs: string[] }[] = [
  { words: ["vivienda", "viviendas", "alquiler", "alquileres", "hipoteca", "hipotecas", "pisos"], hrefs: ["/precios-vivienda", "/decisiones", "/actividad-senado"] },
  { words: ["salario", "salarios", "sueldo", "sueldos", "nomina", "precios", "ipc", "inflacion", "poder adquisitivo"], hrefs: ["/economia", "/distribucion-salarial"] },
  { words: ["sanidad", "sanitario", "hospital", "hospitales", "lista de espera", "listas de espera", "operacion", "cirugia"], hrefs: ["/servicios/sanidad", "/gasto-por-funciones"] },
  { words: ["deuda", "deficit", "superavit", "impuestos", "gasto publico", "ingresos publicos"], hrefs: ["/dinero", "/gasto-por-funciones", "/ejecucion-presupuestaria"] },
  { words: ["contrato", "contratos", "licitacion", "licitaciones", "adjudicacion", "adjudicaciones", "compras publicas"], hrefs: ["/contratos"] },
  { words: ["subvencion", "subvenciones", "ayuda", "ayudas"], hrefs: ["/ayudas-por-finalidad", "/fondos-ue/prtr"] },
  { words: ["fondos europeos", "next generation", "prtr", "feder", "pac", "mrr", "agricultura", "agrario"], hrefs: ["/fondos-ue/prtr", "/fondos-ue/cohesion", "/fondos-ue/pac"] },
  { words: ["ayuntamiento", "municipio", "comunidad autonoma", "financiacion autonomica", "financiacion territorial"], hrefs: ["/liquidacion-autonomica", "/liquidacion-local", "/financiacion-territorial"] },
  { words: ["ley", "leyes", "boe", "proyecto de ley"], hrefs: ["/iniciativas"] },
  { words: ["gobierno", "ministro", "ministra", "ministros", "cargo", "cargos"], hrefs: ["/personas"] },
]

const normalize = (value: string) =>
  ` ${value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9ñ]+/g, " ").trim()} `

export function answersForQuery(query: string): CoveredQuestion[] {
  const text = normalize(query)
  if (text.trim().length < 2) return []
  const hrefs = new Set<string>()
  for (const topic of QUESTION_TOPICS) {
    // Whole words only: "pac" must not match "capacidad".
    if (topic.words.some((word) => text.includes(normalize(word)))) topic.hrefs.forEach((href) => hrefs.add(href))
  }
  return COVERED_QUESTIONS.filter((question) => hrefs.has(question.href))
}
