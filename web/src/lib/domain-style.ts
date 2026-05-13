const FALLBACK_PARTY_COLOR = "#64748b"
const FALLBACK_VOTE_COLOR = "#9ca3af"

export const VOTE_COLORS: Record<string, string> = {
  Sí: "#15803d",
  No: "#b91c1c",
  Abstención: "#b45309",
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
