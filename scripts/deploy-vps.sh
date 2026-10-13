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
npm ci
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
  echo "[deploy] failed; restoring the preceding process and nginx configuration" >&2
  cp -a "$NGINX_BACKUP" "$NGINX_SITE"
  nginx -t && systemctl reload nginx
  pm2 startOrRestart "$RELEASE/previous.ecosystem.config.cjs" --update-env
  pm2 save
  return 1
}
trap rollback ERR
install -m 644 "$RELEASE/ops/nginx/espana-transparente.conf" "$NGINX_SITE"
if ! nginx -t; then
  cp -a "$NGINX_BACKUP" "$NGINX_SITE"
  exit 1
fi
# PM2 reads the existing app name and changes its cwd/script at the restart.
node --input-type=module - "$RELEASE" "$NODE_RUNTIME" <<'JS'
import fs from 'node:fs';
const [release, runtime] = process.argv.slice(2);
fs.writeFileSync(`${release}/ecosystem.config.cjs`, `module.exports = ${JSON.stringify({apps:[{
  name:'espana-transparente-web', cwd:`${release}/web`,
  script:`${release}/web/node_modules/next/dist/bin/next`, args:'start -p 3000',
  interpreter:`${runtime}/bin/node`, env:{NODE_ENV:'production',
    SUPABASE_INTERNAL_URL:process.env.SUPABASE_INTERNAL_URL, APP_REVISION:process.env.APP_REVISION},
}]})};\n`, {mode:0o600});
JS
pm2 startOrRestart "$RELEASE/ecosystem.config.cjs" --update-env
systemctl reload nginx
# A successful restart is insufficient: require this revision and a healthy DB.
node --input-type=module <<'JS'
let ready=false;
for(let attempt=0;attempt<15;attempt++){
  try{
    const r=await fetch('http://127.0.0.1:3000/api/health',{signal:AbortSignal.timeout(10_000)});
    const h=await r.json();
    if(r.ok && h.status==='ok' && h.revision===process.env.APP_REVISION){ready=true;break;}
  }catch{}
  await new Promise(resolve=>setTimeout(resolve,2000));
}
if(!ready) throw new Error('New release failed its revision/database health check');
console.log('New revision is serving with a healthy database');
JS
pm2 save
trap - ERR
node "$RELEASE/scripts/prune-web-releases.mjs" "$RELEASE_ROOT" "$RELEASE/web"
echo "[deploy] ready: $REVISION ($RELEASE)"
