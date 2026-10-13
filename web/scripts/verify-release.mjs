const [origin, revision] = process.argv.slice(2)
if (!origin || !revision) throw new Error("Origin and expected revision are required")
let ready = false
for (let attempt = 0; attempt < 15; attempt++) {
  try {
    const response = await fetch(new URL("/api/health", origin), { signal: AbortSignal.timeout(10_000) })
    const health = await response.json()
    if (response.ok && health.status === "ok" && health.revision === revision) { ready = true; break }
  } catch {}
  await new Promise((resolve) => setTimeout(resolve, 2000))
}
if (!ready) throw new Error("Release failed its revision/database health check")
console.log("Expected revision is serving with a healthy database")
