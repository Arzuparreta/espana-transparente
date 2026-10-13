"""Small navigation snapshots and read-only RPC permissions, in disposable SQL."""
import os
from pathlib import Path

import psycopg2
import pytest

ROOT = Path(__file__).resolve().parents[2]


def test_snapshot_refresh_and_invoker_counts():
    url = os.getenv("TEST_CONTRACT_DB_URL")
    if not url:
        pytest.skip("requires disposable PostgreSQL")
    with psycopg2.connect(url) as conn:
        with conn.cursor() as cur:
            cur.execute("CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public")
            cur.execute("""
              DO $$ BEGIN
                IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
                IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
                IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role; END IF;
              END $$;
              CREATE SCHEMA nav_cache_regression;
              CREATE TABLE nav_cache_regression.beneficiaries(ministry_normalized text, source_type text, name text, amount numeric);
              INSERT INTO nav_cache_regression.beneficiaries VALUES ('Hacienda','contract','A',100);
              CREATE VIEW nav_cache_regression.v_ministry_top_beneficiaries AS SELECT * FROM nav_cache_regression.beneficiaries;
              CREATE VIEW nav_cache_regression.v_section_eu_fund_summary AS
                SELECT 'Hacienda'::text ministry_normalized, 2::integer eu_fund_count;
              CREATE TABLE nav_cache_regression.voting_sessions(id uuid, chamber text);
              CREATE TABLE nav_cache_regression.votes(voting_session_id uuid);
              INSERT INTO nav_cache_regression.voting_sessions VALUES ('00000000-0000-0000-0000-000000000001','senate');
              INSERT INTO nav_cache_regression.votes VALUES ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000001');
            """)
            migration = (ROOT / "supabase/migrations/20261013130000_navigation_summary_caches.sql").read_text()
            migration = migration.replace("public.", "nav_cache_regression.").replace("nav_cache_regression.unaccent", "public.unaccent")
            cur.execute(migration)
            cur.execute("SELECT amount FROM nav_cache_regression.mv_ministry_top_beneficiaries")
            assert cur.fetchone()[0] == 100
            cur.execute("UPDATE nav_cache_regression.beneficiaries SET amount=200")
            cur.execute("SELECT amount FROM nav_cache_regression.mv_ministry_top_beneficiaries")
            assert cur.fetchone()[0] == 100
            cur.execute("SELECT nav_cache_regression.refresh_ministry_beneficiaries_cache()")
            assert cur.fetchone()[0] == 1
            cur.execute("SELECT amount FROM nav_cache_regression.mv_ministry_top_beneficiaries")
            assert cur.fetchone()[0] == 200
            cur.execute("SELECT nav_cache_regression.normalize_money_text(E'  Héllo\\t  Money ')")
            assert cur.fetchone()[0] == "HELLO MONEY"
            cur.execute("SELECT * FROM nav_cache_regression.get_senate_nominal_vote_stats()")
            assert cur.fetchone() == (1, 2)
            # Anon may read counts, respects RLS, and cannot refresh heavy caches.
            cur.execute("""
              GRANT USAGE ON SCHEMA nav_cache_regression TO anon;
              GRANT SELECT ON nav_cache_regression.votes,nav_cache_regression.voting_sessions TO anon;
              ALTER TABLE nav_cache_regression.votes ENABLE ROW LEVEL SECURITY;
              SET LOCAL ROLE anon;
            """)
            cur.execute("SELECT * FROM nav_cache_regression.get_senate_nominal_vote_stats()")
            assert cur.fetchone() == (0, 0)
            with pytest.raises(psycopg2.errors.InsufficientPrivilege):
                cur.execute("SELECT nav_cache_regression.refresh_ministry_beneficiaries_cache()")
        conn.rollback()
