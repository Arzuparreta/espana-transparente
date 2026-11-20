"""Build a reusable release package of official Senate plenary votes (XV).

Input: a directory produced by the official exporter
    PYTHONPATH=src python -m src.senado.votaciones --export-directory DIR
which holds the untouched ses_N.xml files plus manifest.json (URL + SHA-256).

Output (in --out):
    xml/                       the official XML, byte for byte, + manifest.json
    votaciones.csv             one row per votation
    votos_nominales.csv        one row per official nominal row (incl. unlinked)
    SHA256SUMS                 checksums of every file in the package
    LEEME.md                   provenance, licence and column dictionary

Linking to España Transparente identities reuses the production matcher
(build_senator_index / resolve_senator) over the public senator list served by
the site's read-only API. Rows the matcher cannot resolve unambiguously are
exported with vinculado=false and empty identifiers: no automatic attribution.

Usage (from etl/):
    SUPABASE_URL=... SUPABASE_ANON_KEY=... PYTHONPATH=src \
      python scripts/export_senate_votes_release.py --payload DIR --out OUT
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import shutil
import subprocess
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import httpx

from common.utils import normalize_name
from senado.payload import load_payload
from senado.votaciones import build_senator_index, resolve_senator

REPO_URL = "https://github.com/Arzuparreta/espana-transparente"
SENATE_TERMS_URL = "https://www.senado.es/web/relacionesciudadanos/datosabiertos/index.html"


class _RowsCursor:
    """Minimal cursor so the production matcher runs over API rows unchanged."""

    def __init__(self, rows):
        self._rows = rows

    def execute(self, *_args, **_kwargs):
        return None

    def fetchall(self):
        return self._rows


def fetch_public_senators(base_url: str, anon_key: str) -> list[tuple]:
    params = {
        "select": "id,full_name,first_name,last_name,senate_id,"
                  "politician_memberships!inner(chamber,legislatures!inner(number))",
        "politician_memberships.chamber": "eq.senate",
        "politician_memberships.legislatures.number": "eq.15",
        "order": "id",
    }
    headers = {"apikey": anon_key, "Authorization": f"Bearer {anon_key}"}
    rows, start, page = [], 0, 1000
    with httpx.Client(timeout=60) as client:
        while True:
            response = client.get(
                f"{base_url.rstrip('/')}/rest/v1/politicians", params=params,
                headers={**headers, "Range": f"{start}-{start + page - 1}"},
            )
            response.raise_for_status()
            batch = response.json()
            rows.extend(batch)
            if len(batch) < page:
                break
            start += page
    unique = {r["id"]: (r["id"], r["full_name"], r["first_name"], r["last_name"], r["senate_id"])
              for r in rows}
    if not unique:
        raise RuntimeError("The public API returned no XV Senate members")
    return list(unique.values())


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def git_commit() -> str:
    try:
        return subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True, text=True,
                              check=True).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        return "desconocido"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--payload", required=True, help="Directory from --export-directory")
    parser.add_argument("--out", required=True, help="Empty output directory")
    args = parser.parse_args()

    payload_dir, out = Path(args.payload), Path(args.out)
    if out.exists() and any(out.iterdir()):
        raise SystemExit(f"{out} is not empty")
    out.mkdir(parents=True, exist_ok=True)

    # load_payload re-verifies coverage, URLs, session identity and SHA-256.
    payload = load_payload(payload_dir)
    manifest = json.loads((payload_dir / "manifest.json").read_text(encoding="utf-8"))
    fetched_at = manifest["fetched_at"]
    sha_by_url = {entry["url"]: entry["sha256"] for entry in manifest["sessions"]}

    senators = fetch_public_senators(os.environ["SUPABASE_URL"], os.environ["SUPABASE_ANON_KEY"])
    index = build_senator_index(_RowsCursor(senators))
    senate_id_by_pid = {pid: sid for pid, _f, _fn, _ln, sid in senators}

    (out / "xml").mkdir()
    for entry in manifest["sessions"]:
        shutil.copy2(payload_dir / entry["file"], out / "xml" / entry["file"])
    shutil.copy2(payload_dir / "manifest.json", out / "xml" / "manifest.json")

    votation_cols = [
        "legislatura", "num_sesion", "fecha_sesion", "num_votacion", "cod_votacion",
        "num_expediente", "titulo", "subtitulo", "fecha_votacion", "hora_votacion",
        "tot_presentes", "tot_afirmativos", "tot_negativos", "tot_abstenciones",
        "tot_no_votan", "tot_nulos", "tot_ausentes", "filas_nominales",
        "filas_vinculadas", "url_oficial", "sha256_xml", "descargado_en",
    ]
    vote_cols = [
        "legislatura", "num_sesion", "fecha_sesion", "num_votacion", "cod_votacion",
        "nombre_oficial", "escano", "grupo", "voto", "ausente", "clave_fila",
        "vinculado", "senate_id", "et_politician_id", "url_oficial",
    ]
    totals = Counter()
    with (out / "votaciones.csv").open("w", newline="", encoding="utf-8") as vf, \
         (out / "votos_nominales.csv").open("w", newline="", encoding="utf-8") as nf:
        vw = csv.DictWriter(vf, fieldnames=votation_cols)
        nw = csv.DictWriter(nf, fieldnames=vote_cols)
        vw.writeheader()
        nw.writeheader()
        for url, votations in payload.items():
            for v in votations:
                linked = 0
                seen = set()
                for row in v.votes:
                    pid = resolve_senator(row.name, index)
                    if pid in seen:
                        raise RuntimeError(f"Two rows resolve to one senator in {url} #{v.votation_number}")
                    if pid:
                        seen.add(pid)
                        linked += 1
                    nw.writerow({
                        "legislatura": 15, "num_sesion": v.session_number,
                        "fecha_sesion": v.session_date, "num_votacion": v.votation_number,
                        "cod_votacion": v.code or "", "nombre_oficial": row.name,
                        "escano": row.seat or "", "grupo": row.group or "", "voto": row.vote,
                        "ausente": str(row.absent).lower(),
                        "clave_fila": f"{v.session_number}:{v.votation_number}:{row.seat or ''}:{normalize_name(row.name)}",
                        "vinculado": str(bool(pid)).lower(),
                        "senate_id": senate_id_by_pid.get(pid) or "" if pid else "",
                        "et_politician_id": pid or "", "url_oficial": url,
                    })
                totals["votations"] += 1
                totals["rows"] += len(v.votes)
                totals["linked"] += linked
                vw.writerow({
                    "legislatura": 15, "num_sesion": v.session_number,
                    "fecha_sesion": v.session_date, "num_votacion": v.votation_number,
                    "cod_votacion": v.code or "", "num_expediente": v.initiative_number or "",
                    "titulo": v.title, "subtitulo": v.subtitle or "",
                    "fecha_votacion": v.vote_date or "", "hora_votacion": v.vote_time or "",
                    **{f"tot_{k}": n for k, n in v.totals.items()},
                    "filas_nominales": len(v.votes), "filas_vinculadas": linked,
                    "url_oficial": url, "sha256_xml": sha_by_url[url], "descargado_en": fetched_at,
                })

    commit = git_commit()
    generated = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    sessions = len(manifest["sessions"])
    unlinked = totals["rows"] - totals["linked"]
    (out / "LEEME.md").write_text(f"""# Votaciones nominales del Senado — XV Legislatura

