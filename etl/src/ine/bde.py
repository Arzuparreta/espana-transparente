"""ETL: ingest Spanish public debt data from Eurostat API."""

import json
import subprocess
from common.db import get_pg_conn
from common.etl_runs import finish_run, start_run

# Eurostat REST API — gov_10dd_edpt1: Government deficit/surplus, debt and associated data
# na_item=GD: Gross debt (Maastricht criterion)
# sector=S13: General government
# unit=MIO_EUR: Millions of euros
EUROSTAT_URL = (
    "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/"
    "gov_10dd_edpt1?format=JSON&geo=ES&na_item=GD&sector=S13&unit=MIO_EUR"
)


def fetch_deuda_json(url: str = EUROSTAT_URL) -> dict:
    """Download the Eurostat JSON for Spanish government debt."""
    result = subprocess.run(
        ["curl", "-sL", "--max-time", "30", url],
        capture_output=True, text=True, timeout=35,
    )
    if result.returncode != 0:
        raise RuntimeError(f"curl failed: {result.stderr}")
    return json.loads(result.stdout)


def parse_deuda_records(raw: dict) -> list[tuple[str, float]]:
    """Extract (year, value_millions_eur) pairs from Eurostat JSON response.

    Returns list of (year_str, value) sorted ascending.
    """
    vals = raw.get("value", {})
    dims = raw.get("dimension", {})
    time_cat = dims.get("time", {}).get("category", {})
    time_index = time_cat.get("index", {})  # year -> position int

    records = []
    for year, pos in time_index.items():
        v = vals.get(str(pos))
        if v is None:
            continue
        try:
            records.append((str(year), float(v)))
        except (ValueError, TypeError):
            continue
    return sorted(records, key=lambda x: x[0])


def build_raw_data(period: str, value: float) -> dict:
    """Per-row raw_data payload. The source is Eurostat (Maastricht criterion);
    the module name bde.py is historical and must not leak into attribution."""
    return {"period": period, "value": value, "source": "Eurostat"}


def run():
    data = fetch_deuda_json()
    records = parse_deuda_records(data)
    if not records:
        print("No records parsed from Eurostat API — check URL or response format")
        return

    conn = get_pg_conn()
    run_id = None
    try:
        with conn.cursor() as cur:
            run_id = start_run(cur, pipeline="ine.bde")
            conn.commit()

        cur = conn.cursor()
        inserted = 0
        for period_str, value in records:
            cur.execute("""
                INSERT INTO economic_indicators (indicator_code, indicator_name, period, value, unit, raw_data)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (indicator_code, period) DO UPDATE SET
                    value = EXCLUDED.value,
                    raw_data = EXCLUDED.raw_data
            """, (
                "DEUDA_PUBLICA",
                "Deuda pública consolidada (AA.PP.)",
                period_str,
                value,
                "millones EUR",
                json.dumps(build_raw_data(period_str, value)),
            ))
            inserted += 1

        conn.commit()
        cur.close()

        with conn.cursor() as cur:
            finish_run(cur, run_id=run_id, status="succeeded",
                       rows_read=len(records), rows_inserted=inserted)
            conn.commit()
        print(f"Done! Upserted {inserted} data points")
    except Exception as exc:
        if run_id:
            conn.rollback()
            with conn.cursor() as cur:
                finish_run(cur, run_id=run_id, status="failed", error_summary=str(exc)[:500])
                conn.commit()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    run()
