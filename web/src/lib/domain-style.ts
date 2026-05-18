const FALLBACK_PARTY_COLOR = "#64748b"
const FALLBACK_VOTE_COLOR = "#4b5563"

export const VOTE_COLORS: Record<string, string> = {
  Sí: "#22c55e",
  No: "#ef4444",
  Abstención: "#f59e0b",
  "No vota": FALLBACK_VOTE_COLOR,
}

export function getPartyColor(color?: string | null) {
  return color || FALLBACK_PARTY_COLOR
}

export function getVoteColor(vote?: string | null) {
  if (!vote) return FALLBACK_VOTE_COLOR
  return VOTE_COLORS[vote] || FALLBACK_VOTE_COLOR
}

export function withAlpha(hex: string, alpha: string) {
  return `${hex}${alpha}`
}

export function getPartyTone(color?: string | null) {
  const tone = getPartyColor(color)
  return {
    color: tone,
    borderColor: withAlpha(tone, "40"),
    backgroundColor: withAlpha(tone, "12"),
  }
}

export function getVoteTone(vote?: string | null) {
  const tone = getVoteColor(vote)
  return {
    color: tone,
    borderColor: withAlpha(tone, "40"),
    backgroundColor: withAlpha(tone, "12"),
  }
}
