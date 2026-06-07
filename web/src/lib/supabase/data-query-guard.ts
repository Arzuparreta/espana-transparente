type QueryResult = {
  error?: unknown
}

function errorText(error: unknown): string {
  if (error && typeof error === "object") {
    const fields = ["message", "details", "hint", "code", "status"]
    return fields
      .map((field) => field in error ? String((error as Record<string, unknown>)[field] ?? "") : "")
      .join(" ")
      .toLowerCase()
  }
  return String(error ?? "").toLowerCase()
}

export function isDataSourceUnavailable(error: unknown): boolean {
  const text = errorText(error)
  return [
    "<!doctype html",
    "upstream gateway",
    "failed to fetch",
    "fetch failed",
    "connection timed out",
    "connection timeout",
    "timeout expired",
    "aborted due to timeout",
    "timeouterror",
    "database not available",
    "could not query the database",
    "authentication query failed",
    "ecircuitbreaker",
    "eauthquery",
    "pgrst002",
    " 502",
    " 503",
    " 504",
    " 520",
    " 522",
  ].some((marker) => text.includes(marker))
}

function assertAvailable(result: unknown) {
  const error =
    result && typeof result === "object" && "error" in result
      ? (result as QueryResult).error
      : null

  if (error && isDataSourceUnavailable(error)) {
    throw new Error("Public data source unavailable")
  }

  return result
}

export function guardDataQuery<T extends object>(query: T): T {
  return new Proxy(query, {
    get(target, property) {
      if (property === "then") {
        return (
          onFulfilled?: (value: unknown) => unknown,
          onRejected?: (reason: unknown) => unknown
        ) =>
          Promise.resolve(target as unknown as PromiseLike<unknown>)
            .then(assertAvailable)
            .then(onFulfilled, onRejected)
      }

      const value = Reflect.get(target, property, target)
      if (typeof value !== "function") return value

      return (...args: unknown[]) => {
        const next = value.apply(target, args)
        return next && typeof next === "object" ? guardDataQuery(next) : next
      }
    },
  })
}

export function guardPublicDataClient<T extends object>(client: T): T {
  return new Proxy(client, {
    get(target, property) {
      const value = Reflect.get(target, property, target)
      if (typeof value !== "function") return value

      if (property === "from" || property === "rpc") {
        return (...args: unknown[]) => guardDataQuery(value.apply(target, args))
      }

      return value.bind(target)
    },
  })
}
