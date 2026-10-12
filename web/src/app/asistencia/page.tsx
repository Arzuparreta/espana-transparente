import type { Metadata } from "next"
import { PageHeader } from "@/components/domain/PageHeader"
import { AttendanceView } from "@/components/views/AttendanceView"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Participación en votaciones nominales",
  description:
    "Sesiones plenarias con voto nominal en las que cada diputado emitió al menos un voto. No votar no prueba ausencia física y votar no mide todo el trabajo parlamentario.",
  alternates: { canonical: "/asistencia" },
}

interface PageProps {
  searchParams?: Promise<{
    page?: string
    party?: string
    sort?: string
    direction?: string
  }>
}

export default async function AttendancePage({ searchParams }: PageProps) {
  const params = await searchParams

  return (
    <div className="ui-page space-y-6 sm:space-y-8">
      <PageHeader title={metadata.title as string} description={metadata.description as string} />
      <AttendanceView searchParams={Promise.resolve(params ?? {})} />
    </div>
  )
}
