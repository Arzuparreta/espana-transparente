import { ThreadLanding } from "@/components/domain/ThreadLanding"
import { getSectionIndex } from "@/lib/data"
import { getThread } from "@/lib/thread-config"

export const revalidate = 3600

export const metadata = {
  title: "Territorio",
  description: "Gasto autonómico y municipal por territorio.",
}

export default async function TerritorioThreadPage() {
  const [sectionIndex] = await Promise.all([getSectionIndex()])

  return (
    <ThreadLanding
      thread={getThread("territorio")}
      sectionIndex={sectionIndex}
    />
  )
}
