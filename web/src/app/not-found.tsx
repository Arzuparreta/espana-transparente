import type { Metadata } from "next"
import { buttonVariants } from "@/components/ui/button"
import { PageHeader } from "@/components/domain/PageHeader"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"

export const metadata: Metadata = {
  title: "Página no encontrada",
}

export default function NotFound() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Página no encontrada"
        description="La ruta solicitada no existe o se movió. Desde el inicio puedes navegar a diputados, votaciones, contratos, subvenciones y el resto de áreas del portal."
      />
      <div className="rounded-[2px] border border-border bg-card px-4 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-wrap items-center gap-3">
          <ResponsiveLink href="/" className={buttonVariants({ variant: "default" })}>
            Volver al inicio
          </ResponsiveLink>
          <ResponsiveLink href="/buscar" className={buttonVariants({ variant: "outline" })}>
            Buscar
          </ResponsiveLink>
        </div>
      </div>
    </div>
  )
}
