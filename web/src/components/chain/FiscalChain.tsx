import Link from "next/link"
import { getFiscalAccounts } from "@/lib/data/fiscal"
import {
  FISCAL_SERIES,
  selectFiscalRange,
  fiscalNumber,
  type FiscalCode,
} from "@/lib/fiscal"
import { FiscalChart } from "./FiscalChart"
import { SourceFootnote } from "@/components/domain/SourceFootnote"
const CHAPTERS: {
  id: string
  title: string
  description: string
  codes: FiscalCode[]
  href: string
  link: string
}[] = [
  {
    id: "ingresos-gasto",
    title: "1. Cuánto se gasta y cuánto ingresa",
    description:
      "El gasto realizado y los ingresos se miden con el mismo criterio de contabilidad nacional. Los créditos presupuestados autorizan gasto; no son su ejecución.",
    codes: ["GASTO_PUBLICO", "INGRESOS_PUBLICOS"],
    href: "/presupuestos",
    link: "Consultar los presupuestos aprobados (otra magnitud)",
  },
  {
    id: "saldo",
    title: "2. La diferencia: déficit o superávit",
    description:
      "Ingresos menos gasto: un saldo negativo es déficit; uno positivo, superávit. El déficit necesita financiación.",
    codes: ["SALDO_PUBLICO"],
    href: "/indicadores/SALDO_PUBLICO",
    link: "Explorar la serie del saldo público",
  },
  {
    id: "deuda",
    title: "3. La deuda que se acumula",
    description:
      "La deuda es un saldo a cierre de año. Su variación no equivale exactamente al déficit: también intervienen operaciones financieras y ajustes de valoración. No es una factura personal de cada habitante.",
    codes: ["DEUDA_PUBLICA"],
    href: "/indicadores/DEUDA_PUBLICA",
    link: "Explorar la deuda pública",
  },
  {
    id: "financiacion",
    title: "4. Quién financia el coste",
    description:
      "Los intereses son gasto público. Impuestos y cotizaciones son parte de los ingresos que financian el conjunto de gastos: no existe aquí una asignación de cada impuesto al pago de intereses ni un cálculo de tu carga individual.",
    codes: ["INTERESES_PUBLICOS"],
    href: "/indicadores/INTERESES_PUBLICOS",
    link: "Explorar el coste de los intereses",
  },
]
export async function FiscalChain({
  from,
  to,
  action = "/",
}: {
  from?: string
  to?: string
  action?: string
}) {
  const accounts = await getFiscalAccounts()
  const range = selectFiscalRange(accounts.years, from, to)
  const latest = range.years.at(-1)
  return (
    <section aria-labelledby="cadena-title" className="space-y-8">
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Gasto → déficit → deuda → quién paga
        </p>
        <h2
          id="cadena-title"
          className="font-display text-3xl font-bold sm:text-5xl"
        >
          Las decisiones de gasto tienen un coste.
        </h2>
        <p className="max-w-3xl text-muted-foreground">
          Sigue las cuentas públicas, comprueba sus fuentes y explora las
          personas y operaciones documentadas detrás de los datos.
        </p>
      </div>
      {accounts.error ? (
        <p role="alert">
          No se han podido consultar las cuentas públicas. Puedes seguir
          explorando las demás colecciones.
        </p>
      ) : !latest ? (
        <p role="status">
          Las series fiscales comparables todavía no están disponibles. No se
          sustituyen por presupuestos aprobados ni por estimaciones.
        </p>
      ) : (
        <>
          <form action={action} className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              Desde
              <select
                name="desde"
                defaultValue={range.from}
                className="ml-2 rounded border border-border bg-background p-2"
              >
                {accounts.years.map((y) => (
                  <option key={y.year}>{y.year}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Hasta
              <select
                name="hasta"
                defaultValue={range.to}
                className="ml-2 rounded border border-border bg-background p-2"
              >
                {accounts.years.map((y) => (
                  <option key={y.year}>{y.year}</option>
                ))}
              </select>
            </label>
            <button className="rounded border border-border px-3 py-2 text-sm">
              Actualizar periodo
            </button>
            <Link
              className="py-2 text-sm underline"
              href={`${action}?desde=${range.from}&hasta=${range.to}`}
            >
              Enlace a este periodo
            </Link>
          </form>
          {CHAPTERS.map((chapter) => (
            <article
              id={chapter.id}
              key={chapter.id}
              className="scroll-mt-20 space-y-4 border-t border-border pt-6"
            >
              <h3 className="text-2xl font-semibold">{chapter.title}</h3>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                {chapter.description}
              </p>
              <FiscalChart
                title={chapter.title}
                years={range.years}
                codes={chapter.codes}
                lastChecked={accounts.lastChecked}
              />
              <Link
                href={chapter.href}
                className="inline-block text-sm underline underline-offset-4"
              >
                {chapter.link} →
              </Link>
              <div className="flex flex-wrap gap-3 text-sm">
                {chapter.codes
                  .filter((code) => chapter.href !== `/indicadores/${code}`)
                  .map((code) => (
                    <Link
                      key={code}
                      href={`/indicadores/${code}`}
                      className="underline underline-offset-4"
                    >
                      Serie: {FISCAL_SERIES[code]} →
                    </Link>
                  ))}
              </div>
              {chapter.id === "financiacion" && (
                <div className="space-y-3">
                  <FiscalChart
                    title="Impuestos y cotizaciones: parte de los ingresos públicos"
                    years={range.years}
                    codes={["IMPUESTOS_PUBLICOS", "COTIZACIONES_SOCIALES"]}
                    lastChecked={accounts.lastChecked}
                  />
                  <p className="text-sm text-muted-foreground">
                    En {latest.year}:{" "}
                    {fiscalNumber(latest.values.IMPUESTOS_PUBLICOS)} millones de
                    euros en impuestos antes del ajuste por incobrables;{" "}
                    {fiscalNumber(latest.values.COTIZACIONES_SOCIALES)} millones
                    en cotizaciones netas, incluidas las imputadas. No equivalen
                    a cobros de caja ni suman todos los ingresos.
                  </p>
                  <Link href="/calculadoras" className="inline-block underline">
                    Cómo cambia tu poder adquisitivo →
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    La inflación se explora por separado. La política monetaria
                    corresponde al BCE; estos gráficos no atribuyen la inflación
                    española a la deuda española.
                  </p>
                </div>
              )}
            </article>
          ))}
        </>
      )}
      <SourceFootnote
        sourceLabel="Eurostat · cuentas de las administraciones públicas"
        sourceHref="https://ec.europa.eu/eurostat/cache/metadata/en/gov_10a_main_esms.htm"
        lastChecked={accounts.lastChecked}
      />
    </section>
  )
}
