import { ThreadLanding } from "@/components/domain/ThreadLanding"
import { PeopleAnswer } from "@/components/domain/PeopleAnswer"
import { getGobiernoActual, getSectionIndex } from "@/lib/data"
import { getThread } from "@/lib/thread-config"
import { dataErrorMessage } from "@/lib/data/shared"
export const revalidate = 3600
export const metadata = { title: "Personas y entidades", description: "Quién ocupa los cargos registrados, desde cuándo y con qué documento; representación y decisiones con su alcance." }
export default async function Page() {
  const [sectionIndex, government] = await Promise.all([
    getSectionIndex(),
    getGobiernoActual().then(members => ({ members, error: false })).catch(error => {
      console.error("People mandate answer", dataErrorMessage(error))
      return { members: [], error: true }
    }),
  ])
  return <ThreadLanding thread={getThread("personas")} sectionIndex={sectionIndex} fullDescriptions introduction={<PeopleAnswer {...government} />} />
}
