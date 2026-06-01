import { ThreadAnchorCard, ThreadLanding } from "@/components/domain/ThreadLanding"
import {
  getGobiernoActual,
  getInitiativesPage,
  getRevolvingDoorCases,
  getSectionIndex,
} from "@/lib/data"
import { getThread } from "@/lib/thread-config"

export const revalidate = 3600

export const metadata = {
  title: "Personas",
  description:
    "Cargos públicos, sus decisiones y su conducta: gobierno, cámaras, partidos, votaciones, declaraciones y procesos.",
}

export default async function PersonasThreadPage() {
  const [sectionIndex, gobierno, initiatives, revolvingDoors] = await Promise.all([
    getSectionIndex(),
    getGobiernoActual(),
    getInitiativesPage(1),
    getRevolvingDoorCases(),
  ])
  const ministers = gobierno.filter((member) => member.position_type === "ministro").length

  return (
    <ThreadLanding
      thread={getThread("personas")}
      sectionIndex={sectionIndex}
      anchors={[
        <ThreadAnchorCard
          key="gobierno"
          label="Gobierno actual"
          value={gobierno.length.toLocaleString("es-ES")}
          description={`${ministers.toLocaleString("es-ES")} ministerios con persona responsable enlazada.`}
          href="/gobierno"
          linkLabel="Ver Gobierno →"
        />,
        <ThreadAnchorCard
          key="iniciativas"
          label="Iniciativas parlamentarias"
          value={initiatives.total.toLocaleString("es-ES")}
          description="Proyectos, proposiciones y mociones publicados por el Congreso."
          href="/iniciativas"
          linkLabel="Ver iniciativas →"
        />,
        <ThreadAnchorCard
          key="puertas"
          label="Puertas giratorias"
          value={revolvingDoors.length.toLocaleString("es-ES")}
          description="Casos publicados con fuente primaria o revisión documental."
          href="/puertas-giratorias"
          linkLabel="Ver casos →"
        />,
      ]}
    />
  )
}
