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
            label="Territorios autonómicos"
            value={autonomic.territories.length.toLocaleString("es-ES")}
            description={`${autonomicRecords.toLocaleString("es-ES")} registros autonómicos con contratos o subvenciones.`}
            href="/ccaa"
            linkLabel="Ver CCAA →"
          />
          <ThreadAnchorCard
            label="Territorios locales"
            value={municipal.territories.length.toLocaleString("es-ES")}
            description={`${municipalRecords.toLocaleString("es-ES")} registros municipales o locales publicados por fuente.`}
            href="/municipios"
            linkLabel="Ver municipios →"
          />
        </>
      }
    />
  )
}
