"""ETL: ingest additional economic indicators from INE API.

Adds to the existing IPC indicators:
  - PIB (GDP) — quarterly, from Contabilidad Nacional Trimestral
  - PIB_VAR_ANUAL — annual GDP variation, quarterly
  - TASA_PARO — unemployment rate, from EPA (annual)
  - PARADOS — number of unemployed people, from EPA (quarterly)
  - SALARIO_MEDIO — average gross salary, from EAES (annual)

Usage:
    PYTHONPATH=src python -m src.ine.indicadores_ampliados
    PYTHONPATH=src python -m src.ine.indicadores_ampliados --dry-run
"""

from __future__ import annotations

import argparse
import json
import subprocess
from typing import Any

from common.db import get_pg_conn
from common.etl_runs import finish_run, start_run

# INE Tempus3 series codes discovered via the API's OPERACIONES_DISPONIBLES
# and TABLAS_OPERACION/SERIES_TABLA endpoints (2026-05-24).
INDICATORS: dict[str, dict[str, str]] = {
    # ── PIB (GDP) — Contabilidad Nacional Trimestral, base 2010 ──
    "CNTR6548": {
        "code": "PIB",
        "name": "PIB — Producto Interior Bruto a precios de mercado",
        "unit": "millones de euros (precios corrientes)",
    },
    "CNTR6551": {
        "code": "PIB_VAR_ANUAL",
        "name": "PIB — Variación anual",
        "unit": "%",
    },
    # ── Paro / Desempleo — Encuesta de Población Activa (EPA) ──
    "EPA667825": {
        "code": "TASA_PARO",
        "name": "Tasa de paro — EPA",
        "unit": "%",
    },
    "EPA426922": {
        "code": "PARADOS",
        "name": "Parados — EPA (valor absoluto)",
        "unit": "miles de personas",
    },
    # ── Salario medio — Encuesta Anual de Estructura Salarial ──
    "EAES354": {
        "code": "SALARIO_MEDIO",
        "name": "Salario medio bruto",
        "unit": "euros anuales",
    },
}


def fetch_json(url: str) -> Any:
    """Fetch JSON from INE Tempus API via curl (avoids httpx dependency)."""
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
    """Parse a Tempus3 data point into a 'YYYY-MM' or 'YYYY-QN' period string.

    Handles:
      - Monthly: FK_Periodo = M01..M12
      - Quarterly: T3_Periodo = T1..T4
      - Annual: T3_Periodo = A
    """
    year = point.get("Anyo")
    if year is None:
        return None

    # Try FK_Periodo (used by IPC monthly data)
    period = point.get("FK_Periodo")
    if period is not None:
        return f"{year}-{int(period):02d}"

    # Try T3_Periodo (quarterly T1-T4, annual A)
    raw_period = point.get("T3_Periodo")
    if isinstance(raw_period, str):
        if raw_period.startswith("T"):
            return f"{year}-{raw_period}"  # e.g. 2025-T3
        if raw_period == "A":
            return f"{year}-A"  # annual
        if raw_period.startswith("M"):
            return f"{year}-{int(raw_period[1:]):02d}"

    return f"{year}"


def run(dry_run: bool = False) -> dict[str, int]:
    """Ingest all indicators. Returns {indicator_code: rows_inserted}."""
    conn = get_pg_conn()
    cur = conn.cursor()
    results: dict[str, int] = {}
    run_id = None
    total_read = 0
    try:
        if not dry_run:
            run_id = start_run(cur, pipeline="ine.indicadores_ampliados")
            conn.commit()

        for series_id, meta in INDICATORS.items():
            url = f"https://servicios.ine.es/wstempus/js/ES/DATOS_SERIE/{series_id}?nult=500&tip=A"
            metadata_url = f"https://servicios.ine.es/wstempus/js/ES/SERIE/{series_id}?det=2&tip=A"

            if dry_run:
                print(f"[DRY-RUN] Would fetch {meta['name']} ({series_id})")
                results[meta["code"]] = 0
                continue

            print(f"Fetching {meta['name']} ({series_id})...")
            try:
                series_data = fetch_json(url)
                metadata = fetch_json(metadata_url)
            except Exception as exc:
                print(f"  ERROR fetching {series_id}: {exc}")
                results[meta["code"]] = 0
                continue

            data_points = series_data.get("Data", [])
            total_read += len(data_points)
            inserted = 0
            for point in data_points:
                period_str = parse_period(point)
                value = point.get("Valor")
                if period_str is None or value is None:
                    continue

                # Convert PIB from euros to millions of euros for readability
                if meta["code"] == "PIB" and isinstance(value, (int, float)):
                    value = round(value, 1)

                # PARADOS comes in thousands already, keep as-is
                if meta["code"] == "PARADOS" and isinstance(value, (int, float)):
                    value = round(value, 1)

                cur.execute(
                    """
                    INSERT INTO economic_indicators (indicator_code, indicator_name, period, value, unit, raw_data)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (indicator_code, period) DO UPDATE SET
                        value = EXCLUDED.value,
                        unit = EXCLUDED.unit,
                        raw_data = EXCLUDED.raw_data
                    """,
                    (
                        meta["code"],
                        meta["name"],
                        period_str,
                        value,
                        meta["unit"],
                        json.dumps(
                            {
                                "source_series": series_id,
                                "source_name": series_data.get("Nombre"),
                                "point": {k: str(v) for k, v in point.items()},
                            },
                            ensure_ascii=False,
                        ),
                    ),
                )
                inserted += 1

            conn.commit()
            results[meta["code"]] = inserted
            print(f"  {inserted} data points ingested")

        if run_id:
            finish_run(cur, run_id=run_id, status="succeeded",
                       rows_read=total_read, rows_inserted=sum(results.values()))
            conn.commit()
    except Exception as exc:
        if run_id:
            conn.rollback()
            with conn.cursor() as fail_cur:
                finish_run(fail_cur, run_id=run_id, status="failed", error_summary=str(exc)[:500])
                conn.commit()
        raise
    finally:
        cur.close()
        conn.close()

    return results


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Print what would be done")
    args = parser.parse_args()

    results = run(dry_run=args.dry_run)
    total = sum(results.values())
    if not args.dry_run:
        print(f"\nDone! {total} total data points across {len(results)} indicators:")
        for code, count in results.items():
            print(f"  {code}: {count} rows")


if __name__ == "__main__":
    main()
