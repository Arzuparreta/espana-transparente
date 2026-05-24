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


def refresh_section_index(cur) -> int:
    """Refresh the section_index_cache table used by the homepage."""
    cur.execute("SET statement_timeout = '5min'")
    cur.execute("SELECT refresh_section_index()")
    cur.execute("SELECT COUNT(*) FROM section_index_cache")
    return int(cur.fetchone()[0])


def refresh_judicial_search(cur) -> int:
    """Populate reviewed judicial cases into the public search corpus."""
    cur.execute("SET statement_timeout = '5min'")
    cur.execute("SELECT refresh_judicial_search_documents()")
    return int(cur.fetchone()[0])


def refresh_entity_summary(cur) -> int:
    """Refresh organization-first entity summary and its search rows."""
    cur.execute("SET statement_timeout = '10min'")
    cur.execute("SELECT refresh_entity_summary()")
    return int(cur.fetchone()[0])


def refresh_organization_counts(cur) -> int:
    """Populate organization_counts materialized cache table."""
    cur.execute("SET statement_timeout = '5min'")
    cur.execute("""
        INSERT INTO organization_counts (id, contract_count, subsidy_beneficiary_count,
               subsidy_granting_count, revolving_door_count, eu_fund_count,
               judicial_case_count, updated_at)
        SELECT
          o.id,
          COUNT(DISTINCT c.id)::integer,
          COUNT(DISTINCT sb.id)::integer,
          COUNT(DISTINCT sg.id)::integer,
          COUNT(DISTINCT rd.id)::integer,
          COUNT(DISTINCT ef.id)::integer,
          COUNT(DISTINCT jca.case_id)::integer,
          now()
        FROM organizations o
        LEFT JOIN contracts c
          ON c.awarding_body_organization_id = o.id
          OR c.contractor_organization_id = o.id
        LEFT JOIN subsidies sb ON sb.beneficiary_organization_id = o.id
        LEFT JOIN subsidies sg ON sg.granting_body_organization_id = o.id
        LEFT JOIN revolving_door rd ON rd.organization_id = o.id AND rd.verification_status = 'verified'
        LEFT JOIN eu_funds ef ON ef.beneficiary_organization_id = o.id
        LEFT JOIN v_corruption_case_actors_public jca ON jca.organization_id = o.id
        GROUP BY o.id
        ON CONFLICT (id) DO UPDATE SET
          contract_count = EXCLUDED.contract_count,
          subsidy_beneficiary_count = EXCLUDED.subsidy_beneficiary_count,
          subsidy_granting_count = EXCLUDED.subsidy_granting_count,
          revolving_door_count = EXCLUDED.revolving_door_count,
          eu_fund_count = EXCLUDED.eu_fund_count,
          judicial_case_count = EXCLUDED.judicial_case_count,
          updated_at = EXCLUDED.updated_at
    """)
    return cur.rowcount


def refresh_all() -> tuple[int, int]:
    started = time.perf_counter()
    conn = get_pg_conn()
    run_id = None
    try:
        with conn.cursor() as cur:
            run_id = start_run(cur, pipeline="common.search_refresh", chunk_key="full")
            conn.commit()
            docs = refresh_search_corpus(cur)
            judicial_docs = refresh_judicial_search(cur)
            entity_summary = refresh_entity_summary(cur)
            aliases = refresh_search_aliases(cur)
            sections = refresh_section_index(cur)
            org_counts = refresh_organization_counts(cur)
            conn.commit()
        with conn.cursor() as cur:
            finish_run(cur, run_id=run_id, status="succeeded", rows_updated=docs + judicial_docs + entity_summary + aliases)
            conn.commit()
        elapsed = time.perf_counter() - started
        print(f"search corpus: {docs} rows, judicial: {judicial_docs}, entity_summary: {entity_summary}, aliases: {aliases}, sections: {sections}, org_counts: {org_counts}, {elapsed:.1f}s")
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
    parser.add_argument("--sections-only", action="store_true")
    parser.add_argument("--counts-only", action="store_true")
    parser.add_argument("--judicial-only", action="store_true")
    parser.add_argument("--entity-summary-only", action="store_true")
    args = parser.parse_args()

    if not any([args.aliases_only, args.corpus_only, args.sections_only, args.counts_only, args.judicial_only, args.entity_summary_only]):
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
            elif args.sections_only:
                count = refresh_section_index(cur)
                print(f"section index refreshed: {count} sections")
            elif args.counts_only:
                count = refresh_organization_counts(cur)
                print(f"organization counts refreshed: {count} rows")
            elif args.judicial_only:
                count = refresh_judicial_search(cur)
                print(f"judicial search refreshed: {count} rows")
            elif args.entity_summary_only:
                count = refresh_entity_summary(cur)
                print(f"entity summary refreshed: {count} rows")
            conn.commit()


if __name__ == "__main__":
    main()
