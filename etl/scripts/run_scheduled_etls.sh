#!/usr/bin/env bash

set -uo pipefail

batch="${1:-}"
failures=()

if ! python -m common.pipeline_monitor preflight --attempts 12 --delay-seconds 10; then
  echo "::error title=Database unavailable::ETL batch stopped before opening more connections"
  exit 75
fi

python -m common.pipeline_monitor cleanup \
  || echo "::warning title=ETL status cleanup unavailable::Could not close stale pipeline runs"

run_pipeline() {
  local label="$1"
  shift
  local run_id=""

  if run_id="$(python -m common.pipeline_monitor start "${label}")"; then
    :
  else
    echo "::warning title=${label} status unavailable::Could not record pipeline start"
    run_id=""
  fi

  echo "::group::${label}"
  if "$@"; then
    echo "${label}: OK"
    if [[ -n "${run_id}" ]]; then
      python -m common.pipeline_monitor finish "${run_id}" succeeded \
        || echo "::warning title=${label} status unavailable::Could not record pipeline success"
    fi
  else
    local exit_code=$?
    failures+=("${label} (exit ${exit_code})")
    echo "::error title=${label} failed::Pipeline exited with code ${exit_code}"
    if [[ -n "${run_id}" ]]; then
      python -m common.pipeline_monitor finish "${run_id}" failed \
        --error-summary "Scheduled command exited with code ${exit_code}" \
        || echo "::warning title=${label} status unavailable::Could not record pipeline failure"
    fi
  fi
  echo "::endgroup::"
}

run_self_tracked_pipeline() {
  local label="$1"
  shift

  echo "::group::${label}"
  if "$@"; then
    echo "${label}: OK"
  else
    local exit_code=$?
    failures+=("${label} (exit ${exit_code})")
    echo "::error title=${label} failed::Pipeline exited with code ${exit_code}"
  fi
  echo "::endgroup::"
}

run_daily() {
  local yesterday today
  yesterday="$(date -d 'yesterday' +%Y-%m-%d)"
  today="$(date +%Y-%m-%d)"

  run_pipeline "congreso.diputados" python -m src.congreso.diputados
  run_self_tracked_pipeline "congreso.asistencia" python -m src.congreso.asistencia --from-date 20250101
  run_pipeline "ine.indicadores" python -m src.ine.indicadores
  run_self_tracked_pipeline "contracts_daily" python -m src.contratacion.contratos
  run_self_tracked_pipeline "subsidies_daily" python -m src.bdns.subvenciones \
    --from-date "${yesterday}" --to-date "${today}" --importe-min 0 --max-pages 100
  run_pipeline "territorio.atlas" python -m src.territorio.atlas
  run_pipeline "photos.run" python -m src.photos.run --refresh-missing
  run_pipeline "borme.officers" python -m src.borme.officers --limit 100 --resume
  run_pipeline "congreso.declaraciones_ocr" python -m src.congreso.declaraciones_ocr --limit 25 --resume
  run_self_tracked_pipeline "common.search_refresh" python -m common.search_refresh
}

run_weekly_core() {
  run_pipeline "congreso.cods" python -m src.congreso.cods --resume
  run_pipeline "congreso.declaraciones" python -m src.congreso.declaraciones
  run_self_tracked_pipeline "congreso.iniciativas" python -m src.congreso.iniciativas
  run_pipeline "congreso.gobierno" python -m src.congreso.gobierno
  run_pipeline "congreso.responsables" python -m src.congreso.responsables
  run_pipeline "congreso.public_officials" python -m src.congreso.public_officials
  run_pipeline "photos.public_officials_wikidata" python -m src.photos.sources.public_officials_wikidata
  run_pipeline "congreso.power_relationships" python -m src.congreso.power_relationships
  run_pipeline "photos.run" python -m src.photos.run --no-refresh-missing --max-age-days 30
  run_self_tracked_pipeline "presupuestos" python -m src.presupuestos.presupuestos --year "$(date +%Y)" --resume
  run_pipeline "puertas_giratorias.ingest" python -m src.puertas_giratorias.ingest \
    --watchlist data/personas_vigiladas.yml
  run_pipeline "instituciones.instituciones" python -m src.instituciones.instituciones
  run_pipeline "public_bodies.boe_nombramientos" python -m src.public_bodies.boe_nombramientos --days 7 --resume
  run_self_tracked_pipeline "kohesio.fondos_ue" python -m src.kohesio.fondos_ue
  run_pipeline "senado.senadores" python -m src.senado.senadores
  run_self_tracked_pipeline "senado.bajas" python -m src.senado.bajas
  run_self_tracked_pipeline "senado.votaciones" python -m src.senado.votaciones
}

run_weekly_documents() {
  run_pipeline "congreso.declaraciones_ocr" python -m src.congreso.declaraciones_ocr --limit 150 --resume
  run_pipeline "borme.officers" python -m src.borme.officers --limit 200 --resume
}

run_weekly_links() {
  run_pipeline "lobbying.rgi" python -m src.lobbying.rgi --resume
  run_pipeline "congreso.opendata_intereses" python -m src.congreso.opendata_intereses
  run_self_tracked_pipeline "judicial.wikipedia" python -m src.judicial.wikipedia --resume --extract-people
  run_self_tracked_pipeline "judicial.cgpj" python -m src.judicial.cgpj --resume
  run_self_tracked_pipeline "judicial.contract_links" python -m src.judicial.contract_links
  run_pipeline "ine.indicadores_ampliados" python -m src.ine.indicadores_ampliados
  run_pipeline "ine.ipc_subgrupos" python -m src.ine.ipc_subgrupos
  run_pipeline "ine.bde" python -m src.ine.bde
  run_pipeline "elections.ingest" python -m src.elections.ingest
  run_self_tracked_pipeline "common.search_refresh" python -m common.search_refresh
}

case "${batch}" in
  daily)
    run_daily
    ;;
  weekly-core)
    run_weekly_core
    ;;
  weekly-documents)
    run_weekly_documents
    ;;
  weekly-links)
    run_weekly_links
    ;;
  weekly)
    run_weekly_core
    run_weekly_documents
    run_weekly_links
    ;;
  *)
    echo "Usage: $0 daily|weekly|weekly-core|weekly-documents|weekly-links" >&2
    exit 2
    ;;
esac

if ((${#failures[@]} > 0)); then
  printf 'Failed pipelines:\n' >&2
  printf ' - %s\n' "${failures[@]}" >&2
  exit 1
fi

echo "All ${batch} pipelines completed successfully."
