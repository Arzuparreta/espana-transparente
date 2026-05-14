"""ETL script: ingest subsidies from BDNS (Base de Datos Nacional de Subvenciones).

Fetches concesiones by date range. Filters are applied client-side:
  - Only organizational beneficiaries (individuals are anonymized with asterisks)
  - Optional minimum amount (--importe-min)

The BDNS API does not support reliable server-side amount filtering or sorting by
importe on large date ranges (causes timeouts). Date filtering is reliable.

Usage:
    PYTHONPATH=src python -m src.bdns.subvenciones                          # last 30 days
    PYTHONPATH=src python -m src.bdns.subvenciones --from-date 2025-01-01 --to-date 2025-01-31
    PYTHONPATH=src python -m src.bdns.subvenciones --importe-min 10000 --dry-run
"""

import argparse
import time
from datetime import date, timedelta

import httpx
import psycopg2.extras
from common.db import get_pg_conn

BDNS_API = "https://www.infosubvenciones.es/bdnstrans/api/concesiones/busqueda"
PAGE_SIZE = 200
REQUEST_DELAY = 1.0


def _is_organization(beneficiario: str | None) -> bool:
    if not beneficiario:
        return False
    return not beneficiario.startswith("*")


def fetch_page(from_date: str, to_date: str, page: int) -> dict:
    resp = httpx.get(
        BDNS_API,
        params={
            "pageSize": PAGE_SIZE,
            "pageNumber": page,
            "fechaDesde": from_date,
            "fechaHasta": to_date,
        },
        headers={"User-Agent": "AccionHumana/1.0 (+https://accion-humana.es)"},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def parse_record(raw: dict, importe_min: float) -> dict | None:
    if not _is_organization(raw.get("beneficiario")):
        return None
    if (raw.get("importe") or 0) < importe_min:
        return None
    return {
        "bdns_id": raw["id"],
        "cod_concesion": raw.get("codConcesion"),
        "fecha_concesion": raw.get("fechaConcesion"),
        "beneficiario": raw.get("beneficiario"),
        "instrumento": (raw.get("instrumento") or "").strip() or None,
        "importe": raw.get("importe"),
        "convocatoria": raw.get("convocatoria"),
        "numero_convocatoria": raw.get("numeroConvocatoria"),
        "nivel1": raw.get("nivel1"),
        "nivel2": raw.get("nivel2"),
        "nivel3": raw.get("nivel3"),
        "source_url": raw.get("urlBR"),
    }


def upsert(conn, records: list[dict]) -> int:
    if not records:
        return 0
    cur = conn.cursor()
    psycopg2.extras.execute_values(
        cur,
        """
        INSERT INTO subsidies
          (bdns_id, cod_concesion, fecha_concesion, beneficiario, instrumento,
           importe, convocatoria, numero_convocatoria, nivel1, nivel2, nivel3, source_url)
        VALUES %s
        ON CONFLICT (bdns_id) DO UPDATE SET
          cod_concesion       = EXCLUDED.cod_concesion,
          fecha_concesion     = EXCLUDED.fecha_concesion,
          beneficiario        = EXCLUDED.beneficiario,
          instrumento         = EXCLUDED.instrumento,
          importe             = EXCLUDED.importe,
          convocatoria        = EXCLUDED.convocatoria,
          numero_convocatoria = EXCLUDED.numero_convocatoria,
          nivel1              = EXCLUDED.nivel1,
          nivel2              = EXCLUDED.nivel2,
          nivel3              = EXCLUDED.nivel3,
          source_url          = EXCLUDED.source_url
        """,
        [
            (
                r["bdns_id"], r["cod_concesion"], r["fecha_concesion"], r["beneficiario"],
                r["instrumento"], r["importe"], r["convocatoria"], r["numero_convocatoria"],
                r["nivel1"], r["nivel2"], r["nivel3"], r["source_url"],
            )
            for r in records
        ],
    )
    conn.commit()
    cur.close()
    return len(records)


def run(from_date: str, to_date: str, importe_min: float, max_pages: int, dry_run: bool) -> None:
    print(f"BDNS | {from_date} → {to_date} | importe_min={importe_min:,.0f}€ | dry_run={dry_run}")
    conn = None if dry_run else get_pg_conn()

    total_fetched = 0
    total_upserted = 0

    for page in range(max_pages):
        data = fetch_page(from_date, to_date, page)
        content = data.get("content", [])
        if not content:
            break

        records = [r for raw in content if (r := parse_record(raw, importe_min)) is not None]
        total_fetched += len(content)

        if not dry_run and records:
            total_upserted += upsert(conn, records)

        total_api = data.get("totalElements", "?")
        print(f"  page {page:4d} | fetched {len(content):3d} | kept {len(records):3d} | upserted {total_upserted} | API total {total_api}")

        if data.get("last", False):
            break

        time.sleep(REQUEST_DELAY)

    if conn:
        conn.close()

    print(f"\nDone. Scanned {total_fetched} rows, upserted {total_upserted}.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest BDNS subsidies")
    today = date.today()
    parser.add_argument("--from-date", default=(today - timedelta(days=30)).isoformat(), help="YYYY-MM-DD")
    parser.add_argument("--to-date", default=today.isoformat(), help="YYYY-MM-DD")
    parser.add_argument("--importe-min", type=float, default=10_000, help="Min grant amount in EUR (client-side filter, default: 10000)")
    parser.add_argument("--max-pages", type=int, default=500, help="Safety cap on pages (default: 500 = 100K rows)")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    def to_api_date(iso: str) -> str:
        return date.fromisoformat(iso).strftime("%d/%m/%Y")

    run(
        from_date=to_api_date(args.from_date),
        to_date=to_api_date(args.to_date),
        importe_min=args.importe_min,
        max_pages=args.max_pages,
        dry_run=args.dry_run,
    )


if __name__ == "__main__":
    main()
