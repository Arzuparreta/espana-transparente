// Keep the live release plus the three newest build artifacts for rollback.
import fs from "node:fs"
import path from "node:path"
const [root, currentWeb] = process.argv.slice(2)
if (!root || !currentWeb) throw new Error("Release root and live cwd required")
const current = path.dirname(fs.realpathSync(currentWeb))
const releases = fs.readdirSync(root, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && /^[0-9a-f]{40}\.[A-Za-z0-9]+$/.test(entry.name))
  .map((entry) => ({ dir: path.join(root, entry.name), modified: fs.statSync(path.join(root, entry.name)).mtimeMs }))
  .sort((a, b) => b.modified - a.modified)
for (const { dir } of releases.slice(3)) {
  if (fs.realpathSync(dir) === current) continue
  fs.rmSync(dir, { recursive: true })
  console.log(`Pruned superseded build artifact: ${path.basename(dir)}`)
}
