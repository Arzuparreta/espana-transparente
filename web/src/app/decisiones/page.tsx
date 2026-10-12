import { ThreadLanding } from "@/components/domain/ThreadLanding"
import { getSectionIndex } from "@/lib/data"
import { getThread } from "@/lib/thread-config"
import { getParliamentActivity } from "@/lib/data/parliament-activity"
import { DecisionAnswer } from "@/components/domain/DecisionAnswer"
export const revalidate = 3600
export const metadata = {
  title: "Decisiones",
  description: "Votos individuales, iniciativas y representación electoral.",
}
export default async function Page({ searchParams }: { searchParams?: Promise<{ year?: string | string[] }> }) {
  const requested = (await searchParams)?.year
  const [sectionIndex, activity] = await Promise.all([getSectionIndex(), getParliamentActivity(requested)])
  return (
    <ThreadLanding
      thread={getThread("decisiones")}
      sectionIndex={sectionIndex}
      fullDescriptions
      introduction={<DecisionAnswer data={activity} />}
    />
  )
}
