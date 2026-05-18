"""ETL: ingest IPC (Consumer Price Index) data from INE API."""

import json
import subprocess
from common.db import get_pg_conn

# Current INE IPC series, base 2025.
INDICATORS = {
    "IPC290751": {
        "code": "IPC",
        "name": "IPC — Índice general",
        "unit": "índice (base 2025=100)",
        "url": "https://servicios.ine.es/wstempus/js/ES/DATOS_SERIE/IPC290751?nult=240&tip=A",
        "metadata_url": "https://servicios.ine.es/wstempus/js/ES/SERIE/IPC290751?det=2&tip=A",
    },
    "IPC290752": {
        "code": "IPC_VAR_MENSUAL",
        "name": "IPC — Variación mensual",
        "unit": "%",
        "url": "https://servicios.ine.es/wstempus/js/ES/DATOS_SERIE/IPC290752?nult=240&tip=A",
        "metadata_url": "https://servicios.ine.es/wstempus/js/ES/SERIE/IPC290752?det=2&tip=A",
    },
    "IPC290750": {
        "code": "IPC_VAR_ANUAL",
        "name": "IPC — Variación anual",
        "unit": "%",
        "url": "https://servicios.ine.es/wstempus/js/ES/DATOS_SERIE/IPC290750?nult=240&tip=A",
        "metadata_url": "https://servicios.ine.es/wstempus/js/ES/SERIE/IPC290750?det=2&tip=A",
    },
}


def fetch_json(url: str):
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


def run():
    conn = get_pg_conn()
    cur = conn.cursor()

    for key, meta in INDICATORS.items():
        print(f"Fetching {meta['name']}...")
        series = fetch_json(meta["url"])
        metadata = fetch_json(meta["metadata_url"])

        inserted = 0
        for d in series.get("Data", []):
            period_str = parse_period(d)
            value = d.get("Valor")
            if period_str is None or value is None:
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
                meta["unit"],
                json.dumps({
                    "source_series": key,
                    "source_name": series.get("Nombre"),
                    "point": d,
                    "metadata": metadata,
                }),
            ))
            inserted += 1

        conn.commit()
        print(f"  {inserted} data points ingested")

    cur.close()
    conn.close()
    print("Done!")


if __name__ == "__main__":
    run()
