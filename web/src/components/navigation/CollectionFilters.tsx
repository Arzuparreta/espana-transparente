"use client"
import { useSearchParams } from "next/navigation"
import { collectionHref } from "@/lib/exploration"
import { ResponsiveLink } from "./NavigationProgress"
const LABELS: Record<string, string> = {
  ministry: "Ministerio",
  level: "Administración",
  year: "Año",
  province: "Provincia",
  municipio: "Municipio",
  territory: "Comunidad",
  organization: "Organización",
  role: "Relación",
  flow: "Ámbito territorial",
}
export function CollectionFilters({
  path,
  organizationLabel,
  territoryLabels = {},
}: {
  path: string
  organizationLabel?: string | null
  territoryLabels?: Record<string, string>
}) {
  const params = useSearchParams()
  return (
    <div className="space-y-3">
      <form action={path} className="flex flex-wrap items-end gap-3">
        {Array.from(params.entries())
          .filter(([key]) => !["page", "year", "level"].includes(key))
          .map(([key, value]) => (
            <input key={key} type="hidden" name={key} value={value} />
          ))}
        <label className="text-sm">
          Año
          <input
            key={params.get("year")}
            name="year"
            type="number"
            min="1900"
            max="2100"
            defaultValue={params.get("year") ?? ""}
            placeholder="Todos"
            className="mt-1 block w-28 rounded border border-border bg-background p-2"
          />
        </label>
        {path === "/contratos" && (
          <label className="text-sm">
            Administración
            <select
              key={params.get("level")}
              name="level"
              defaultValue={params.get("level") ?? ""}
              className="mt-1 block rounded border border-border bg-background p-2"
            >
              <option value="">Todas</option>
              <option value="state">Estatal</option>
              <option value="autonomic">Autonómica</option>
              <option value="municipal">Municipal</option>
            </select>
          </label>
        )}
        <button className="rounded border border-border px-3 py-2 text-sm">
          Aplicar filtros
        </button>
        <ResponsiveLink href={path} className="px-2 py-2 text-sm underline">
          Quitar filtros
        </ResponsiveLink>
        <ResponsiveLink
          href="/territorio/tu-zona"
          className="px-2 py-2 text-sm underline"
        >
          Explorar por territorio
        </ResponsiveLink>
      </form>
      <div
        className="flex flex-wrap gap-2"
        aria-label="Contexto de la consulta"
      >
        {Object.entries(LABELS)
          .filter(([key]) => Boolean(params.get(key)))
          .map(([key, label]) => (
            <ResponsiveLink
              key={key}
              href={collectionHref(path, params.toString(), {
                [key]: null,
                page: 1,
              })}
              className="rounded border border-border px-2 py-1 text-xs"
              aria-label={`Quitar ${label}`}
            >
              {label}:{" "}
              {key === "organization"
                ? (organizationLabel ?? "Entidad seleccionada")
                : key === "level"
                  ? ({
                      state: "Estatal",
                      autonomic: "Autonómica",
                      municipal: "Municipal",
                    }[params.get(key) ?? ""] ?? params.get(key))
                  : key === "flow"
                    ? params.get(key) === "to"
                      ? "domicilio del receptor"
                      : "órgano concedente"
                    : key === "role"
                      ? params.get(key) === "awarding"
                        ? "órgano contratante"
                        : params.get(key) === "recipient"
                          ? "receptor"
                          : "ambas partes"
                      : (
                          territoryLabels[params.get(key) ?? ""] ??
                          params.get(key) ??
                          ""
                        ).replaceAll("_", " ")}{" "}
              ×
            </ResponsiveLink>
          ))}
      </div>
      {params.get("flow") === "to" && (
        <p className="text-xs text-muted-foreground">
          El domicilio del receptor no identifica necesariamente el lugar de
          ejecución. Solo se incluyen registros con localización disponible.
        </p>
      )}
    </div>
  )
}
