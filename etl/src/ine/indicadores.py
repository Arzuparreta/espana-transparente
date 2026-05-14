"""ETL: ingest IPC (Consumer Price Index) data from INE API"""

import json
import subprocess
from common.db import get_pg_conn

# INE table codes for key indicators
INDICATORS = {
    "IPC251852": {
        "code": "IPC",
        "name": "IPC — Índice general",
        "unit": "índice (base 2021=100)",
        "url": "https://servicios.ine.es/wstempus/js/ES/DATOS_TABLA/50902",
        "filter_cod": "IPC251852",
    },
    "IPC251855": {
        "code": "IPC_VAR_MENSUAL",
        "name": "IPC — Variación mensual",
        "unit": "%",
        "url": "https://servicios.ine.es/wstempus/js/ES/DATOS_TABLA/50902",
        "filter_cod": "IPC251855",
    },
}


def run():
    conn = get_pg_conn()
    cur = conn.cursor()

    for key, meta in INDICATORS.items():
        print(f"Fetching {meta['name']}...")
        result = subprocess.run(
            ["curl", "-sL", meta["url"]],
            capture_output=True, text=True, timeout=30
        )
        data = json.loads(result.stdout)

        # Find the matching series
        series = next((s for s in data if s.get("COD") == meta["filter_cod"]), None)
        if not series:
            print(f"  Series {meta['filter_cod']} not found")
            continue

        inserted = 0
        for d in series.get("Data", []):
            year = d.get("Anyo")
            period = d.get("FK_Periodo")
            value = d.get("Valor")
            if year is None or period is None or value is None:
                continue

            period_str = f"{year}-{period:02d}"

            cur.execute("""
                INSERT INTO economic_indicators (indicator_code, indicator_name, period, value, unit, raw_data)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (indicator_code, period) DO UPDATE SET
                    value = EXCLUDED.value,
                    raw_data = EXCLUDED.raw_data
            """, (meta["code"], meta["name"], period_str, value, meta["unit"],
                  json.dumps(d)))
            inserted += 1

        conn.commit()
        print(f"  {inserted} data points ingested")

    cur.close()
    conn.close()
    print("Done!")


if __name__ == "__main__":
    run()
