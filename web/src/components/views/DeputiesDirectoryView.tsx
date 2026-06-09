import type { PoliticianWithMemberships } from "@/types"
import { DiputadosFilter } from "@/components/politicians/DiputadosFilter"
import { getDeputyCards } from "@/lib/data"

export async function DeputiesDirectoryView() {
  const politicians = await getDeputyCards()

  return (
    <div className="space-y-6 sm:space-y-8">
      <DiputadosFilter politicians={politicians as unknown as PoliticianWithMemberships[]} />
    </div>
  )
}
