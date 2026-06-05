/**
 * Plain-language explanations for economic indicators.
 *
 * Every indicator_code present in the economic_indicators table MUST have
 * an entry here. The content:audit CI check enforces this.
 *
 * Texts reviewed for factual accuracy and plain-language clarity.
 * Last review: 2026-05-22 (GPT-5.5).
 */

export interface IndicatorExplanation {
  /** One-liner for the index card subtitle. */
  short: string
  /** 2-3 sentences for the detail page below the chart. */
  long: string
  /**
   * 2-3 concrete implications for the "¿Qué significa esto para ti?"
   * collapsible section. No political framing — just math and sourced facts.
   */
  implications: string[]
}

/**
 * Map of indicator_code → explanation.
 *
 * Codes match those emitted by etl/src/ine/indicadores.py:
 *   IPC             — IPC — Índice general (base 2025=100)
 *   IPC_VAR_MENSUAL — IPC — Variación mensual (%)
 *   IPC_VAR_ANUAL   — IPC — Variación anual (%)
 */
const EXPLANATIONS: Record<string, IndicatorExplanation> = {
  PIB: {
    short:
      "Mide el valor total de los bienes y servicios finales producidos en España durante un trimestre, a precios de mercado.",
    long:
      "El Producto Interior Bruto (PIB) es la principal magnitud de la Contabilidad Nacional. " +
      "Los datos trimestrales publicados por el INE muestran la evolución de la economía española en millones " +
      "de euros corrientes. Un PIB creciente indica expansión económica; una contracción durante dos trimestres " +
      "consecutivos se considera recesión técnica.",
    implications: [
      "El PIB per cápita (PIB dividido por la población) da una idea aproximada del nivel de vida medio, aunque no mide la distribución de la renta.",
      "La variación del PIB influye en la recaudación fiscal, el empleo y las decisiones de política económica que afectan a tu bolsillo.",
      "Un crecimiento sostenido del PIB suele asociarse con creación de empleo, pero no garantiza que los salarios suban al mismo ritmo.",
    ],
  },

  PIB_VAR_ANUAL: {
    short:
      "Indica cuánto ha crecido o decrecido la economía española respecto al mismo trimestre del año anterior.",
    long:
      "La variación anual del PIB compara el valor de un trimestre con el del mismo trimestre del año anterior, " +
      "eliminando efectos estacionales. Es el indicador más usado para medir el ritmo de crecimiento económico. " +
      "Los datos provienen de la Contabilidad Nacional Trimestral del INE.",
    implications: [
      "Si el PIB crece por debajo del 1% anual, la creación de empleo neto suele ser débil o nula.",
      "Una caída del PIB (crecimiento negativo) durante dos trimestres seguidos es lo que se llama recesión: suele traer aumento del paro y menor recaudación.",
      "El crecimiento del PIB no siempre se traduce en mejora para todos los hogares; importa también cómo se distribuye ese crecimiento.",
    ],
  },

  TASA_PARO: {
    short:
      "Porcentaje de la población activa que busca empleo y no lo encuentra, según la Encuesta de Población Activa.",
    long:
      "La tasa de paro mide la proporción de personas que, estando en edad y disposición de trabajar, " +
      "no tienen empleo y lo buscan activamente. La publica trimestralmente el INE a través de la EPA, " +
      "una encuesta a 65.000 hogares. Es el indicador de referencia del mercado laboral español.",
    implications: [
      "Una tasa de paro alta reduce el poder de negociación salarial de los trabajadores: hay más gente dispuesta a aceptar condiciones menores.",
      "El paro juvenil y el de larga duración suelen ser bastante más altos que la tasa general; conviene mirar ambos.",
      "La tasa de paro afecta directamente la recaudación de la Seguridad Social y la sostenibilidad de las pensiones.",
    ],
  },

  PARADOS: {
    short:
      "Número total de personas desempleadas en España, en miles, según la Encuesta de Población Activa.",
    long:
      "El número absoluto de parados complementa la tasa de paro. Mientras que la tasa expresa un porcentaje, " +
      "esta cifra muestra cuántas personas están sin empleo y buscándolo activamente. Ambos datos provienen " +
      "de la EPA del INE y se actualizan trimestralmente.",
    implications: [
      "El número de parados puede subir aunque la tasa baje, si la población activa crece más deprisa.",
      "Cada persona parada representa una pérdida de ingresos para ese hogar y menor consumo en la economía.",
      "Compara esta cifra con la tasa de paro para entender si los cambios vienen de variaciones en el empleo o en la población activa.",
    ],
  },

  SALARIO_MEDIO: {
    short:
      "Ganancia media bruta anual por trabajador en España, según la Encuesta Anual de Estructura Salarial.",
    long:
      "El salario medio bruto anual se obtiene de la Encuesta de Estructura Salarial del INE, que recoge " +
      "datos de las nóminas de los trabajadores por cuenta ajena. Es un dato bruto (antes de IRPF y cotizaciones) " +
      "y se publica con un desfase de aproximadamente un año respecto al periodo de referencia.",
    implications: [
      "El salario medio está muy influido por los sueldos más altos; el salario mediano (el que divide a los trabajadores en dos mitades iguales) suele ser más bajo y refleja mejor la realidad de la mayoría.",
      "Si tu salario sube menos que la inflación, estás perdiendo poder adquisitivo aunque la cifra en euros sea mayor.",
      "La brecha salarial de género persiste: el salario medio de las mujeres es sistemáticamente inferior al de los hombres para trabajos equivalentes.",
    ],
  },

  DEUDA_PUBLICA: {
    short:
      "Deuda total de las administraciones públicas españolas según el Protocolo de Déficit Excesivo, en millones de euros.",
    long:
      "La deuda pública incluye los pasivos financieros del Estado, las comunidades autónomas, las corporaciones " +
      "locales y la Seguridad Social. Los datos los publica el Banco de España siguiendo la metodología del " +
      "Protocolo de Déficit Excesivo (PDE) de la UE. Se suele expresar también como porcentaje del PIB.",
    implications: [
      "Cuanto mayor es la deuda respecto al PIB, más recursos públicos se dedican a pagar intereses en lugar de a servicios.",
      "Una deuda alta puede limitar la capacidad del gobierno para responder a crisis futuras sin subir impuestos o recortar gasto.",
      "El coste de la deuda depende de los tipos de interés: si suben, la factura de intereses crece aunque la deuda no aumente.",
    ],
  },

  IPC: {
    short:
      "Mide el nivel medio de precios de una cesta habitual de bienes y servicios comprados por los hogares en España.",
    long:
      "El IPC es un índice: no muestra euros, sino cómo han cambiado los precios respecto a una base. " +
      "Con base 2025 = 100, un IPC de 103,2 significa que la cesta media cuesta un 3,2 % más que en " +
      "la media de 2025. La cesta incluye productos y servicios como alimentos, vivienda, transporte, " +
      "vestido, ocio y otros gastos habituales de los hogares.",
    implications: [
      "Si tus ingresos suben menos que el IPC durante un periodo, pierdes poder de compra: con el mismo dinero puedes comprar menos.",
      "Sirve como referencia estadística para revisar salarios, pensiones, contratos y otros importes, aunque cada caso depende de su norma o contrato.",
      "En alquileres, el IPC puede influir, pero desde 2025 existe un índice específico del INE para la actualización de determinados contratos de vivienda.",
    ],
  },

  IPC_VAR_MENSUAL: {
    short:
      "Indica cuánto han subido o bajado los precios respecto al mes anterior.",
    long:
      "La variación mensual del IPC compara los precios de un mes con los del mes inmediatamente anterior. " +
      "Un dato de 0,4 % significa que, de media, los precios fueron un 0,4 % más altos que el mes previo; " +
      "un dato negativo indica una bajada mensual. Es un dato útil para detectar cambios recientes, pero " +
      "puede variar mucho por rebajas, energía, carburantes, alimentos frescos o temporadas turísticas.",
    implications: [
      "Ayuda a ver si una subida de precios es reciente o si viene acumulándose durante varios meses.",
      "Una bajada mensual no significa necesariamente que los precios sean más bajos que hace un año; para eso hay que mirar la variación anual.",
      "Si varios meses seguidos registran subidas, el aumento acumulado puede ser notable aunque cada dato mensual parezca pequeño.",
    ],
  },

  IPC_VAR_ANUAL: {
    short:
      "Indica cuánto han cambiado los precios respecto al mismo mes del año anterior; es la medida habitual de inflación.",
    long:
      "La variación anual del IPC compara los precios de un mes con los del mismo mes del año anterior. " +
      "Por ejemplo, una inflación anual del 3 % significa que la cesta media cuesta un 3 % más que doce " +
      "meses antes. Se usa mucho porque reduce el efecto de cambios estacionales, como rebajas, " +
      "vacaciones o campañas agrícolas.",
    implications: [
      "Si tu salario sube menos que la inflación anual, tu poder de compra baja respecto al año anterior.",
      "Muchas revisiones de pensiones, salarios o contratos miran datos de inflación, aunque la fórmula concreta depende de la norma o acuerdo aplicable.",
      "El BCE tiene como objetivo una inflación del 2 % a medio plazo en la zona euro; sus decisiones de tipos pueden afectar a hipotecas variables, préstamos y ahorro.",
    ],
  },

  IPC_ALIMENTOS: {
    short: "Índice de precios de alimentos y bebidas no alcohólicas: pan, carne, pescado, leche, fruta, verdura, aceites y bebidas no alcohólicas.",
    long: "Subgrupo COICOP que incluye los productos de alimentación y bebidas sin alcohol que consume un hogar medio. Es uno de los grupos con mayor peso en la cesta del IPC y suele ser volátil por factores estacionales, climáticos y de costes agrícolas.",
    implications: [
      "Los precios de alimentos frescos (frutas, verduras, pescado) varían mucho según la temporada y el clima.",
      "Es uno de los gastos más difíciles de sustituir: si suben, afecta directamente al presupuesto familiar.",
      "La cadena de distribución y el transporte influyen en el precio final de los alimentos.",
    ],
  },

  IPC_BEBIDAS_TABACO: {
    short: "Índice de precios de bebidas alcohólicas y tabaco: vino, cerveza, destilados y productos de tabaco.",
    long: "Subgrupo COICOP que mide la evolución de precios de bebidas con alcohol y productos de tabaco. Estos productos están sujetos a impuestos especiales (IEPS) que pueden cambiar con los presupuestos.",
    implications: [
      "Los impuestos especiales sobre alcohol y tabaco pueden subir sin aviso en los Presupuestos Generales del Estado.",
      "Es un gasto discrecional, pero para quienes lo consumen regularmente representa un peso constante en el presupuesto.",
    ],
  },

  IPC_VESTIDO: {
    short: "Índice de precios de vestido y calzado: prendas de vestir, calzado y accesorios.",
    long: "Subgrupo COICOP que cubre ropa, zapatos y complementos. Es muy sensible a campañas de rebajas y temporadas, por lo que la variación mensual puede oscilar fuertemente.",
    implications: [
      "Las rebajas de enero y julio hacen que este subgrupo tenga variaciones mensuales muy marcadas.",
      "Es un gasto posponible: muchos hogares pueden retrasar la compra de ropa si presupuestan ajustado.",
    ],
  },

  IPC_VIVIENDA: {
    short: "Índice de precios de vivienda, agua, electricidad, gas y otros combustibles: alquileres, suministros y combustibles para el hogar.",
    long: "Subgrupo COICOP que incluye alquileres reales (no hipotecas), gastos de comunidad, suministros (electricidad, gas, agua), combustibles para calefacción y otros servicios relacionados con la vivienda. Es uno de los grupos con mayor peso en la cesta.",
    implications: [
      "Los precios de electricidad y gas dependen del mercado mayorista y de las políticas regulatorias.",
      "Los alquileres varían según la ciudad y la zona, pero el IPC los mide a nivel nacional.",
      "Este grupo suele tener un impacto desproporcionado en el gasto de hogares con menos recursos.",
    ],
  },

  IPC_HOGAR: {
    short: "Índice de precios de muebles, artículos del hogar y mantenimiento corriente: mobiliario, electrodomésticos, utensilios y reparaciones.",
    long: "Subgrupo COICOP que cubre mobiliario, electrodomésticos, cristalería, utensilios de cocina, productos de limpieza y servicios de reparación para el hogar.",
    implications: [
      "Muchos de estos productos son de consumo duradero, por lo que las compras se pueden aplazar.",
      "La competencia entre grandes cadenas de distribución mantiene los precios relativamente estables.",
    ],
  },

  IPC_SANIDAD: {
    short: "Índice de precios de sanidad: medicamentos, productos farmacéuticos, servicios médicos y dentales.",
    long: "Subgrupo COICOP que incluye productos farmacéuticos, aparatos médicos, servicios médicos y dentales no cubiertos por la sanidad pública. Los medicamentos con receta están parcialmente subvencionados.",
    implications: [
      "El copago farmacéutico afecta directamente al bolsillo de quienes consumen medicamentos crónicos.",
      "Los servicios médicos privados (consultas, pruebas, dentistas) pueden subir más rápido que la inflación general.",
    ],
  },

  IPC_TRANSPORTE: {
    short: "Índice de precios de transporte: compra de vehículos, combustibles, transporte público, piezas y reparaciones.",
    long: "Subgrupo COICOP que mide la evolución de precios relacionados con el transporte: compra de coches y motos, carburantes, transporte público (autobús, tren, avión), seguros de vehículos y reparaciones.",
    implications: [
      "Los carburantes son muy volátiles y dependen del precio del petróleo y de los tipos de cambio.",
      "El transporte público puede congelarse o subir según decisiones de las administraciones.",
      "Para hogares que dependen del coche, este grupo tiene un impacto directo y difícil de sustituir.",
    ],
  },

  IPC_COMUNICACIONES: {
    short: "Índice de precios de información y comunicaciones: equipos telefónicos, servicios de internet, telefonía y correos.",
    long: "Subgrupo COICOP que incluye teléfonos móviles, ordenadores, servicios de telefonía fija y móvil, internet, televisiones de pago y servicios postales.",
    implications: [
      "La competencia entre operadoras de telecomunicaciones ha mantenido los precios estables o a la baja en los últimos años.",
      "Los contratos con permanencia pueden ocultar subidas en la cuota mensual.",
    ],
  },

  IPC_OCIO: {
    short: "Índice de precios de actividades recreativas, deporte y cultura: aparatos audiovisuales, eventos, periódicos, libros, viajes organizados.",
    long: "Subgrupo COICOP que cubre equipos de audio, foto, vídeo y ordenadores; eventos culturales y deportivos; suscripciones a periódicos y revistas; libros; viajes organizados; y mascotas.",
    implications: [
      "Es un gasto discrecional que suele ser el primero que se recorta cuando aprieta el presupuesto.",
      "Los precios de los viajes varían fuertemente según la temporada.",
    ],
  },

  IPC_ENSENANZA: {
    short: "Índice de precios de enseñanza: matrículas, material escolar, cursos y servicios educativos.",
    long: "Subgrupo COICOP que incluye matrículas de enseñanza reglada (guardería, primaria, secundaria, universidad), cursos no reglados, material escolar y otros servicios educativos.",
    implications: [
      "Las matrículas universitarias y los precios de guarderías varían según la comunidad autónoma.",
      "Es un gasto difícil de sustituir para familias con hijos en edad escolar.",
    ],
  },

  IPC_RESTAURANTES: {
    short: "Índice de precios de restaurantes y servicios de alojamiento: comidas fuera de casa, cafeterías, hoteles y albergues.",
    long: "Subgrupo COICOP que mide la evolución de precios de restaurantes, bares, cafeterías, comedores, caterings, hoteles, albergues y alquileres vacacionales.",
    implications: [
      "Los menús del día y las comidas fuera de casa son un gasto frecuente que puede acumularse rápidamente.",
      "El turismo influye fuertemente en los precios de hostelería en ciertas zonas y temporadas.",
    ],
  },

  IPC_SEGUROS: {
    short: "Índice de precios de seguros y servicios financieros: seguros de vida, hogar, vehículo y servicios bancarios.",
    long: "Subgrupo COICOP que incluye primas de seguros de vida, accidentes, salud, hogar, vehículo y viaje, así como ciertos servicios financieros.",
    implications: [
      "Las primas de seguros de hogar y vehículo suelen revisarse anualmente y pueden subir sin aviso previo.",
      "La competencia entre aseguradoras permite comparar y cambiar de compañía.",
    ],
  },

  IPC_DIVERSOS: {
    short: "Índice de precios de cuidado personal, protección social y bienes y servicios diversos: peluquería, joyería, funerarios y organizaciones.",
    long: "Subgrupo COICOP que agrupa servicios personales (peluquería, spas, gimnasios), joyería, relojería, productos de funeraria, y cuotas de sindicatos y organizaciones.",
    implications: [
      "Incluye gastos poco frecuentes pero que pueden ser significativos cuando ocurren (funerarias, joyería).",
      "Los gimnasios y spas son gastos discrecionales fácilmente posponibles.",
    ],
  },
}

/**
 * Returns the explanation for a given indicator code, or a fallback.
 */
export function getIndicatorExplanation(
  code: string,
): IndicatorExplanation {
  return (
    EXPLANATIONS[code] ?? {
      short: "",
      long: "",
      implications: [],
    }
  )
}

/**
 * Returns all known indicator codes. Used by content:audit to verify
 * that every code in the DB has a corresponding explanation entry.
 */
export function getExplanationCodes(): string[] {
  return Object.keys(EXPLANATIONS)
}
