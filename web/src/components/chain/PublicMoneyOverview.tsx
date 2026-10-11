import Link from "next/link"
import { SourceFootnote } from "@/components/domain/SourceFootnote"
import {
  fiscalNumber,
  fiscalYearSummary,
  selectFiscalYear,
  type FiscalYear,
} from "@/lib/fiscal"

interface Props {
  accounts: { years: FiscalYear[]; lastChecked: string | null; error: boolean }
  year?: string | string[]
}

const SOURCE_HREF =
  "https://ec.europa.eu/eurostat/databrowser/view/gov_10a_main/default/table?lang=es"

export function PublicMoneyOverview({ accounts, year }: Props) {
  const { selected, unavailable } = selectFiscalYear(accounts.years, year)
  const summary = selected ? fiscalYearSummary(selected) : null
  const periodHref = selected
    ? `/cuentas-publicas?desde=${selected.year}&hasta=${selected.year}`
    : "/cuentas-publicas"
  const titles = {
    deficit: "Se gastó más de lo que se ingresó.",
    surplus: "Los ingresos superaron al gasto.",
    balanced: "Los ingresos y el gasto estuvieron equilibrados.",
  }
  const balanceLabels = {
    deficit: "Déficit",
    surplus: "Superávit",
    balanced: "Saldo en equilibrio",
  }

  return (
    <div className="space-y-8">
      <section
        aria-labelledby="balance-anual-title"
        className="space-y-5 rounded border border-border bg-card p-4 sm:p-6"
      >
        <div className="space-y-2">
          <h2 id="balance-anual-title" className="text-xl font-semibold">
            ¿Cuánto se ingresó y cuánto se gastó?
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            España · todas las administraciones públicas · cuentas consolidadas
            (S13).{" "}
            <a
              href={SOURCE_HREF}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4"
            >
              Fuente: Eurostat
            </a>
            .
          </p>
        </div>
        {accounts.error ? (
          <p role="alert">
            No se han podido consultar las cuentas públicas. Puedes seguir
            explorando las colecciones de abajo.
          </p>
        ) : !selected || !summary ? (
          <p role="status">
            Todavía no hay un año completo de cuentas comparables. No se
            sustituye por presupuestos ni por una suma de contratos.
          </p>
        ) : (
          <>
            <form action="/dinero" className="flex flex-wrap items-end gap-3">
              <label htmlFor="dinero-year" className="text-sm">
                Año de las cuentas
                <select
                  id="dinero-year"
                  name="year"
                  defaultValue={selected.year}
                  className="ml-2 rounded border border-border bg-background p-2"
                >
                  {accounts.years.map((row) => (
                    <option key={row.year} value={row.year}>
                      {row.year}
                    </option>
                  ))}
                </select>
              </label>
              <button className="rounded border border-border px-3 py-2 text-sm">
                Ver año
              </button>
              <Link
                href={`/dinero?year=${selected.year}`}
                className="py-2 text-sm underline underline-offset-4"
              >
                Enlace a este año →
              </Link>
            </form>
            {unavailable && (
              <p role="status" className="text-sm">
                El año solicitado no está disponible. Se muestran las últimas
                cuentas completas: {selected.year}.
              </p>
            )}
            <p className="text-sm font-medium">
              Ejercicio {selected.year}
              {selected.provisional
                ? " · Datos provisionales, sujetos a revisión"
                : ""}
            </p>
            <div className="space-y-3">
              <h3 className="font-display text-3xl font-bold sm:text-4xl">
                {titles[summary.status]}
              </h3>
              <p className="max-w-3xl leading-7">
                {summary.status === "deficit" ? (
                  <>
                    La diferencia fue de{" "}
                    {fiscalNumber(Math.abs(summary.balance))} millones de euros
                    de déficit. Ese déficit necesita financiación; no equivale
                    exactamente al aumento de deuda.
                  </>
                ) : summary.status === "surplus" ? (
                  <>
                    Los ingresos superaron al gasto en{" "}
                    {fiscalNumber(summary.balance)} millones de euros: hubo
                    superávit. Esto no implica que la deuda disminuyera en la
                    misma cantidad.
                  </>
                ) : (
                  <>
                    El saldo fue cero: los ingresos igualaron al gasto. Esto no
                    implica que no hubiera deuda ni intereses.
                  </>
                )}
              </p>
              <p className="text-sm leading-6 text-muted-foreground">
                {summary.spendingPer100Income === null ? (
                  "No se calcula gasto por cada 100 € ingresados porque los ingresos no son positivos."
                ) : (
                  <>
                    Por cada 100 € de ingresos públicos se gastaron
                    aproximadamente{" "}
                    <strong className="text-foreground">
                      {fiscalNumber(summary.spendingPer100Income)} €
                    </strong>
                    . Comparación del mismo año y ámbito: gasto ÷ ingresos ×
                    100.
                  </>
                )}
              </p>
            </div>
            <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: "Ingresos",
                  value: summary.income,
                  note: "Total de ingresos, no solo impuestos.",
                  href: "/indicadores/INGRESOS_PUBLICOS",
                },
                {
                  label: "Gasto realizado",
                  value: summary.spending,
                  note: "Contabilidad nacional; no es el presupuesto autorizado ni una suma de pagos de caja.",
                  href: "/indicadores/GASTO_PUBLICO",
                },
                {
                  label: balanceLabels[summary.status],
                  value: Math.abs(summary.balance),
                  note: "Ingresos menos gasto; déficit si el saldo es negativo.",
                  href: "/indicadores/SALDO_PUBLICO",
                },
                {
                  label: "Intereses de la deuda",
                  value: summary.interest,
                  note: "Ya incluidos en el gasto total; no se suman otra vez.",
                  href: "/indicadores/INTERESES_PUBLICOS",
                },
              ].map((metric) => (
                <div
                  key={metric.href}
                  className="min-w-0 space-y-2 border-t border-border pt-3"
                >
                  <dt className="text-sm font-semibold">{metric.label}</dt>
                  <dd className="space-y-2">
                    <p className="font-mono text-2xl tabular-nums">
                      {fiscalNumber(metric.value)}
                      <span className="block text-xs text-muted-foreground">
                        millones de euros · {selected.year}
                      </span>
                    </p>
                    <p className="text-xs leading-5 text-muted-foreground">
                      {metric.note}
                    </p>
                    <Link
                      href={metric.href}
                      className="inline-block text-xs underline underline-offset-4"
                    >
                      Ver serie y fuente →
                    </Link>
                  </dd>
                </div>
              ))}
            </dl>
          </>
        )}
        <p className="text-xs leading-5 text-muted-foreground">
          El ámbito incluye administración central, comunidades autónomas,
          entidades locales y Seguridad Social. Contabilidad nacional, en euros
          corrientes; no equivale a cobros y pagos de caja.
        </p>
        <SourceFootnote
          sourceLabel="Eurostat · gov_10a_main · ES · S13 · MIO_EUR"
          sourceHref={SOURCE_HREF}
          lastChecked={accounts.lastChecked}
        />
        <Link
          href={periodHref}
          className="inline-block text-sm underline underline-offset-4"
        >
          Seguir la cadena: gasto → déficit → deuda → quién paga →
        </Link>
      </section>

      <section aria-labelledby="destinos-title" className="space-y-4">
        <h2 id="destinos-title" className="text-xl font-semibold">
          ¿Y a qué se destina el dinero?
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <article className="space-y-3 rounded border border-border p-4">
            <h3 className="font-semibold">En qué se gastó</h3>
            <p className="text-sm leading-6 text-muted-foreground">
              El reparto COFOG permite consultar funciones como salud, educación
              y protección social para los ejercicios completos disponibles. La
              cobertura puede diferir del resumen anual. El desglose por
              administración sigue pendiente; los contratos y ayudas no cubren
              todo ese gasto.
            </p>
            <Link
              href={
                selected
                  ? `/gasto-por-funciones?year=${selected.year}`
                  : "/gasto-por-funciones"
              }
              className="inline-block text-sm underline underline-offset-4"
            >
              Consultar el gasto realizado por funciones →
            </Link>
          </article>
          <article className="space-y-3 rounded border border-border p-4">
            <h3 className="font-semibold">Para qué se autorizó gasto</h3>
            <p className="text-sm leading-6 text-muted-foreground">
              Los Presupuestos Generales del Estado muestran créditos por
              programas y su propio ámbito. Autorización no equivale a ejecución
              ni a pago; tampoco abarca los presupuestos de todas las
              administraciones.
            </p>
            <Link
              href="/presupuestos"
              className="inline-block text-sm underline underline-offset-4"
            >
              Ver prioridades presupuestadas →
            </Link>
          </article>
        </div>
        <p className="text-sm leading-6 text-muted-foreground">
          Para saber qué llegó a tu comunidad aún falta conectar ejecución,
          financiación territorial y destinos acreditados. La ubicación de un
          beneficiario por sí sola no demuestra dónde se utilizó el dinero.
        </p>
      </section>
    </div>
  )
}
