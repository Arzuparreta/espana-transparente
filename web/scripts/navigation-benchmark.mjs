// Run against a production build, never next dev. The first request is cold
// for this probe, not necessarily for the server's shared data cache.
const origin = process.argv[2] || "http://localhost:3000"
const routes = process.argv.slice(3)
const samples = []
for (const route of routes.length ? routes : ["/economia", "/contratos", "/diputados", "/territorio", "/personas"]) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const start = performance.now()
    const response = await fetch(new URL(route, origin), { signal: AbortSignal.timeout(30_000) })
    const reader = response.body.getReader()
    let firstByteMs = null
    let bytes = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      firstByteMs ??= Math.round(performance.now() - start)
      bytes += value.byteLength
    }
    samples.push({ route, attempt, status: response.status, firstByteMs, totalMs: Math.round(performance.now() - start), decodedKB: Math.round(bytes / 1024) })
    if (!response.ok) process.exitCode = 1
  }
}
console.table(samples)
