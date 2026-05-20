"""Refresh search corpus and aliases after ETL writes."""

from __future__ import annotations

import argparse
import time

from common.db import get_pg_conn
from common.search_aliases import refresh_curated_aliases


def refresh_search_corpus(cur) -> int:
    cur.execute("SELECT refresh_search_documents()")
    return int(cur.fetchone()[0])


def refresh_search_aliases(cur) -> int:
    from common.search_aliases import upsert_curated_aliases

    cur.execute("SELECT refresh_search_person_aliases()")
    generated = int(cur.fetchone()[0])
    cur.execute("DELETE FROM search_aliases WHERE source = 'curated' AND entity_id IS NOT NULL")
    return generated + upsert_curated_aliases(cur)


def refresh_all() -> tuple[int, int]:
    started = time.perf_counter()
    with get_pg_conn() as conn:
        with conn.cursor() as cur:
            docs = refresh_search_corpus(cur)
            aliases = refresh_search_aliases(cur)
            conn.commit()
    elapsed = time.perf_counter() - started
    print(f"search corpus: {docs} rows touched, aliases: {aliases}, {elapsed:.1f}s")
    return docs, aliases


def main() -> None:
    parser = argparse.ArgumentParser(description="Refresh search_documents and search_aliases")
    parser.add_argument("--corpus-only", action="store_true")
    parser.add_argument("--aliases-only", action="store_true")
    args = parser.parse_args()

    with get_pg_conn() as conn:
        with conn.cursor() as cur:
            if args.aliases_only:
                count = refresh_search_aliases(cur)
                print(f"aliases refreshed: {count}")
            elif args.corpus_only:
                count = refresh_search_corpus(cur)
                print(f"corpus refreshed: {count}")
            else:
                refresh_all()
                return
            conn.commit()


if __name__ == "__main__":
    main()
