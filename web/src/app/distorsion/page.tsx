import { notFound } from "next/navigation"
import { PageHeader } from "@/components/domain/PageHeader"
import { DistorsionTabs } from "@/components/distorsion/DistorsionTabs"
import { ElectionCompare } from "@/components/distorsion/ElectionCompare"
import { getElectionDates, getElectionProvinces, getElectionResults } from "@/lib/data"

export const revalidate = 3600

export const metadata = {
  title: "Distorsión electoral",
  description: "Cómo la ley D'Hondt y el tamaño de las circunscripciones distorsionan la representación: votos por escaño y umbral efectivo por provincia.",
}

interface PageProps {
  searchParams?: Promise<{ date?: string; compare?: string }>
}

export default async function DistorsionElectoralPage({ searchParams }: PageProps) {
  const params = await searchParams
  const dates = await getElectionDates()
  if (dates.length === 0) {
    return (
      <div className="ui-page">
        <PageHeader
          title="Distorsión electoral"
          description="Datos electorales aún no disponibles en la base."
        />
      </div>
    )
  }

  const activeDate = params?.date ?? dates[0].date
  const compareDate = params?.compare ?? null

  const activeElection = dates.find((d) => d.date === activeDate) ?? dates[0]
  const results = await getElectionResults(activeElection.date)
  const provinces = await getElectionProvinces(activeElection.date)

  if (results.length === 0) notFound()

  const withVotesPerSeat = results
    .map((r) => ({
      party: r.party,
      partyShortName: r.party_short_name,
      color: r.color,
      votes: r.votes,
      seats: r.seats,
      pctVote: r.pct_vote,
      votesPerSeat: Math.round(r.votes / r.seats),
      pctSeats: (r.seats / r.total_seats) * 100,
    }))
    .sort((a, b) => a.votesPerSeat - b.votesPerSeat)

  const maxVotesPerSeat = Math.max(...withVotesPerSeat.map((r) => r.votesPerSeat))
  const minVotesPerSeat = Math.min(...withVotesPerSeat.map((r) => r.votesPerSeat))

  // Fetch comparison data if requested
  let compareResults: typeof withVotesPerSeat | null = null
  if (compareDate && compareDate !== activeElection.date) {
    const rawCompare = await getElectionResults(compareDate)
    compareResults = rawCompare
      .map((r) => ({
        party: r.party,
        partyShortName: r.party_short_name,
        color: r.color,
        votes: r.votes,
        seats: r.seats,
        pctVote: r.pct_vote,
        votesPerSeat: Math.round(r.votes / r.seats),
        pctSeats: (r.seats / r.total_seats) * 100,
      }))
      .sort((a, b) => a.votesPerSeat - b.votesPerSeat)
  }

  const formattedDate = new Date(activeElection.date).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  return (
    <div className="ui-page">
      <PageHeader
        title="Distorsión electoral"
        description={`Elecciones generales del ${formattedDate} · ${activeElection.total_seats} escaños · participación ${activeElection.participation_pct}%`}
      />

      <DistorsionTabs
        dates={dates.map((d) => d.date)}
        activeDate={activeElection.date}
        withVotesPerSeat={withVotesPerSeat}
        maxVotesPerSeat={maxVotesPerSeat}
        minVotesPerSeat={minVotesPerSeat}
        provinces={provinces.map((p) => ({
          name: p.province_name,
          seats: p.seats,
          effectiveThreshold: p.effective_threshold,
          description: p.description,
        }))}
      />

      {dates.length > 1 && (
        <ElectionCompare
          dates={dates.map((d) => d.date)}
          activeDate={activeElection.date}
          results={withVotesPerSeat}
          compareResults={compareResults}
        />
      )}
    </div>
  )
}
