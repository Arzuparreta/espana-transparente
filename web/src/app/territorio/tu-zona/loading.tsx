export default function Loading() {
  return (
    <div className="ui-page min-h-[calc(100dvh-3.5rem)] animate-pulse space-y-6 lg:min-h-[calc(100dvh-6rem)]">
      <header className="space-y-3">
        <div className="h-3 w-20 rounded bg-muted" />
        <div className="h-7 w-40 rounded bg-muted" />
        <div className="h-4 w-full max-w-2xl rounded bg-muted" />
      </header>
      <div className="space-y-3">
        <div className="h-11 w-full max-w-xl rounded bg-muted" />
        <div className="h-40 w-full rounded bg-muted" />
      </div>
    </div>
  )
}
