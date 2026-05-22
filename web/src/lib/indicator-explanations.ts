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
