import { Skeleton } from "@/components/ui/skeleton"

export default function BudgetProgramLoading() {
  return (
    <div className="ui-page">
      <Skeleton className="h-8 rounded" />
      <Skeleton className="h-44 rounded" />
      <Skeleton className="h-80 rounded" />
    </div>
  )
}
