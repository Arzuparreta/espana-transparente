"""Refresh search corpus and aliases after ETL writes."""

from __future__ import annotations

import argparse
import time

from common.db import get_pg_conn
from common.etl_runs import finish_run, start_run
from common.search_aliases import refresh_curated_aliases


CORPUS_ENTITY_TYPES = [
    "politician", "party", "government_position", "institution",
    "organization", "voting_session", "vote_divergence",
    "contract", "subsidy", "initiative",
    "budget", "budget_program", "indicator", "eu_fund",
    "revolving_door", "source_document",
]

# Keyset batches bound memory while indexing every source row. Existing
# documents stay searchable throughout retries and refreshes.
LARGE_ENTITY_TYPES = {"organization", "contract", "subsidy"}

_BATCH_SQL: dict[str, str] = {
    "organization": """
        WITH candidates AS MATERIALIZED (
          SELECT o.* FROM organizations o
          WHERE o.id > %(last_id)s
            AND o.name IS NOT NULL AND trim(o.name) <> ''
          ORDER BY o.id
          LIMIT %(batch)s
        ), written AS (
        INSERT INTO search_documents (
          entity_type, entity_id, title, display_title, subtitle, body, key_fact,
          route, source_url, document_date, amount, weight, metadata,
          search_vector, corpus_version, updated_at)
        SELECT
          'organization', o.id::text, o.name, NULL,
          o.sector,
          concat_ws(' ', o.name, o.organization_type, o.sector, o.country),
          nullif(concat_ws(' · ', o.organization_type, o.sector), ''),
          '/organizaciones/' || o.id::text, NULL, NULL, NULL, 7,
          jsonb_build_object('type', o.organization_type, 'sector', o.sector),
          _search_doc_vector(o.name, NULL, o.sector,
            nullif(concat_ws(' · ', o.organization_type, o.sector), ''),
            concat_ws(' ', o.name, o.organization_type, o.sector, o.country)),
          'v3', now()
        FROM candidates o
        WHERE o.name IS NOT NULL AND trim(o.name) <> ''
          AND o.id > %(last_id)s
          AND NOT EXISTS (
              SELECT 1 FROM search_documents d
              WHERE d.entity_type = 'organization' AND d.entity_id = o.id::text
              AND d.updated_at >= o.updated_at
            )
        ORDER BY o.id
        LIMIT %(batch)s
        ON CONFLICT (entity_type, entity_id) DO UPDATE SET
          title = EXCLUDED.title, subtitle = EXCLUDED.subtitle,
          body = EXCLUDED.body, key_fact = EXCLUDED.key_fact,
          route = EXCLUDED.route, metadata = EXCLUDED.metadata,
          search_vector = EXCLUDED.search_vector,
          corpus_version = EXCLUDED.corpus_version, updated_at = EXCLUDED.updated_at
        RETURNING entity_id
        )
        SELECT (SELECT count(*) FROM written),
               (SELECT id::text FROM candidates ORDER BY id DESC LIMIT 1),
               count(*) FROM candidates
    """,
    "contract": """
        WITH candidates AS MATERIALIZED (
          SELECT c.* FROM contracts c
          WHERE c.id > %(last_id)s

          ORDER BY c.id
          LIMIT %(batch)s
        ), written AS (
        INSERT INTO search_documents (
          entity_type, entity_id, title, display_title, subtitle, body, key_fact,
          route, source_url, document_date, amount, weight, metadata,
          search_vector, corpus_version, updated_at)
        SELECT
          'contract', c.id::text,
          coalesce(c.title, c.contract_folder_id, 'Contrato'), NULL,
          coalesce(c.awarding_body_normalized, c.awarding_body, c.contractor),
          concat_ws(' ', c.title, c.description, c.awarding_body,
            c.awarding_body_normalized, c.contractor, c.contract_type, c.cpv_code, c.region),
          concat_ws(' · ', c.contractor,
            to_char(c.amount, 'FM999G999G999G990D00') || ' EUR'),
          '/contratos/' || c.id::text, c.source_url, c.date, c.amount, 9,
          jsonb_build_object(
            'awarding_body', coalesce(c.awarding_body_normalized, c.awarding_body),
            'contractor', c.contractor, 'status', c.status),
          _search_doc_vector(
            coalesce(c.title, c.contract_folder_id, 'Contrato'), NULL,
            coalesce(c.awarding_body_normalized, c.awarding_body, c.contractor),
            concat_ws(' · ', c.contractor,
              to_char(c.amount, 'FM999G999G999G990D00') || ' EUR'),
            concat_ws(' ', c.title, c.description, c.awarding_body,
              c.awarding_body_normalized, c.contractor, c.contract_type, c.cpv_code, c.region)
          ),
          'v3', now()
        FROM candidates c
        WHERE c.id > %(last_id)s
          AND NOT EXISTS (
              SELECT 1 FROM search_documents d
              WHERE d.entity_type = 'contract' AND d.entity_id = c.id::text
              AND d.updated_at >= c.updated_at
            )
        ORDER BY c.id
        LIMIT %(batch)s
        ON CONFLICT (entity_type, entity_id) DO UPDATE SET
          title = EXCLUDED.title, subtitle = EXCLUDED.subtitle,
          body = EXCLUDED.body, key_fact = EXCLUDED.key_fact,
          route = EXCLUDED.route, source_url = EXCLUDED.source_url,
          document_date = EXCLUDED.document_date, amount = EXCLUDED.amount,
          metadata = EXCLUDED.metadata, search_vector = EXCLUDED.search_vector,
          corpus_version = EXCLUDED.corpus_version, updated_at = EXCLUDED.updated_at
        RETURNING entity_id
        )
        SELECT (SELECT count(*) FROM written),
               (SELECT id::text FROM candidates ORDER BY id DESC LIMIT 1),
               count(*) FROM candidates
    """,
    "subsidy": """
        WITH candidates AS MATERIALIZED (
          SELECT s.* FROM subsidies s
          WHERE s.id > %(last_id)s

          ORDER BY s.id
          LIMIT %(batch)s
        ), written AS (
        INSERT INTO search_documents (
          entity_type, entity_id, title, display_title, subtitle, body, key_fact,
          route, source_url, document_date, amount, weight, metadata,
          search_vector, corpus_version, updated_at)
        SELECT
          'subsidy', s.id::text,
          coalesce(s.beneficiario, s.convocatoria, 'Subvención BDNS ' || s.bdns_id::text), NULL,
          coalesce(s.nivel3, s.nivel2, s.nivel1),
          concat_ws(' ', s.beneficiario, s.convocatoria, s.numero_convocatoria,
            s.instrumento, s.nivel1, s.nivel2, s.nivel3),
          concat_ws(' · ', s.instrumento,
            to_char(s.importe, 'FM999G999G999G990D00') || ' EUR'),
          '/subvenciones/' || s.id::text, s.source_url, s.fecha_concesion, s.importe, 9,
          jsonb_build_object('bdns_id', s.bdns_id, 'granting_body', s.nivel3,
            'territory', s.nivel2),
          _search_doc_vector(
            coalesce(s.beneficiario, s.convocatoria, 'Subvención BDNS ' || s.bdns_id::text), NULL,
            coalesce(s.nivel3, s.nivel2, s.nivel1),
            concat_ws(' · ', s.instrumento,
              to_char(s.importe, 'FM999G999G999G990D00') || ' EUR'),
            concat_ws(' ', s.beneficiario, s.convocatoria, s.numero_convocatoria,
              s.instrumento, s.nivel1, s.nivel2, s.nivel3)
          ),
          'v3', now()
        FROM candidates s
        WHERE s.id > %(last_id)s
          AND NOT EXISTS (
              SELECT 1 FROM search_documents d
              WHERE d.entity_type = 'subsidy' AND d.entity_id = s.id::text
              AND d.updated_at >= s.updated_at
            )
        ORDER BY s.id
        LIMIT %(batch)s
        ON CONFLICT (entity_type, entity_id) DO UPDATE SET
          title = EXCLUDED.title, subtitle = EXCLUDED.subtitle,
          body = EXCLUDED.body, key_fact = EXCLUDED.key_fact,
          route = EXCLUDED.route, source_url = EXCLUDED.source_url,
          document_date = EXCLUDED.document_date, amount = EXCLUDED.amount,
          metadata = EXCLUDED.metadata, search_vector = EXCLUDED.search_vector,
          corpus_version = EXCLUDED.corpus_version, updated_at = EXCLUDED.updated_at
        RETURNING entity_id
        )
        SELECT (SELECT count(*) FROM written),
               (SELECT id::text FROM candidates ORDER BY id DESC LIMIT 1),
               count(*) FROM candidates
    """,
}


