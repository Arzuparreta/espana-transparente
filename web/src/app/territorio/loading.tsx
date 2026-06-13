export default function Loading() {
  return (
    <div className="min-h-[calc(100dvh-3.5rem)] animate-pulse bg-background lg:min-h-[calc(100dvh-6rem)]">
      <div className="h-24 border-b border-border bg-card/60" />
      <div className="grid min-h-[calc(100dvh-9.5rem)] lg:grid-cols-[260px_minmax(0,1fr)_340px]">
        <div className="hidden border-r border-border bg-card/30 lg:block" />
        <div className="bg-[#0c0f0d]" />
        <div className="hidden border-l border-border bg-card lg:block" />
      </div>
    </div>
  )
}
