import Link from "next/link"
import { BRAND_NAME, BRAND_URL, GITHUB_URL } from "@/lib/brand"

const SECTIONS: Array<{ heading: string; items: Array<{ label: string; href: string; external?: boolean }> }> = [
  {
    heading: "Personas",
    items: [
      { label: "Diputados", href: "/diputados" },
      { label: "Asistencia", href: "/asistencia" },
      { label: "Divergencias", href: "/divergencias" },
      { label: "Senado", href: "/senado" },
      { label: "Gobierno", href: "/gobierno" },
      { label: "Partidos", href: "/partidos" },
      { label: "Votaciones", href: "/votaciones" },
      { label: "Puertas giratorias", href: "/puertas-giratorias" },
    ],
  },
  {
    heading: "Dinero",
    items: [
      { label: "Trazabilidad del gasto", href: "/dinero-publico" },
      { label: "Presupuestos", href: "/presupuestos" },
      { label: "Contratos", href: "/contratos" },
      { label: "Subvenciones", href: "/subvenciones" },
      { label: "Fondos UE", href: "/fondos-ue" },
      { label: "Organizaciones", href: "/organizaciones" },
    ],
  },
  {
    heading: "Territorio",
    items: [
      { label: "Mapa", href: "/territorio" },
      { label: "Tu zona", href: "/territorio/tu-zona" },
    ],
  },
  {
    heading: "Economía",
    items: [
      { label: "Series", href: "/indicadores" },
      { label: "Calculadoras", href: "/calculadoras" },
    ],
  },
  {
    heading: "El portal",
    items: [
      { label: "Estado de datos", href: "/estado-datos" },
      { label: "Buscar", href: "/buscar" },
      { label: "Código en GitHub", href: GITHUB_URL, external: true },
    ],
  },
]

const SOURCE_LINE =
  "Datos: Congreso de los Diputados, Senado, BOE, BDNS, PCSP, INE, Kohesio."

export function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="mt-12 border-t border-border bg-card/40">
      <div className="ui-shell py-8 sm:py-10">
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-2 lg:grid-cols-5 sm:gap-8">
          {SECTIONS.map((section) => (
            <nav key={section.heading} aria-label={section.heading} className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {section.heading}
              </p>
              <ul className="space-y-0">
                {section.items.map((item) => (
                  <li key={item.href}>
                    {item.external ? (
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block py-1.5 text-sm underline-offset-2 hover:underline"
                      >
                        {item.label}
                      </a>
                    ) : (
                      <Link
                        href={item.href}
                        className="block py-1.5 text-sm underline-offset-2 hover:underline"
                      >
                        {item.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-8 space-y-2 border-t border-border/60 pt-6 text-xs text-muted-foreground">
          <p className="leading-relaxed">{SOURCE_LINE}</p>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link href="/" className="font-medium text-foreground underline-offset-2 hover:underline">
              {BRAND_NAME}
            </Link>
            <span aria-hidden>·</span>
            <span className="font-mono tabular-nums">{year}</span>
            <span aria-hidden>·</span>
            <span>Datos públicos. Sin afiliación política.</span>
            <span aria-hidden>·</span>
            <a
              href={BRAND_URL}
              className="font-mono underline-offset-2 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              spaintransparencia.info
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}
