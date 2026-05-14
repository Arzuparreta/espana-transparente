"""ETL: ingest deputies' wealth and economic-interests declarations.

Each Spanish deputy publishes two kinds of declarations during a
legislature, both linked from their public ficha:

  - Declaración de Bienes y Rentas       -> /docbienes/leg15/<cod>/<file>.pdf
  - Declaración de Intereses Económicos  -> /docacteco/leg15/<cod>/<file>.pdf

Deputies may update either over time (e.g. on appointment changes), so
multiple PDFs per type are normal. The internal six-digit cod inside the
URL is per-document, not per-deputy — the only reliable way to discover
a deputy's PDFs is to scrape their ficha page.

Usage:
    PYTHONPATH=src python -m src.congreso.declaraciones --dry-run
    PYTHONPATH=src python -m src.congreso.declaraciones
    PYTHONPATH=src python -m src.congreso.declaraciones --cod 126
"""

import argparse
import re
import subprocess
import time

import psycopg2.extras

from common.db import get_pg_conn

CONGRESO_BASE = "https://www.congreso.es"
FICHA_URL = (
    f"{CONGRESO_BASE}/es/busqueda-de-diputados"
    "?p_p_id=diputadomodule&p_p_lifecycle=0&p_p_state=normal&p_p_mode=view"
    "&_diputadomodule_mostrarFicha=true"
    "&codParlamentario={cod}&idLegislatura=XV"
)

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
            "SELECT id, full_name, photo_url FROM politicians "
            "WHERE photo_url LIKE %s",
            (f"%/diputados/{only_cod}.jpg",),
        )
    else:
        cur.execute(
            "SELECT id, full_name, photo_url FROM politicians "
            "WHERE photo_url IS NOT NULL ORDER BY full_name",
        )
    return cur.fetchall()


def run(dry_run: bool = False, only_cod: str | None = None) -> None:
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
    skipped = 0
    no_cod = 0
    no_decls = 0

    for i, (pol_id, full_name, photo_url) in enumerate(politicians, start=1):
        cod = cod_from_photo_url(photo_url)
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
        if not decls:
            no_decls += 1
            print("no declarations")
            continue

        for d in decls:
            payload = {
                "type": d["kind"],
                "filename": d["filename"],
                "internal_cod": d["internal_cod"],
            }
            if dry_run:
                continue
            cur.execute(
                """
                INSERT INTO economic_declarations
                    (politician_id, legislature_id, declaration_date, source_url, raw_data)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (source_url) DO UPDATE SET
                    politician_id = EXCLUDED.politician_id,
                    legislature_id = EXCLUDED.legislature_id,
                    declaration_date = EXCLUDED.declaration_date,
                    raw_data = EXCLUDED.raw_data
                """,
                (pol_id, leg_id, d["declaration_date"], d["source_url"],
                 psycopg2.extras.Json(payload)),
            )
            inserted += cur.rowcount

        if not dry_run:
            conn.commit()
        print(f"{len(decls)} decl.")

    cur.close()
    conn.close()
    print(
        f"\nDone! {inserted} upserts, {skipped} skipped, "
        f"{no_cod} without cod_parlamentario, {no_decls} without declarations.",
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--cod", help="Process only the deputy with this codParlamentario")
    args = parser.parse_args()
    run(dry_run=args.dry_run, only_cod=args.cod)


if __name__ == "__main__":
    main()
