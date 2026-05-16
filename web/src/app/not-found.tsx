import Link from "next/link"
import type { Metadata } from "next"
import { buttonVariants } from "@/components/ui/button"
import { PageHeader } from "@/components/domain/PageHeader"

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
      <div className="rounded-xl border border-border/80 bg-card/80 px-4 py-5 shadow-sm sm:px-6 sm:py-6">
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/" className={buttonVariants({ variant: "default" })}>
            Volver al inicio
          </Link>
          <Link href="/buscar" className={buttonVariants({ variant: "outline" })}>
            Buscar
          </Link>
        </div>
      </div>
    </div>
  )
}