def _refresh_large_entity_type(conn, entity_type: str, batch_size: int = 1500) -> int:
    """Upsert missing/changed documents; commit each bounded, resumable batch."""
    sql = _BATCH_SQL[entity_type]
    total = 0
    last_id = "00000000-0000-0000-0000-000000000000"
    while True:
        with conn.cursor() as cur:
            cur.execute("SET statement_timeout = '5min'")
            cur.execute(sql, {"last_id": last_id, "batch": batch_size})
            n, newest_id, scanned = cur.fetchone()
        conn.commit()
        total += n
        if scanned < batch_size:
            break
        last_id = newest_id
        print(f"  {entity_type}: {total} updated so far", flush=True)
    # Only remove documents whose source row was actually deleted.
    table = {"organization": "organizations", "contract": "contracts", "subsidy": "subsidies"}[entity_type]
    with conn.cursor() as cur:
        cur.execute(
            f"DELETE FROM search_documents d WHERE entity_type = %s "
            f"AND NOT EXISTS (SELECT 1 FROM {table} s WHERE s.id::text = d.entity_id)",
            (entity_type,),
        )
    conn.commit()
    print(f"  {entity_type}: {total} updated", flush=True)
    return total


def refresh_search_corpus(conn, start_from: str | None = None) -> int:
    """Refresh entity types one at a time, committing each independently."""
    total = 0
    skip = start_from is not None
    for entity_type in CORPUS_ENTITY_TYPES:
        if skip:
            if entity_type == start_from:
                skip = False
            else:
                continue
        if entity_type in LARGE_ENTITY_TYPES:
            n = _refresh_large_entity_type(conn, entity_type)
        else:
            with conn.cursor() as cur:
                cur.execute("SET statement_timeout = '30min'")
                cur.execute("SELECT refresh_search_documents(%s)", (entity_type,))
                n = int(cur.fetchone()[0])
            conn.commit()
            print(f"  {entity_type}: {n}", flush=True)
        total += n
    return total


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
    cur.execute("SET statement_timeout = '30min'")
    cur.execute("SELECT refresh_entity_summary()")
    return int(cur.fetchone()[0])


