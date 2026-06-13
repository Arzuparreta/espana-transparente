"""Refresh territorial population and spend aggregates.

Population source: Eurostat demo_r_pjanaggr3, total population on 1 January
by NUTS region. The territorial spend aggregate is rebuilt from the raw PCSP
and BDNS rows after both daily ingestions have finished.
"""

from __future__ import annotations

import argparse

import httpx
import psycopg2.extras

from common.db import get_pg_conn


EUROSTAT_URL = (
    "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/"
    "demo_r_pjanaggr3"
)
SOURCE_URL = "https://ec.europa.eu/eurostat/databrowser/view/demo_r_pjanaggr3/default/table"


def fetch_population(nuts_code: str) -> list[tuple[int, int]]:
    response = httpx.get(
        EUROSTAT_URL,
        params={
            "lang": "en",
            "geo": nuts_code,
            "sex": "T",
            "age": "TOTAL",
            "unit": "NR",
        },
        headers={"User-Agent": "EspanaTransparente/1.0 (+https://spaintransparencia.info)"},
        timeout=60,
    )
    response.raise_for_status()
    payload = response.json()
    time_index = payload["dimension"]["time"]["category"]["index"]
    values = payload.get("value", {})

    rows: list[tuple[int, int]] = []
    for year, position in time_index.items():
        raw_value = values.get(str(position))
        if raw_value is None:
            continue
        rows.append((int(year), int(raw_value)))
    return rows


def refresh(*, skip_population: bool = False, dry_run: bool = False) -> tuple[int, int]:
    conn = get_pg_conn()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT territory_key, nuts_code
        FROM territory_catalog
        WHERE territory_type = 'ccaa'
          AND nuts_code IS NOT NULL
        ORDER BY sort_order
        """
    )
    territories = cur.fetchall()
    population_rows: list[tuple[str, int, int, str]] = []

    if not skip_population:
        for territory_key, nuts_code in territories:
            rows = fetch_population(nuts_code)
            population_rows.extend(
                (territory_key, year, population, SOURCE_URL)
                for year, population in rows
            )
            print(f"{territory_key}: {len(rows)} population years")

    if dry_run:
        conn.close()
        print(f"Dry run: {len(population_rows)} population rows; atlas not refreshed")
        return len(population_rows), 0

    if population_rows:
        psycopg2.extras.execute_values(
            cur,
            """
            INSERT INTO territory_population
              (territory_key, year, population, source_url)
            VALUES %s
            ON CONFLICT (territory_key, year) DO UPDATE SET
              population = EXCLUDED.population,
              source_url = EXCLUDED.source_url,
              updated_at = now()
            """,
            population_rows,
        )

    cur.execute("SELECT refresh_territory_atlas()")
    conn.commit()
    cur.close()
    conn.close()
    print(f"Atlas refreshed; {len(population_rows)} population rows upserted")
    return len(population_rows), 1


def main() -> None:
    parser = argparse.ArgumentParser(description="Refresh the territorial atlas")
    parser.add_argument("--skip-population", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    refresh(skip_population=args.skip_population, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
