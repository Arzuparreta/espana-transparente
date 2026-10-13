// Share concurrent cache misses without retaining completed results or failures.
// Persistent freshness remains the responsibility of Next's Data Cache.
export function coalesceRequests<Args extends unknown[], Result>(
  fn: (...args: Args) => Promise<Result>,
): (...args: Args) => Promise<Result> {
  const pending = new Map<string, Promise<Result>>()
  return (...args) => {
    const key = JSON.stringify(args)
    const existing = pending.get(key)
    if (existing) return existing
    const promise = Promise.resolve().then(() => fn(...args)).finally(() => pending.delete(key))
    pending.set(key, promise)
    return promise
  }
}
