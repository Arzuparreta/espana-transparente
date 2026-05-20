import Link from "next/link"
import { BRAND_NAME, BRAND_URL, GITHUB_URL } from "@/lib/brand"

const SECTIONS: Array<{ heading: string; items: Array<{ label: string; href: string; external?: boolean }> }> = [
  {
    heading: "Personas",
    items: [
      { label: "Diputados", href: "/diputados" },
      { label: "Senado", href: "/senado" },
      { label: "Gobierno", href: "/gobierno" },
      { label: "Partidos", href: "/partidos" },
      { label: "Instituciones", href: "/instituciones" },
    ],
  },
  {
    heading: "Dinero y leyes",
    items: [
      { label: "Votaciones", href: "/votaciones" },
      { label: "Presupuestos", href: "/presupuestos" },
      { label: "Contratos", href: "/contratos" },
      { label: "Subvenciones", href: "/subvenciones" },
      { label: "Fondos UE", href: "/fondos-ue" },
    ],
  },
  {
    heading: "Conexiones",
    items: [
      { label: "Puertas giratorias", href: "/puertas-giratorias" },
      { label: "Organizaciones", href: "/organizaciones" },
      { label: "Indicadores", href: "/indicadores" },
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
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4 sm:gap-8">
          {SECTIONS.map((section) => (
            <div key={section.heading} className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {section.heading}
              </h2>
              <ul className="space-y-1.5">
                {section.items.map((item) => (
                  <li key={item.href}>
                    {item.external ? (
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm underline-offset-2 hover:underline"
                      >
                        {item.label}
                      </a>
                    ) : (
                      <Link
                        href={item.href}
                        className="text-sm underline-offset-2 hover:underline"
                      >
                        {item.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
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
              españatransparente.site
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}
