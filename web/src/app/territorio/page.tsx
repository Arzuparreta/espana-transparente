import { ThreadAnchorCard, ThreadLanding } from "@/components/domain/ThreadLanding"
import { getSectionIndex } from "@/lib/data"
import { getAutonomicLanding, getMunicipalLanding } from "@/lib/data/multilevel"
import { getThread } from "@/lib/thread-config"

export const revalidate = 3600

export const metadata = {
  title: "Territorio",
  description: "Gasto autonómico y municipal por territorio.",
}

export default async function TerritorioThreadPage() {
  const [sectionIndex, autonomic, municipal] = await Promise.all([
    getSectionIndex(),
    getAutonomicLanding(),
    getMunicipalLanding(),
  ])
  const autonomicRecords = autonomic.summary.subsidyCount + autonomic.summary.contractCount
  const municipalRecords = municipal.summary.subsidyCount + municipal.summary.contractCount

  return (
    <ThreadLanding
      thread={getThread("territorio")}
      sectionIndex={sectionIndex}
      anchors={
        <>
          <ThreadAnchorCard
            label="Registros autonómicos"
            value={autonomicRecords.toLocaleString("es-ES")}
            description={`${autonomic.territories.length.toLocaleString("es-ES")} territorios autonómicos con contratos o subvenciones publicados.`}
            href="/ccaa"
            linkLabel="Ver CCAA →"
          />
          <ThreadAnchorCard
            label="Registros locales"
            value={municipalRecords.toLocaleString("es-ES")}
            description={`${municipal.territories.length.toLocaleString("es-ES")} entidades locales con gasto publicado por fuente.`}
            href="/municipios"
            linkLabel="Ver municipios →"
          />
        </>
      }
    />
  )
}
