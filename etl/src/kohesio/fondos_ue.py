"""ETL: ingest EU fund beneficiaries for Spain from Kohesio (EC ESIF 2014-2027).

Fetches from kohesio.ec.europa.eu/api/beneficiaries with country=Q7 (Spain's
entity in the Kohesio LOD graph) and upserts records into the eu_funds table.

API limitation: offset > 0 returns 400 for large page sizes. The API accepts
up to limit=30000 at offset=0. Total Spanish beneficiaries are ~72K; this ETL
ingests up to MAX_FETCH (~30K) per run — enough to cover all major recipients.

Usage:
    PYTHONPATH=src python -m src.kohesio.fondos_ue
    PYTHONPATH=src python -m src.kohesio.fondos_ue --dry-run
    PYTHONPATH=src python -m src.kohesio.fondos_ue --limit 500   # partial ingest
"""

from __future__ import annotations

import argparse
from decimal import Decimal, InvalidOperation

import httpx
import psycopg2.extras
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from common.db import get_pg_conn

API_BASE = "https://kohesio.ec.europa.eu/api/beneficiaries"
SPAIN_ENTITY = "https://linkedopendata.eu/entity/Q7"
MAX_FETCH = 30_000

_TRANSIENT = (httpx.TransportError, httpx.HTTPStatusError, httpx.ReadTimeout)


def _to_decimal(value: str | float | None) -> Decimal | None:
    if value is None:
        return None
    try:
        return Decimal(str(value))
    except InvalidOperation:
        return None


@retry(
    reraise=True,
    stop=stop_after_attempt(4),
    wait=wait_exponential(multiplier=2, min=2, max=30),
    retry=retry_if_exception_type(_TRANSIENT),
)
def fetch_all(client: httpx.Client, limit: int) -> tuple[list[dict], int]:
    resp = client.get(
        API_BASE,
        params={"country": SPAIN_ENTITY, "limit": limit, "offset": 0},
        timeout=120,
    )
    # 5xx and 429 → retry. 4xx (other than 429) → fail fast.
    if resp.status_code == 429 or resp.status_code >= 500:
        resp.raise_for_status()
    resp.raise_for_status()
    data = resp.json()
    return data["list"], data["numberResults"]


def upsert_batch(conn, rows: list[dict]) -> int:
    with conn.cursor() as cur:
        psycopg2.extras.execute_batch(
            cur,
            """
            INSERT INTO eu_funds
              (id, label, eu_budget, total_budget, cofinancing_rate,
               number_projects, wikidata_link, country_code, updated_at)
            VALUES (
              %(id)s, %(label)s, %(eu_budget)s, %(total_budget)s,
              %(cofinancing_rate)s, %(number_projects)s, %(wikidata_link)s,
              %(country_code)s, now()
            )
            ON CONFLICT (id) DO UPDATE SET
              label            = EXCLUDED.label,
              eu_budget        = EXCLUDED.eu_budget,
              total_budget     = EXCLUDED.total_budget,
              cofinancing_rate = EXCLUDED.cofinancing_rate,
              number_projects  = EXCLUDED.number_projects,
              wikidata_link    = COALESCE(EXCLUDED.wikidata_link, eu_funds.wikidata_link),
              updated_at       = now()
            """,
            rows,
            page_size=500,
        )
    conn.commit()
    return len(rows)


def run(dry_run: bool = False, limit: int | None = None) -> None:
    fetch_limit = min(limit or MAX_FETCH, MAX_FETCH)
    with httpx.Client(headers={"Accept": "application/json"}) as client:
        print(f"Fetching up to {fetch_limit:,} beneficiaries from Kohesio...")
        items, total_remote = fetch_all(client, fetch_limit)

    print(f"Kohesio ES total: {total_remote:,} | fetched: {len(items):,}")

    rows = [
        {
            "id": item["id"],
            "label": item["label"] or "",
            "eu_budget": _to_decimal(item.get("euBudget")),
            "total_budget": _to_decimal(item.get("budget")),
            "cofinancing_rate": _to_decimal(item.get("cofinancingRate")),
            "number_projects": item.get("numberProjects"),
            "wikidata_link": item.get("link"),
            "country_code": item.get("countryCode", "ES"),
        }
        for item in items
    ]

    if dry_run:
        print(f"[DRY-RUN] Would upsert {len(rows):,} rows. Sample:")
        for r in rows[:3]:
            budget_m = float(r["eu_budget"] or 0) / 1_000_000
            print(f"  {r['label'][:60]:<60s}  {budget_m:>10.1f} M€  {r['number_projects']} proyectos")
        return

    conn = get_pg_conn()
    try:
        upserted = upsert_batch(conn, rows)
        print(f"Upserted {upserted:,} beneficiaries into eu_funds")
    finally:
        conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, default=None, help="Max records to fetch (for testing)")
    args = parser.parse_args()
    run(dry_run=args.dry_run, limit=args.limit)


if __name__ == "__main__":
    main()