Copia de reutilización publicada por España Transparente ({REPO_URL}).

## Fuente y licencia

- **Fuente original: Senado de España**, portal de datos abiertos
  ({SENATE_TERMS_URL}), ficheros `https://www.senado.es/legis15/votaciones/ses_N.xml`.
- Licencia de los datos: **CC BY 4.0**, según las condiciones de reutilización
  del Senado. Al reutilizarlos hay que citar al Senado como fuente, indicar la
  fecha de actualización y no sugerir que el Senado patrocina o respalda la
  reutilización.
- Esta copia no está respaldada ni avalada por el Senado. España Transparente
  es solo la fuente de la copia.

## Procedencia

- Descarga de los XML oficiales: {fetched_at} (UTC).
- Paquete generado: {generated} (UTC), desde el commit `{commit}`
  ({REPO_URL}/commit/{commit}).
- Exportador oficial: `etl/src/senado/payload.py`; este paquete:
  `etl/scripts/export_senate_votes_release.py`.

## Contenido

| Fichero | Qué es |
|---|---|
| `xml/ses_N.xml` | XML oficiales del Senado **byte a byte, sin modificar** ({sessions} sesiones) |
| `xml/manifest.json` | URL oficial y SHA-256 de cada XML, URLs descubiertas y enlaces del catálogo que devuelven 404 |
| `votaciones.csv` | Una fila por votación ({totals['votations']}) |
| `votos_nominales.csv` | Una fila por voto nominal oficial ({totals['rows']}){f", incluidas las {unlinked} sin vincular" if unlinked else ", todas vinculadas"} |
| `SHA256SUMS` | Checksums de todos los ficheros del paquete |

Los CSV son **derivados** de los XML: las etiquetas de voto se normalizan a
`Sí`, `No`, `Abstención`, `No vota`; las fechas a ISO 8601; las ausencias
(`<ausentes>`) se exportan como `voto = No vota` con `ausente = true`. Ante
cualquier duda prevalece el XML oficial.

## Vinculación de personas

El XML del Senado identifica a cada senador por nombre, escaño y grupo, sin
identificador. España Transparente vincula cada fila con una persona solo si el
nombre resuelve **sin ambigüedad**. Las filas que no lo hacen salen con
`vinculado = false` y los identificadores vacíos. No se atribuyen
automáticamente: quien las reutilice debe tratarlas como candidatas.

- `senate_id`: identificador oficial del Senado de la persona vinculada (si lo tenemos).
- `et_politician_id`: identificador interno de España Transparente.
- `clave_fila`: `sesión:votación:escaño:nombre_normalizado`, estable entre ejecuciones.

Totales: {totals['votations']} votaciones, {totals['rows']} filas nominales,
{totals['linked']} vinculadas, {unlinked} sin vincular.

## Cómo citar

> Fuente: Senado de España, datos abiertos (CC BY 4.0), XML descargados el
> {fetched_at[:10]}. Copia: España Transparente, {REPO_URL}, commit `{commit[:12]}`.
""", encoding="utf-8")

    files = sorted(p for p in out.rglob("*") if p.is_file())
    (out / "SHA256SUMS").write_text(
        "".join(f"{sha256(p)}  {p.relative_to(out).as_posix()}\n" for p in files), encoding="utf-8")
    print(json.dumps({"sessions": sessions, **totals, "unlinked": unlinked,
                      "senators_in_index": len(senators), "commit": commit}))


if __name__ == "__main__":
    main()
