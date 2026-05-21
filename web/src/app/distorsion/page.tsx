import { PageHeader } from "@/components/domain/PageHeader"
import { DistorsionTabs } from "@/components/distorsion/DistorsionTabs"

export const revalidate = 3600

export const metadata = {
  title: "Distorsión electoral",
  description: "Cómo la ley D'Hondt y el tamaño de las circunscripciones distorsionan la representación: votos por escaño y umbral efectivo por provincia en las elecciones generales de 2023.",
}

const ELECTION_2023 = {
  date: "23 de julio de 2023",
  totalSeats: 350,
  participation: 66.0,
  results: [
    { party: "PP",      votes: 8094840, seats: 137, color: "#0055A7", pctVote: 33.1 },
    { party: "PSOE",    votes: 7821979, seats: 121, color: "#E01021", pctVote: 32.0 },
    { party: "VOX",     votes: 3057000, seats: 33,  color: "#63BE21", pctVote: 12.4 },
    { party: "SUMAR",   votes: 3014006, seats: 31,  color: "#E01065", pctVote: 12.3 },
    { party: "ERC",     votes: 466020,  seats: 7,   color: "#FFB232", pctVote: 1.9  },
    { party: "JUNTS",   votes: 395429,  seats: 7,   color: "#20C0C2", pctVote: 1.6  },
    { party: "EH Bildu",votes: 335129,  seats: 6,   color: "#00D4AA", pctVote: 1.4  },
    { party: "EAJ-PNV", votes: 277289,  seats: 5,   color: "#008000", pctVote: 1.1  },
    { party: "BNG",     votes: 153995,  seats: 1,   color: "#6CB6FF", pctVote: 0.6  },
    { party: "CCa",     votes: 116363,  seats: 1,   color: "#FFD700", pctVote: 0.5  },
    { party: "UPN",     votes: 52544,   seats: 1,   color: "#2A52BE", pctVote: 0.2  },
  ],
  provinces: [
    { name: "Soria",     seats: 2,  effectiveThreshold: 25.0, description: "Necesitas ~25% para optar a escaño en provincias de 2 diputados" },
    { name: "Ávila",     seats: 3,  effectiveThreshold: 16.7, description: "Con 3 escaños, el umbral efectivo es ~17%" },
    { name: "Segovia",   seats: 3,  effectiveThreshold: 16.7, description: "3 escaños — misma distorsión que Ávila" },
    { name: "Teruel",    seats: 3,  effectiveThreshold: 16.7, description: "3 escaños, mismo umbral ~17%" },
    { name: "Zamora",    seats: 3,  effectiveThreshold: 16.7, description: "Provincia de 3 escaños" },
    { name: "Madrid",    seats: 37, effectiveThreshold: 1.4,  description: "En Madrid (37 escaños), ~1.4% puede bastar" },
    { name: "Barcelona", seats: 32, effectiveThreshold: 1.6,  description: "Barcelona (32 escaños), ~1.6% umbral" },
  ],
}

export default async function DistorsionElectoralPage() {
  const withVotesPerSeat = ELECTION_2023.results
    .map((r) => ({
      ...r,
      votesPerSeat: Math.round(r.votes / r.seats),
      pctSeats: (r.seats / ELECTION_2023.totalSeats) * 100,
    }))
    .sort((a, b) => a.votesPerSeat - b.votesPerSeat)

  const maxVotesPerSeat = Math.max(...withVotesPerSeat.map((r) => r.votesPerSeat))
  const minVotesPerSeat = Math.min(...withVotesPerSeat.map((r) => r.votesPerSeat))

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Distorsión electoral"
        description={`Elecciones generales del ${ELECTION_2023.date} · ${ELECTION_2023.totalSeats} escaños · participación ${ELECTION_2023.participation}%`}
      />
      <DistorsionTabs
        withVotesPerSeat={withVotesPerSeat}
        maxVotesPerSeat={maxVotesPerSeat}
        minVotesPerSeat={minVotesPerSeat}
        provinces={ELECTION_2023.provinces}
      />
    </div>
  )
}
