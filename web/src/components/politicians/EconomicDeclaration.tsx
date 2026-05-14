import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { EconomicDeclaration } from "@/types"

const TYPE_LABELS: Record<string, string> = {
  bienes_rentas: "Declaraciones de bienes y rentas",
  intereses_economicos: "Declaraciones de intereses económicos",
}

const TYPE_FALLBACK = "Declaraciones"

interface Props {
  declarations: EconomicDeclaration[]
}

function formatDate(value: string | undefined) {
  if (!value) return null
  return new Date(`${value}T00:00:00`).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function getType(declaration: EconomicDeclaration): string {
  const raw = declaration.raw_data as { type?: string } | undefined
  return raw?.type || "otros"
}

function sourceHost(url: string | undefined) {
  if (!url) return null
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}

export function EconomicDeclarationList({ declarations }: Props) {
  if (declarations.length === 0) {
    return (
      <Card className="bg-card/80">
        <CardContent className="p-4 sm:p-6">
          <p className="text-sm text-muted-foreground">
            No consta declaración publicada en este momento.
          </p>
        </CardContent>
      </Card>
    )
  }

  const grouped = new Map<string, EconomicDeclaration[]>()
  for (const declaration of declarations) {
    const type = getType(declaration)
    const list = grouped.get(type) ?? []
    list.push(declaration)
    grouped.set(type, list)
  }

  Array.from(grouped.values()).forEach((list) =>
    list.sort((a, b) =>
      (b.declaration_date || "").localeCompare(a.declaration_date || ""),
    ),
  )

  const known = ["bienes_rentas", "intereses_economicos"]
  const orderedKeys = [
    ...known.filter((k) => grouped.has(k)),
    ...Array.from(grouped.keys()).filter((k) => !known.includes(k)),
  ]

  return (
    <div className="space-y-4">
      {orderedKeys.map((type) => (
        <Card key={type} className="bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">
              {TYPE_LABELS[type] || TYPE_FALLBACK}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="space-y-2 text-sm">
              {grouped.get(type)!.map((declaration) => {
                const date = formatDate(declaration.declaration_date)
                const host = sourceHost(declaration.source_url)
                return (
                  <li
                    key={declaration.id}
                    className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1"
                  >
                    <span className="text-foreground">
                      {date || "Sin fecha"}
                    </span>
                    {declaration.source_url ? (
                      <a
                        href={declaration.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                      >
                        Documento oficial{host ? ` · ${host}` : ""}
                      </a>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
