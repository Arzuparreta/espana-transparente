"""ETL: ingest deputies' wealth, economic-interests, and activity declarations.

Each Spanish deputy publishes three kinds of declarations:

  - Declaración de Bienes y Rentas       -> /docbienes/leg15/<cod>/<file>.pdf
  - Declaración de Intereses Económicos  -> /docacteco/leg15/<cod>/<file>.pdf
  - Declaración de Actividades           -> /docinte/registro_intereses_diputado_{cod}.pdf

The first two are discovered by scraping the deputy's ficha page (multiple
versioned PDFs per type, date-stamped in the URL). The third is a single
document per deputy at a deterministic URL (updated in-place by the Congress,
no date in the URL, no version history).

Usage:
    PYTHONPATH=src python -m src.congreso.declaraciones --dry-run
    PYTHONPATH=src python -m src.congreso.declaraciones
    PYTHONPATH=src python -m src.congreso.declaraciones --cod 126
    PYTHONPATH=src python -m src.congreso.declaraciones --skip-actividades
"""

import argparse
import re
import subprocess
import time
from datetime import datetime, timezone

import psycopg2.extras

from common.db import get_pg_conn

CONGRESO_BASE = "https://www.congreso.es"
FICHA_URL = (
    f"{CONGRESO_BASE}/es/busqueda-de-diputados"
    "?p_p_id=diputadomodule&p_p_lifecycle=0&p_p_state=normal&p_p_mode=view"
    "&_diputadomodule_mostrarFicha=true"
    "&codParlamentario={cod}&idLegislatura=XV"
)
ACTIVIDADES_URL = f"{CONGRESO_BASE}/docinte/registro_intereses_diputado_{{cod}}.pdf"

UA = "Mozilla/5.0 (compatible; AccionHumana/1.0)"
REQUEST_DELAY = 1.5  # seconds between deputies — Congress rate-limits

DECLARATION_PATH_RE = re.compile(
    r"/(?P<kind>docbienes|docacteco)/leg15/(?P<intcod>\d{6})/"
    r"\d{6}_\d{3}_e_\d{7}_(?P<date>\d{8})\.pdf",
)

KIND_LABEL = {
    "docbienes": "bienes_rentas",
    "docacteco": "intereses_economicos",
}


def curl_text(url: str) -> str:
    result = subprocess.run(
        ["curl", "-sL", "-H", f"User-Agent: {UA}", url],
        capture_output=True, text=True, timeout=30,
    )
    if result.returncode != 0:
        raise RuntimeError(f"curl failed: {result.stderr}")
    return result.stdout


def check_actividades_url(cod: str) -> str | None:
    """Return the actividades PDF URL if it exists for this deputy, else None."""
    url = ACTIVIDADES_URL.format(cod=cod)
    result = subprocess.run(
        ["curl", "-sI", "--max-time", "15", "-H", f"User-Agent: {UA}", url],
        capture_output=True, text=True, timeout=20,
    )
    if result.returncode != 0:
        return None
    first_line = result.stdout.splitlines()[0] if result.stdout else ""
    if any(f" {code} " in first_line for code in ("200", "302")):
        return url
    return None


def cod_from_photo_url(photo_url: str | None) -> str | None:
    if not photo_url:
        return None
    match = re.search(r"/diputados/(\d+)\.jpg", photo_url)
    return match.group(1) if match else None


def parse_declarations(html: str) -> list[dict]:
    """Return one dict per declaration PDF found in the ficha HTML."""
    decls = []
    for match in DECLARATION_PATH_RE.finditer(html):
        path = match.group(0)
        date_raw = match.group("date")
        decls.append({
            "kind": KIND_LABEL[match.group("kind")],
            "internal_cod": match.group("intcod"),
            "declaration_date": f"{date_raw[:4]}-{date_raw[4:6]}-{date_raw[6:]}",
            "source_url": f"{CONGRESO_BASE}{path}",
            "filename": path.rsplit("/", 1)[-1],
        })
    return decls


