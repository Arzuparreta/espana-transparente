"""Load curated search aliases from etl/data/search_aliases.yml."""

from __future__ import annotations

from pathlib import Path

import psycopg2.extras
import yaml

from common.db import get_pg_conn
from common.search_index import normalize_alias

DATA_PATH = Path(__file__).resolve().parents[2] / "data" / "search_aliases.yml"


def load_curated_aliases() -> list[dict]:
    if not DATA_PATH.exists():
        return []
    payload = yaml.safe_load(DATA_PATH.read_text(encoding="utf-8")) or {}
    rows = payload.get("aliases") or []
    return [row for row in rows if row.get("alias") and row.get("entity_type") and row.get("entity_id")]


def upsert_curated_aliases(cur) -> int:
    rows = load_curated_aliases()
    count = 0
    for row in rows:
        alias = normalize_alias(str(row["alias"]))
        if len(alias) < 2:
            continue
        cur.execute(
            """
            INSERT INTO search_aliases (alias, canonical, entity_type, entity_id, weight, source)
            SELECT
              %s,
              coalesce(sd.display_title, sd.title),
              sd.entity_type,
              sd.entity_id,
              10,
              'curated'
            FROM search_documents sd
            WHERE sd.entity_type = %s AND sd.entity_id = %s
            ON CONFLICT DO NOTHING
            """,
            (alias, row["entity_type"], row["entity_id"]),
        )
        count += cur.rowcount
    return count


def refresh_curated_aliases(cur=None) -> int:
    if cur is not None:
        cur.execute("DELETE FROM search_aliases WHERE source = 'curated' AND entity_id IS NOT NULL")
        return upsert_curated_aliases(cur)
    with get_pg_conn() as conn:
        with conn.cursor() as c:
            c.execute("DELETE FROM search_aliases WHERE source = 'curated' AND entity_id IS NOT NULL")
            count = upsert_curated_aliases(c)
            conn.commit()
            return count


if __name__ == "__main__":
    print(f"Curated aliases upserted: {refresh_curated_aliases()}")
