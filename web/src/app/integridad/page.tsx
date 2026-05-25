import { ThreadAnchorCard, ThreadLanding } from "@/components/domain/ThreadLanding"
import {
  getInstitucionesActuales,
  getJudicialCasesPage,
  getRevolvingDoorCases,
  getSectionIndex,
} from "@/lib/data"
import { getThread } from "@/lib/thread-config"

export const revalidate = 3600

export const metadata = {
  title: "Integridad",
  description: "Declaraciones económicas, puertas giratorias, procesos judiciales y nombramientos institucionales.",
}

export default async function IntegridadThreadPage() {
  const [sectionIndex, judicial, revolvingDoors, institutions] = await Promise.all([
    getSectionIndex(),
    getJudicialCasesPage(1),
    getRevolvingDoorCases(),
    getInstitucionesActuales(),
  ])
  const institutionCount = institutions.length
  const revolvingDoorCount = revolvingDoors.length

  return (
    <ThreadLanding
      thread={getThread("integridad")}
      sectionIndex={sectionIndex}
      anchors={
        <>
          <ThreadAnchorCard
            label="Procesos judiciales"
            value={judicial.total.toLocaleString("es-ES")}
            description="Casos publicados por fuentes judiciales o registros públicos revisados."
            href="/corrupcion"
            linkLabel="Ver procesos →"
          />
          <ThreadAnchorCard
            label="Puertas giratorias"
            value={revolvingDoorCount.toLocaleString("es-ES")}
            description="Casos publicados con fuente primaria o revisión documental."
            href="/puertas-giratorias"
            linkLabel="Ver casos →"
          />
          <ThreadAnchorCard
            label="Nombramientos institucionales"
            value={institutionCount.toLocaleString("es-ES")}
            description="Cargos en TC, CGPJ, RTVE y SEPI con persona y fuente asociada."
            href="/instituciones"
            linkLabel="Ver instituciones →"
          />
        </>
      }
    />
  )
}