def fetch_politicians(cur, only_cod: str | None) -> list[tuple]:
    if only_cod:
        cur.execute(
            "SELECT id, full_name, cod_parlamentario FROM politicians "
            "WHERE cod_parlamentario = %s",
            (only_cod,),
        )
    else:
        cur.execute(
            "SELECT id, full_name, cod_parlamentario FROM politicians "
            "WHERE cod_parlamentario IS NOT NULL ORDER BY full_name",
        )
    return cur.fetchall()


def upsert_declaration(cur, pol_id, leg_id, declaration_date, source_url, payload):
    cur.execute(
        """
        INSERT INTO economic_declarations
            (politician_id, legislature_id, declaration_date, source_url, raw_data)
        VALUES (%s, %s, %s, %s, %s)
        ON CONFLICT (source_url) WHERE source_url IS NOT NULL DO UPDATE SET
            politician_id = EXCLUDED.politician_id,
            legislature_id = EXCLUDED.legislature_id,
            declaration_date = EXCLUDED.declaration_date,
            raw_data = EXCLUDED.raw_data
        """,
        (pol_id, leg_id, declaration_date, source_url, psycopg2.extras.Json(payload)),
    )
    return cur.rowcount


def run(
    dry_run: bool = False,
    only_cod: str | None = None,
    skip_actividades: bool = False,
) -> None:
    conn = get_pg_conn()
    cur = conn.cursor()

    cur.execute("SELECT id FROM legislatures WHERE number = 15")
    row = cur.fetchone()
    if not row:
        raise SystemExit("Legislature XV not found. Run diputados first.")
    leg_id = row[0]

    politicians = fetch_politicians(cur, only_cod)
    print(f"Scanning {len(politicians)} politicians for declarations...")

    inserted = 0
    no_cod = 0
    no_decls = 0
    actividades_found = 0

    for i, (pol_id, full_name, cod) in enumerate(politicians, start=1):
        if not cod:
            no_cod += 1
            continue

        if i > 1:
            time.sleep(REQUEST_DELAY)
        print(f"[{i}/{len(politicians)}] {full_name} (cod={cod})", end=" ", flush=True)

        try:
            html = curl_text(FICHA_URL.format(cod=cod))
        except RuntimeError as exc:
            print(f"FETCH ERROR: {exc}")
            continue

        decls = parse_declarations(html)
        decl_count = 0

        for d in decls:
            payload = {
                "type": d["kind"],
                "filename": d["filename"],
                "internal_cod": d["internal_cod"],
            }
            if not dry_run:
                inserted += upsert_declaration(
                    cur, pol_id, leg_id, d["declaration_date"], d["source_url"], payload,
                )
            decl_count += 1

        # Actividades: single deterministic URL per deputy, updated in-place
        if not skip_actividades:
            time.sleep(REQUEST_DELAY)
            act_url = check_actividades_url(cod)
            if act_url:
                actividades_found += 1
                payload = {
                    "type": "actividades",
                    "fetched_at": datetime.now(timezone.utc).isoformat(),
                }
                if not dry_run:
                    inserted += upsert_declaration(
                        cur, pol_id, leg_id, None, act_url, payload,
                    )
                decl_count += 1

        if not dry_run:
            conn.commit()

        if decl_count == 0:
            no_decls += 1
            print("no declarations")
        else:
            print(f"{decl_count} decl.")

    cur.close()
    conn.close()
    act_summary = "" if skip_actividades else f", {actividades_found} actividades"
    print(
        f"\nDone! {inserted} upserts, "
        f"{no_cod} without cod_parlamentario, {no_decls} without declarations"
        f"{act_summary}.",
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--cod", help="Process only the deputy with this codParlamentario")
    parser.add_argument(
        "--skip-actividades",
        action="store_true",
        help="Skip the actividades HEAD-check (faster runs when only updating bienes/intereses)",
    )
    args = parser.parse_args()
    run(dry_run=args.dry_run, only_cod=args.cod, skip_actividades=args.skip_actividades)


if __name__ == "__main__":
    main()
