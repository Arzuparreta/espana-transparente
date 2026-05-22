"""Refresh search corpus and aliases after ETL writes."""

from __future__ import annotations

import argparse
import time

from common.db import get_pg_conn
from common.etl_runs import finish_run, start_run
from common.search_aliases import refresh_curated_aliases


def refresh_search_corpus(cur) -> int:
    cur.execute("SET statement_timeout = '10min'")
    cur.execute("SELECT refresh_search_documents()")
    return int(cur.fetchone()[0])


def refresh_search_aliases(cur) -> int:
    from common.search_aliases import upsert_curated_aliases

    cur.execute("SET statement_timeout = '10min'")
    cur.execute("SELECT refresh_search_person_aliases()")
    generated = int(cur.fetchone()[0])
    cur.execute("DELETE FROM search_aliases WHERE source = 'curated' AND entity_id IS NOT NULL")
    return generated + upsert_curated_aliases(cur)


def refresh_all() -> tuple[int, int]:
    started = time.perf_counter()
    conn = get_pg_conn()
    run_id = None
    try:
        with conn.cursor() as cur:
            run_id = start_run(cur, pipeline="common.search_refresh", chunk_key="full")
            conn.commit()
            docs = refresh_search_corpus(cur)
            aliases = refresh_search_aliases(cur)
            conn.commit()
        with conn.cursor() as cur:
            finish_run(cur, run_id=run_id, status="succeeded", rows_updated=docs + aliases)
            conn.commit()
        elapsed = time.perf_counter() - started
        print(f"search corpus: {docs} rows touched, aliases: {aliases}, {elapsed:.1f}s")
        return docs, aliases
    except Exception as exc:
        if run_id:
            try:
                if conn.closed:
                    conn = get_pg_conn()
                with conn.cursor() as cur:
                    finish_run(cur, run_id=run_id, status="failed", error_summary=str(exc)[:500])
                    conn.commit()
            except Exception as finish_exc:
                print(f"failed to mark search_refresh run as failed: {finish_exc}")
        raise
    finally:
        conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Refresh search_documents and search_aliases")
    parser.add_argument("--corpus-only", action="store_true")
    parser.add_argument("--aliases-only", action="store_true")
    args = parser.parse_args()

    if not args.aliases_only and not args.corpus_only:
        refresh_all()
        return

    with get_pg_conn() as conn:
        with conn.cursor() as cur:
            if args.aliases_only:
                count = refresh_search_aliases(cur)
                print(f"aliases refreshed: {count}")
            elif args.corpus_only:
                count = refresh_search_corpus(cur)
                print(f"corpus refreshed: {count}")
            conn.commit()


if __name__ == "__main__":
    main()
