const DEFAULT_SUPABASE_FETCH_TIMEOUT_MS = 8_000

function configuredTimeoutMs() {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_FETCH_TIMEOUT_MS
  const value = Number.parseInt(raw ?? "", 10)
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_SUPABASE_FETCH_TIMEOUT_MS
}

export function createSupabaseFetch(timeoutMs = configuredTimeoutMs()): typeof fetch {
  return async (input, init = {}) => {
    const controller = new AbortController()
    const timeout = setTimeout(() => {
      controller.abort(new DOMException("Supabase request timed out", "TimeoutError"))
    }, timeoutMs)

    const originalSignal = init.signal
    if (originalSignal) {
      if (originalSignal.aborted) {
        controller.abort(originalSignal.reason)
      } else {
        originalSignal.addEventListener(
          "abort",
          () => controller.abort(originalSignal.reason),
          { once: true }
        )
      }
    }

    try {
      return await fetch(input, { ...init, signal: controller.signal })
    } finally {
      clearTimeout(timeout)
    }
  }
}
