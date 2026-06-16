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
import json
import time
from datetime import date, timedelta

import httpx
import psycopg2.extras
from common.db import get_pg_conn
from common.etl_runs import finish_run, is_chunk_succeeded, start_run
from common.organizations import upsert_organization
from common.responsibility import administration_level_from_bdns, iter_date_chunks, normalize_public_body
from common.utils import normalize_ministry

BDNS_API = "https://www.infosubvenciones.es/bdnstrans/api/concesiones/busqueda"
PAGE_SIZE = 200
REQUEST_DELAY = 1.0


def _is_organization(beneficiario: str | None) -> bool:
    if not beneficiario:
        return False
    return not beneficiario.startswith("*")


def fetch_page(from_date: str, to_date: str, page: int, retries: int = 5) -> dict:
    from_api = date.fromisoformat(from_date).strftime("%d/%m/%Y")
    to_api = date.fromisoformat(to_date).strftime("%d/%m/%Y")
    for attempt in range(retries):
        try:
            resp = httpx.get(
                BDNS_API,
                params={
                    "pageSize": PAGE_SIZE,
                    "page": page,
                    "fechaDesde": from_api,
                    "fechaHasta": to_api,
                },
                headers={"User-Agent": "EspanaTransparente/1.0 (+https://spaintransparencia.info)"},
                timeout=60,
            )
            resp.raise_for_status()
        except (httpx.TimeoutException, httpx.TransportError):
            if attempt == retries - 1:
                raise
            time.sleep(10 * (attempt + 1))
            continue
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code < 500 or attempt == retries - 1:
                raise
            time.sleep(10 * (attempt + 1))
            continue
        try:
            return resp.json()
        except UnicodeDecodeError:
            # BDNS occasionally serves a page in Latin-1 without declaring the charset.
            return json.loads(resp.content.decode("latin-1"))
        except json.JSONDecodeError:
            if attempt == retries - 1:
                raise
            # BDNS occasionally returns an empty/non-JSON body; back off and retry.
            time.sleep(5 * (attempt + 1))
            continue
    raise RuntimeError("BDNS request retry loop exhausted")


def parse_record(raw: dict, importe_min: float) -> dict | None:
    if not _is_organization(raw.get("beneficiario")):
        return None
    if (raw.get("importe") or 0) < importe_min:
        return None
    nivel1 = raw.get("nivel1")
    nivel2 = raw.get("nivel2")
    nivel2_clean = (nivel2 or "").strip().lower()
    # BDNS sometimes tags pan-Spain grants as AUTONOMICA with nivel2="España".
    # Those have no meaningful CCAA, so treat them as state-level.
    if nivel1 == "AUTONOMICA" and nivel2_clean in ("españa", "espana", ""):
        admin_level = "state"
    else:
        admin_level = administration_level_from_bdns(nivel1)
    return {
        "bdns_id": raw["id"],
        "cod_concesion": raw.get("codConcesion"),
        "fecha_concesion": raw.get("fechaConcesion"),
        "beneficiario": raw.get("beneficiario"),
        "instrumento": (raw.get("instrumento") or "").strip() or None,
        "importe": raw.get("importe"),
        "convocatoria": raw.get("convocatoria"),
        "numero_convocatoria": raw.get("numeroConvocatoria"),
        "nivel1": nivel1,
        "nivel2": nivel2,
        "nivel3": raw.get("nivel3"),
        "granting_body_normalized": normalize_public_body(raw.get("nivel3")),
        "beneficiary_normalized": normalize_public_body(raw.get("beneficiario")),
        "ministry_normalized": normalize_ministry(nivel2) if nivel1 == "ESTADO" else None,
        "administration_level": admin_level,
        "beneficiary_organization_id": None,
        "granting_body_organization_id": None,
        "source_url": raw.get("urlBR"),
    }


def upsert(conn, records: list[dict]) -> int:
    if not records:
        return 0
    cur = conn.cursor()
    for record in records:
        if record["beneficiario"]:
            record["beneficiary_organization_id"] = upsert_organization(
                cur,
                name=record["beneficiario"],
                organization_type="other",
                source_url=record["source_url"],
            )
        if record["nivel3"]:
            record["granting_body_organization_id"] = upsert_organization(
                cur,
                name=record["nivel3"],
                organization_type="public_body",
                source_url=record["source_url"],
            )
    psycopg2.extras.execute_values(
        cur,
        """
        INSERT INTO subsidies
          (bdns_id, cod_concesion, fecha_concesion, beneficiario, instrumento,
           importe, convocatoria, numero_convocatoria, nivel1, nivel2, nivel3,
           ministry_normalized, granting_body_normalized, beneficiary_normalized, administration_level,
           beneficiary_organization_id, granting_body_organization_id, source_url)
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
          ministry_normalized = EXCLUDED.ministry_normalized,
          granting_body_normalized = EXCLUDED.granting_body_normalized,
          beneficiary_normalized = EXCLUDED.beneficiary_normalized,
          administration_level = coalesce(EXCLUDED.administration_level, subsidies.administration_level),
          beneficiary_organization_id = coalesce(
            EXCLUDED.beneficiary_organization_id,
            subsidies.beneficiary_organization_id
          ),
          granting_body_organization_id = coalesce(
            EXCLUDED.granting_body_organization_id,
            subsidies.granting_body_organization_id
          ),
          source_url          = EXCLUDED.source_url
        """,
        [
            (
                r["bdns_id"], r["cod_concesion"], r["fecha_concesion"], r["beneficiario"],
                r["instrumento"], r["importe"], r["convocatoria"], r["numero_convocatoria"],
                r["nivel1"], r["nivel2"], r["nivel3"], r["ministry_normalized"],
                r["granting_body_normalized"], r["beneficiary_normalized"], r["administration_level"],
                r["beneficiary_organization_id"], r["granting_body_organization_id"], r["source_url"],
            )
            for r in records
        ],
    )
    conn.commit()
    cur.close()
    return len(records)


