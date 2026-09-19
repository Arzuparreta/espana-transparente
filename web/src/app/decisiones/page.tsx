import { ThreadLanding } from "@/components/domain/ThreadLanding"
import { getSectionIndex } from "@/lib/data"
import { getThread } from "@/lib/thread-config"
export const metadata = {
  title: "Decisiones",
  description: "Votos individuales, iniciativas y representación electoral.",
}
export default async function Page() {
  return (
    <ThreadLanding
      thread={getThread("decisiones")}
      sectionIndex={await getSectionIndex()}
    />
  )
}
