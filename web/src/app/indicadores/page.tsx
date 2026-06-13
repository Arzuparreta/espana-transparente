import type { Metadata } from "next"

import { PageHeader } from "@/components/domain/PageHeader"
import { SectionViewNav } from "@/components/navigation/SectionViewNav"
import { IndicatorsView } from "@/components/views/IndicatorsView"

export const revalidate = 3600

const META = {
  title: "Series económicas",
  description:
    "IPC general anual, salario real y deuda pública primero; el resto de series oficiales con su último dato y evolución histórica.",
}

export const metadata: Metadata = {
  ...META,
  alternates: {
    canonical: "/indicadores",
  },
}

export default function IndicadoresPage() {
  return (
    <div className="ui-page-wide space-y-6 sm:space-y-8">
      <PageHeader {...META} />
      <SectionViewNav
        label="Vistas de economía"
        active="series"
        items={[
          { value: "resumen", label: "Explorar", href: "/economia" },
          { value: "series", label: "Series", href: "/indicadores" },
          { value: "calculadoras", label: "Calculadoras", href: "/calculadoras" },
        ]}
      />
      <IndicatorsView />
    </div>
  )
}
