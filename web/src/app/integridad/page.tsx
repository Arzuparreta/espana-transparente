import { ThreadLanding } from "@/components/domain/ThreadLanding"
import { getSectionIndex } from "@/lib/data"
import { getThread } from "@/lib/thread-config"

export const revalidate = 3600

export const metadata = {
  title: "Integridad",
  description: "Declaraciones económicas, puertas giratorias, procesos judiciales y nombramientos institucionales.",
}

export default async function IntegridadThreadPage() {
  const [sectionIndex] = await Promise.all([getSectionIndex()])

  return (
    <ThreadLanding
      thread={getThread("integridad")}
      sectionIndex={sectionIndex}
    />
  )
}
