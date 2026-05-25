import { ThreadLanding } from "@/components/domain/ThreadLanding"
import { getSectionIndex } from "@/lib/data"
import { getThread } from "@/lib/thread-config"

export const revalidate = 3600

export const metadata = {
  title: "Poder",
  description: "Gobierno, cámaras, partidos, votaciones e iniciativas legislativas.",
}

export default async function PoderThreadPage() {
  const [sectionIndex] = await Promise.all([getSectionIndex()])

  return (
    <ThreadLanding
      thread={getThread("poder")}
      sectionIndex={sectionIndex}
    />
  )
}
