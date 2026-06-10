"""ETL: ingest IPC subgroups (COICOP) from INE API.

Ingests the 13 national COICOP subgroup index series (base 2025 = 100).
These power the "tu cesta" personalized inflation calculator.

Usage:
    PYTHONPATH=src python -m src.ine.ipc_subgrupos
    PYTHONPATH=src python -m src.ine.ipc_subgrupos --dry-run
"""

from __future__ import annotations

import argparse
import json
import subprocess
from typing import Any

from common.db import get_pg_conn
from common.etl_runs import finish_run, start_run

# INE Tempus3 series codes for COICOP subgroups (table 76125, base 2025).
# Discovered via SERIES_TABLA endpoint on 2026-06-05.
SUBGROUPS: dict[str, dict[str, str]] = {
    "IPC290751": {"code": "IPC", "name": "IPC — Índice general"},
    "IPC290755": {"code": "IPC_ALIMENTOS", "name": "IPC — Alimentos y bebidas no alcohólicas"},
    "IPC290779": {"code": "IPC_BEBIDAS_TABACO", "name": "IPC — Bebidas alcohólicas y tabaco"},
    "IPC290759": {"code": "IPC_VESTIDO", "name": "IPC — Vestido y calzado"},
    "IPC290763": {"code": "IPC_VIVIENDA", "name": "IPC — Vivienda, agua, electricidad, gas y otros combustibles"},
    "IPC290767": {"code": "IPC_HOGAR", "name": "IPC — Muebles, artículos del hogar y mantenimiento corriente"},
    "IPC290771": {"code": "IPC_SANIDAD", "name": "IPC — Sanidad"},
    "IPC290775": {"code": "IPC_TRANSPORTE", "name": "IPC — Transporte"},
    "IPC290783": {"code": "IPC_COMUNICACIONES", "name": "IPC — Información y comunicaciones"},
    "IPC290787": {"code": "IPC_OCIO", "name": "IPC — Actividades recreativas, deporte y cultura"},
    "IPC290791": {"code": "IPC_ENSENANZA", "name": "IPC — Enseñanza"},
    "IPC290795": {"code": "IPC_RESTAURANTES", "name": "IPC — Restaurantes y servicios de alojamiento"},
    "IPC290799": {"code": "IPC_SEGUROS", "name": "IPC — Seguros y servicios financieros"},
    "IPC290803": {"code": "IPC_DIVERSOS", "name": "IPC — Cuidado personal, protección social y bienes y servicios diversos"},
}


def fetch_json(url: str) -> Any:
    result = subprocess.run(
        ["curl", "-sL", url],
        capture_output=True,
        timeout=30,
        check=True,
    )
    try:
        payload = result.stdout.decode("utf-8")
    except UnicodeDecodeError:
        payload = result.stdout.decode("latin-1")
    return json.loads(payload)


def parse_period(point: dict) -> str | None:
    year = point.get("Anyo")
    period = point.get("FK_Periodo")

    if period is None:
        raw_period = point.get("T3_Periodo")
        if isinstance(raw_period, str) and raw_period.startswith("M"):
            period = int(raw_period[1:])

    if year is None or period is None:
        return None

    return f"{year}-{int(period):02d}"


def run(dry_run: bool = False) -> int:
    conn = get_pg_conn() if not dry_run else None
    cur = conn.cursor() if conn else None
    total_inserted = 0
    total_read = 0
    run_id = None

    try:
        if conn and cur:
            run_id = start_run(cur, pipeline="ine.ipc_subgrupos")
            conn.commit()

        for series_key, meta in SUBGROUPS.items():
            if dry_run:
                print(f"[DRY-RUN] Would fetch {meta['name']} ({series_key})")
                continue
            print(f"Fetching {meta['name']}...")
            url = f"https://servicios.ine.es/wstempus/js/ES/DATOS_SERIE/{series_key}?nult=240&tip=A"
            series = fetch_json(url)

            inserted = 0
            data_points = series.get("Data", [])
            total_read += len(data_points)
            for d in data_points:
                period_str = parse_period(d)
                value = d.get("Valor")
                if period_str is None or value is None:
                    continue

                if dry_run:
                    inserted += 1
                    continue

                if cur is None:
                    continue

                cur.execute("""
                    INSERT INTO economic_indicators (indicator_code, indicator_name, period, value, unit, raw_data)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (indicator_code, period) DO UPDATE SET
                        value = EXCLUDED.value,
                        unit = EXCLUDED.unit,
                        raw_data = EXCLUDED.raw_data
                """, (
                    meta["code"],
                    meta["name"],
                    period_str,
                    value,
                    "índice (base 2025=100)",
                    json.dumps({"source_series": series_key, "point": d}),
                ))
                inserted += 1

            if conn:
                conn.commit()
            print(f"  {inserted} data points")
            total_inserted += inserted

        if conn and cur and run_id:
            finish_run(cur, run_id=run_id, status="succeeded",
                       rows_read=total_read, rows_inserted=total_inserted)
            conn.commit()
    except Exception as exc:
        if conn and run_id:
            conn.rollback()
            with conn.cursor() as fail_cur:
                finish_run(fail_cur, run_id=run_id, status="failed", error_summary=str(exc)[:500])
                conn.commit()
        raise
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

    print(f"Done! Upserted {total_inserted} data points across {len(SUBGROUPS)} series.")
    return total_inserted


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    run(dry_run=args.dry_run)
