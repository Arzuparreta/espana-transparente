import { ThreadAnchorCard, ThreadLanding } from "@/components/domain/ThreadLanding"
import {
  getGobiernoActual,
  getInitiativesPage,
  getSectionIndex,
  getSenatorStats,
} from "@/lib/data"
import { getThread } from "@/lib/thread-config"

export const revalidate = 3600

export const metadata = {
  title: "Poder",
  description: "Gobierno, cámaras, partidos, votaciones e iniciativas legislativas.",
}

export default async function PoderThreadPage() {
  const [sectionIndex, gobierno, senators, initiatives] = await Promise.all([
    getSectionIndex(),
    getGobiernoActual(),
    getSenatorStats(),
    getInitiativesPage(1),
  ])
  const ministers = gobierno.filter((member) => member.position_type === "ministro").length

  return (
    <ThreadLanding
      thread={getThread("poder")}
      sectionIndex={sectionIndex}
      anchors={
        <>
          <ThreadAnchorCard
            label="Gobierno actual"
            value={gobierno.length.toLocaleString("es-ES")}
            description={`${ministers.toLocaleString("es-ES")} ministerios con persona responsable enlazada.`}
            href="/gobierno"
            linkLabel="Ver Gobierno →"
          />
          <ThreadAnchorCard
            label="Senado"
            value={senators.total.toLocaleString("es-ES")}
            description={`${senators.byType.elected.toLocaleString("es-ES")} electos · ${senators.byType.designated.toLocaleString("es-ES")} designados.`}
            href="/senado"
            linkLabel="Ver Senado →"
          />
          <ThreadAnchorCard
            label="Iniciativas parlamentarias"
            value={initiatives.total.toLocaleString("es-ES")}
            description="Proyectos, proposiciones y mociones publicados por el Congreso."
            href="/iniciativas"
            linkLabel="Ver iniciativas →"
          />
        </>
      }
    />
  )
}
