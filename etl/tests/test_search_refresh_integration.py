"""Opt-in SQL regression. All fixtures live in connection-local temporary tables."""
import os
import pytest


@pytest.mark.skipif(not os.getenv('TEST_DATABASE_URL'), reason='requires PostgreSQL integration connection')
def test_full_corpus_is_incremental_and_preserved():
    import psycopg2
    from common.search_refresh import _refresh_large_entity_type
    conn = psycopg2.connect(os.environ['TEST_DATABASE_URL'])
    try:
        with conn.cursor() as cur:
            cur.execute('CREATE TEMP TABLE contracts (LIKE public.contracts INCLUDING DEFAULTS)')
            cur.execute('CREATE TEMP TABLE search_documents (LIKE public.search_documents INCLUDING ALL)')
            cur.execute("INSERT INTO contracts (title, updated_at) SELECT 'Historical contract ' || i, now() FROM generate_series(1,10005) i")
        conn.commit()
        assert _refresh_large_entity_type(conn, 'contract', batch_size=1500) == 10005
        assert _refresh_large_entity_type(conn, 'contract', batch_size=1500) == 0
        with conn.cursor() as cur:
            cur.execute("UPDATE contracts SET title = 'Changed source', updated_at = clock_timestamp() WHERE id = (SELECT id FROM contracts LIMIT 1)")
        conn.commit()
        assert _refresh_large_entity_type(conn, 'contract') == 1
        with conn.cursor() as cur:
            cur.execute('SELECT count(*) FROM search_documents')
            assert cur.fetchone()[0] == 10005
            cur.execute("SELECT count(*) FROM search_documents WHERE title='Changed source'")
            assert cur.fetchone()[0] == 1
            cur.execute("DELETE FROM contracts WHERE title='Changed source'")
        conn.commit()
        _refresh_large_entity_type(conn, 'contract')
        with conn.cursor() as cur:
            cur.execute('SELECT count(*) FROM search_documents')
            assert cur.fetchone()[0] == 10004
    finally:
        conn.close()
