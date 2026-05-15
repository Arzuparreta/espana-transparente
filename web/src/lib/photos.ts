type PhotoVariants = Record<string, string> | null | undefined

function numericEntries(photoVariants: PhotoVariants) {
  return Object.entries(photoVariants ?? {})
    .map(([size, url]) => [Number(size), url] as const)
    .filter(([size, url]) => Number.isFinite(size) && size > 0 && typeof url === "string" && url.length > 0)
    .sort((a, b) => a[0] - b[0])
}

export function getResponsivePhoto(photoUrl?: string | null, photoVariants?: PhotoVariants) {
  const entries = numericEntries(photoVariants)
  if (entries.length === 0) {
    return {
      src: photoUrl ?? undefined,
      srcSet: undefined as string | undefined,
      sizes: undefined as string | undefined,
    }
  }

  const preferred =
    entries.find(([size]) => size >= 256)?.[1] ??
    entries[entries.length - 1]?.[1] ??
    photoUrl ??
    undefined

  return {
    src: preferred,
    srcSet: entries.map(([size, url]) => `${url} ${size}w`).join(", "),
    sizes: "(max-width: 640px) 64px, 128px",
  }
}
