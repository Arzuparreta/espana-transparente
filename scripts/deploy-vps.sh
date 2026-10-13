#!/usr/bin/env bash
# Build an isolated release. Keep the running checkout and its dependencies
# intact until the new build is ready; restart only the España Transparente app.
set -euo pipefail
REPO="${ET_REPO:-/root/Proyectos/espana-transparente}"
cd "$REPO"
git fetch origin main
git reset --hard "${ET_DEPLOY_REVISION:-origin/main}"
REVISION="$(git rev-parse HEAD)"
NODE_RUNTIME="$(bash "$REPO/scripts/ensure-node-runtime.sh")"
export PATH="$NODE_RUNTIME/bin:$PATH"
RELEASE_ROOT="${ET_RELEASE_ROOT:-/opt/espana-transparente/releases}"
RELEASE="$(mktemp -d "$RELEASE_ROOT/$REVISION.XXXXXX" 2>/dev/null || { mkdir -p "$RELEASE_ROOT"; mktemp -d "$RELEASE_ROOT/$REVISION.XXXXXX"; })"
chmod 700 "$RELEASE"
git archive "$REVISION" | tar -x -C "$RELEASE"
# Credentials stay on the host and are never added to the repository.
for env_file in .env.production .env.production.local .env.local; do
  if [[ -f "$REPO/web/$env_file" ]]; then
    install -m 600 "$REPO/web/$env_file" "$RELEASE/web/$env_file"
  fi
done
export SUPABASE_INTERNAL_URL="${SUPABASE_INTERNAL_URL:-http://127.0.0.1:54321}"
export APP_REVISION="$REVISION"
cd "$RELEASE/web"
echo "[deploy] installing dependencies in isolated release…"
npm ci --include=dev
node scripts/check-internal-supabase.mjs
echo "[deploy] building revision $REVISION…"
npm run build
# Preserve hashed assets for browsers that still have the preceding release.
PREVIOUS_WEB="$(pm2 jlist | node -e 'const a=JSON.parse(require("fs").readFileSync(0,"utf8"));console.log(a.find(p=>p.name==="espana-transparente-web")?.pm2_env.pm_cwd||"")')"
if [[ -n "$PREVIOUS_WEB" && -d "$PREVIOUS_WEB/.next/static" ]]; then
  cp -an "$PREVIOUS_WEB/.next/static/." "$RELEASE/web/.next/static/"
fi
# Save the exact preceding process definition for rollback without logging env.
pm2 jlist | node --input-type=module -e '
import fs from "node:fs";
const p=JSON.parse(fs.readFileSync(0,"utf8")).find(p=>p.name==="espana-transparente-web");
if(!p) throw new Error("Missing existing application for rollback");
const e=p.pm2_env;
fs.writeFileSync(process.argv[1],`module.exports = ${JSON.stringify({apps:[{name:p.name,cwd:e.pm_cwd,script:e.pm_exec_path,args:e.args,interpreter:e.exec_interpreter,env:e.env||{}}]})};\n`,{mode:0o600});
' "$RELEASE/previous.ecosystem.config.cjs"
# Validate nginx before changing the process; restore its config on failure.
NGINX_SITE="/etc/nginx/sites-available/espana-transparente"
NGINX_BACKUP="$(mktemp /tmp/et-nginx-before.XXXXXX)"
cp -a "$NGINX_SITE" "$NGINX_BACKUP"
rollback() {
  trap - ERR
  set +e
  echo "[deploy] failed; restoring the preceding release" >&2
  # A restart cannot change PM2's cwd: recreate while the candidate serves.
  pm2 delete espana-transparente-web >/dev/null 2>&1
  pm2 start "$RELEASE/previous.ecosystem.config.cjs" --update-env
  if curl -fsS --retry 10 --retry-connrefused --retry-delay 1 --max-time 10 \
    http://127.0.0.1:3000/api/health >/dev/null; then
    cp -a "$NGINX_BACKUP" "$NGINX_SITE"
    if nginx -t && systemctl reload nginx; then
      pm2 delete et-navigation-candidate >/dev/null 2>&1
      pm2 save
    fi
  else
    echo "[deploy] rollback health failed; retaining the candidate for inspection" >&2
  fi
  return 1
}
# Prepare both process definitions without touching the running server.
node --input-type=module - "$RELEASE" "$NODE_RUNTIME" <<'JS'
import fs from 'node:fs';
const [release, runtime] = process.argv.slice(2);
const definition = (name,port) => ({apps:[{
  name, cwd:`${release}/web`, script:`${release}/web/node_modules/next/dist/bin/next`,
  args:`start -H 127.0.0.1 -p ${port}`, interpreter:`${runtime}/bin/node`, kill_timeout:15000,
  env:{NODE_ENV:'production', SUPABASE_INTERNAL_URL:process.env.SUPABASE_INTERNAL_URL,
    APP_REVISION:process.env.APP_REVISION},
}]});
for(const [file,name,port] of [
  ['ecosystem.config.cjs','espana-transparente-web',3000],
  ['candidate.ecosystem.config.cjs','et-navigation-candidate',3001],
]) fs.writeFileSync(`${release}/${file}`,`module.exports = ${JSON.stringify(definition(name,port))};\n`,{mode:0o600});
JS
# This candidate name is reserved for this deployment, serialized by the CI lock.
pm2 delete et-navigation-candidate >/dev/null 2>&1 || true
pm2 start "$RELEASE/candidate.ecosystem.config.cjs" --update-env
trap rollback ERR
node scripts/verify-release.mjs http://127.0.0.1:3001 "$REVISION"
# Serve the verified candidate while replacing the main process on port 3000.
sed 's#http://127.0.0.1:3000#http://127.0.0.1:3001#g' \
  "$RELEASE/ops/nginx/espana-transparente.conf" > "$RELEASE/nginx-candidate.conf"
install -m 644 "$RELEASE/nginx-candidate.conf" "$NGINX_SITE"
nginx -t
systemctl reload nginx
node scripts/verify-release.mjs https://spaintransparencia.info "$REVISION"
pm2 delete espana-transparente-web
pm2 start "$RELEASE/ecosystem.config.cjs" --update-env
node scripts/verify-release.mjs http://127.0.0.1:3000 "$REVISION"
install -m 644 "$RELEASE/ops/nginx/espana-transparente.conf" "$NGINX_SITE"
nginx -t
systemctl reload nginx
node scripts/verify-release.mjs https://spaintransparencia.info "$REVISION"
pm2 delete et-navigation-candidate
pm2 save
trap - ERR
node "$RELEASE/scripts/prune-web-releases.mjs" "$RELEASE_ROOT" "$RELEASE/web"
echo "[deploy] ready: $REVISION ($RELEASE)"