def run_window(
    *,
    from_date: str,
    to_date: str,
    importe_min: float,
    max_pages: int,
    dry_run: bool,
    resume: bool,
) -> tuple[int, int]:
    print(f"BDNS | {from_date} → {to_date} | importe_min={importe_min:,.0f}€ | dry_run={dry_run}")
    conn = None if dry_run else get_pg_conn()
    cur = conn.cursor() if conn else None
    window_start = date.fromisoformat(from_date)
    window_end = date.fromisoformat(to_date)
    chunk_key = f"{window_start.isoformat()}:{window_end.isoformat()}"

    if cur and resume and is_chunk_succeeded(
        cur,
        pipeline="subsidies_backfill" if window_start < date.today() - timedelta(days=31) else "subsidies_daily",
        chunk_key=chunk_key,
        window_start=window_start,
        window_end=window_end,
    ):
        print(f"Skipping {chunk_key}: already succeeded")
        cur.close()
        conn.close()
        return 0, 0

    run_id = None
    pipeline = "subsidies_backfill" if window_start < date.today() - timedelta(days=31) else "subsidies_daily"
    if cur:
        run_id = start_run(
            cur,
            pipeline=pipeline,
            chunk_key=chunk_key,
            window_start=window_start,
            window_end=window_end,
        )
        conn.commit()
        cur.close()

    total_fetched = 0
    total_upserted = 0

    try:
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

        if conn and run_id:
            cur = conn.cursor()
            finish_run(
                cur,
                run_id=run_id,
                status="succeeded",
                rows_read=total_fetched,
                rows_inserted=total_upserted,
            )
            conn.commit()
            cur.close()
    except Exception as exc:
        if conn and run_id:
            cur = conn.cursor()
            finish_run(
                cur,
                run_id=run_id,
                status="failed",
                rows_read=total_fetched,
                rows_inserted=total_upserted,
                error_summary=str(exc)[:500],
            )
            conn.commit()
            cur.close()
        raise

    if conn:
        conn.close()

    print(f"\nDone. Scanned {total_fetched} rows, upserted {total_upserted}.")
    return total_fetched, total_upserted


def run_backfill(
    *,
    start_date: date,
    end_date: date,
    chunk_days: int,
    importe_min: float,
    max_pages: int,
    dry_run: bool,
    resume: bool,
) -> None:
    for chunk_start, chunk_end in iter_date_chunks(start_date, end_date, chunk_days):
        print(f"\n== subsidies {chunk_start} → {chunk_end} ==")
        run_window(
            from_date=chunk_start.isoformat(),
            to_date=chunk_end.isoformat(),
            importe_min=importe_min,
            max_pages=max_pages,
            dry_run=dry_run,
            resume=resume,
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest BDNS subsidies")
    today = date.today()
    parser.add_argument("--from-date", default=(today - timedelta(days=30)).isoformat(), help="YYYY-MM-DD")
    parser.add_argument("--to-date", default=today.isoformat(), help="YYYY-MM-DD")
    parser.add_argument("--importe-min", type=float, default=10_000, help="Min grant amount in EUR (client-side filter, default: 10000)")
    parser.add_argument("--max-pages", type=int, default=500, help="Safety cap on pages (default: 500 = 100K rows)")
    parser.add_argument("--chunk-days", type=int, default=31, help="Chunk size for resumable historical backfill")
    parser.add_argument("--resume", action="store_true", help="Skip chunks already marked as succeeded in etl_runs")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    start = date.fromisoformat(args.from_date)
    end = date.fromisoformat(args.to_date)
    if args.chunk_days and (end - start).days + 1 > args.chunk_days:
        run_backfill(
            start_date=start,
            end_date=end,
            chunk_days=args.chunk_days,
            importe_min=args.importe_min,
            max_pages=args.max_pages,
            dry_run=args.dry_run,
            resume=args.resume,
        )
        return

    run_window(
        from_date=start.isoformat(),
        to_date=end.isoformat(),
        importe_min=args.importe_min,
        max_pages=args.max_pages,
        dry_run=args.dry_run,
        resume=args.resume,
    )


if __name__ == "__main__":
    main()
