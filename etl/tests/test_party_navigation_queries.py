import os
from pathlib import Path

import psycopg2
import pytest

ROOT = Path(__file__).resolve().parents[2]


def test_party_counts_are_not_truncated_and_cached_divergence_links_are_preserved():
    url = os.getenv("TEST_CONTRACT_DB_URL")
    if not url:
        pytest.skip("requires disposable PostgreSQL")
    with psycopg2.connect(url) as conn:
        with conn.cursor() as cur:
            cur.execute("""
              DO $$ BEGIN
                IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
                IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
                IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role; END IF;
              END $$;
              CREATE SCHEMA nav_party_regression;
              CREATE TABLE nav_party_regression.politicians(id uuid,full_name text);
              INSERT INTO nav_party_regression.politicians SELECT md5('person '||n)::uuid,'Person '||n FROM generate_series(0,49) n;
              CREATE TABLE nav_party_regression.voting_sessions(id uuid,title text,date date);
              INSERT INTO nav_party_regression.voting_sessions SELECT md5('session '||n)::uuid,'Session '||n,DATE '2026-09-30' FROM generate_series(0,29) n;
              CREATE TABLE nav_party_regression.politician_memberships(politician_id uuid,party_id uuid,is_active boolean,chamber text);
              INSERT INTO nav_party_regression.politician_memberships SELECT id,md5('party')::uuid,true,'congress' FROM nav_party_regression.politicians;
              INSERT INTO nav_party_regression.politician_memberships SELECT * FROM nav_party_regression.politician_memberships LIMIT 1;
              CREATE TABLE nav_party_regression.votes(voting_session_id uuid,politician_id uuid,vote text);
              INSERT INTO nav_party_regression.votes SELECT s.id,p.id,'Sí' FROM nav_party_regression.voting_sessions s CROSS JOIN nav_party_regression.politicians p;
              CREATE VIEW nav_party_regression.v_party_stats AS SELECT pm.party_id,count(*) total_votes
                FROM nav_party_regression.politician_memberships pm JOIN nav_party_regression.votes v ON v.politician_id=pm.politician_id GROUP BY pm.party_id;
              CREATE TABLE nav_party_regression.vote_divergences_cache(full_name text,initiative text,date date,voted text,party_voted text);
              INSERT INTO nav_party_regression.vote_divergences_cache VALUES ('Person 0','Session 0','2026-09-30','Sí','No');
            """)
            migration = (ROOT / "supabase/migrations/20261013140000_party_navigation_queries.sql").read_text()
            cur.execute(migration.replace("public.", "nav_party_regression."))
            cur.execute("SELECT sum(vote_count) FROM nav_party_regression.get_party_voting_tallies(md5('party')::uuid,ARRAY(SELECT id FROM nav_party_regression.voting_sessions))")
            assert cur.fetchone()[0] == 1500
            cur.execute("SELECT * FROM nav_party_regression.get_politician_divergences(md5('person 0')::uuid)")
            rows = cur.fetchall()
            cur.execute("SELECT id,'Sí'::text,'No'::text FROM nav_party_regression.voting_sessions WHERE title='Session 0'")
            assert rows == cur.fetchall()
            cur.execute("SELECT * FROM nav_party_regression.get_politician_divergences(md5('missing person')::uuid)")
            assert cur.fetchall() == []
            cur.execute("SELECT total_votes FROM nav_party_regression.mv_party_stats")
            assert cur.fetchone()[0] == 1530
        conn.rollback()