def refresh_money_coverage(cur) -> int:
    """Populate money_coverage_cache and money_examples_cache from the full chain."""
    cur.execute("SET statement_timeout = '10min'")
    cur.execute("SELECT refresh_money_coverage()")
    return int(cur.fetchone()[0])


def refresh_vote_divergences(cur) -> int:
    """Populate vote_divergences_cache from get_divergences() — needs votes table."""
    cur.execute("SET statement_timeout = '30min'")
    cur.execute("SELECT refresh_vote_divergences_cache()")
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
            divergences = refresh_vote_divergences(cur)
        docs = refresh_search_corpus(conn)
        with conn.cursor() as cur:
            judicial_docs = refresh_judicial_search(cur)
            entity_summary = refresh_entity_summary(cur)
            aliases = refresh_search_aliases(cur)
            sections = refresh_section_index(cur)
            org_counts = refresh_organization_counts(cur)
            money_stats = refresh_money_coverage(cur)
            conn.commit()
        with conn.cursor() as cur:
            finish_run(cur, run_id=run_id, status="succeeded", rows_updated=docs + judicial_docs + entity_summary + aliases)
            conn.commit()
        elapsed = time.perf_counter() - started
        print(f"divergences: {divergences}, search corpus: {docs} rows, judicial: {judicial_docs}, entity_summary: {entity_summary}, aliases: {aliases}, sections: {sections}, org_counts: {org_counts}, money_coverage: {money_stats}, {elapsed:.1f}s")
        return docs, aliases
    except Exception as exc:
        if run_id:
            try:
                if conn.closed:
                    conn = get_pg_conn()
                else:
                    conn.rollback()
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
    parser.add_argument("--money-only", action="store_true")
    parser.add_argument("--divergences-only", action="store_true")
    parser.add_argument("--start-from", metavar="ENTITY_TYPE", help="Resume corpus rebuild from this entity type")
    args = parser.parse_args()

    if not any([args.aliases_only, args.corpus_only, args.sections_only, args.counts_only, args.judicial_only, args.entity_summary_only, args.money_only, args.divergences_only]):
        refresh_all()
        return

    conn = get_pg_conn()
    try:
        if args.corpus_only:
            count = refresh_search_corpus(conn, start_from=args.start_from)
            print(f"corpus refreshed: {count}")
        else:
            with conn.cursor() as cur:
                if args.aliases_only:
                    count = refresh_search_aliases(cur)
                    print(f"aliases refreshed: {count}")
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
                elif args.money_only:
                    count = refresh_money_coverage(cur)
                    print(f"money coverage refreshed: {count} rows")
                elif args.divergences_only:
                    count = refresh_vote_divergences(cur)
                    print(f"vote divergences cache refreshed: {count} rows")
                conn.commit()
    finally:
        conn.close()


if __name__ == "__main__":
    main()
