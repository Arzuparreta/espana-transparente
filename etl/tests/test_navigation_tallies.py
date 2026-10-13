"""Exact parity with the existing view; only uses disposable test databases."""
import os
from pathlib import Path

import pytest
import psycopg2

ROOT = Path(__file__).resolve().parents[2]


def test_bounded_tallies_preserve_chambers_ties_missing_memberships_and_empty_sessions():
    url = os.getenv("TEST_CONTRACT_DB_URL")
    if not url:
        pytest.skip("TEST_CONTRACT_DB_URL points to a disposable database")
    with psycopg2.connect(url) as conn:
        with conn.cursor() as cur:
            cur.execute("SET LOCAL search_path=pg_temp,public")
            cur.execute("""
                CREATE TEMP TABLE voting_sessions (
                  id uuid, legislature_id uuid, session_number integer, chamber text,
                  date date, title text, initiative_number text, initiative_type text,
                  votacion_number integer, created_at timestamptz);
                CREATE TEMP TABLE votes (voting_session_id uuid, politician_id uuid, vote text);
                CREATE TEMP TABLE politician_memberships (
                  politician_id uuid, party_id uuid, is_active boolean, chamber text);
            """)
            ids = [f"00000000-0000-0000-0000-{n:012d}" for n in range(1, 12)]
            for session, chamber in zip(ids[:3], ["congress", "senate", "congress"]):
                cur.execute("INSERT INTO pg_temp.voting_sessions(id,chamber) VALUES (%s,%s)", (session, chamber))
            for person, party, active, chamber in [
                (ids[3], ids[9], True, "congress"), (ids[3], ids[10], True, "senate"),
                (ids[4], ids[9], True, "congress"), (ids[4], ids[10], False, "senate"),
                (ids[5], ids[9], True, "congress"), (ids[6], None, True, "congress"),
            ]:
                cur.execute("INSERT INTO pg_temp.politician_memberships VALUES (%s,%s,%s,%s)", (person, party, active, chamber))
            for session, person, vote in [
                (ids[0], ids[3], "Sí"), (ids[0], ids[4], "No"), (ids[0], ids[5], "Abstención"),
                (ids[0], ids[6], "Sí"), (ids[0], ids[7], "No vota"),
                (ids[1], ids[3], "No"), (ids[1], ids[4], "Sí"),
            ]:
                cur.execute("INSERT INTO pg_temp.votes VALUES (%s,%s,%s)", (session, person, vote))
            reference = (ROOT / "supabase/migrations/20260528020001_voting_summary_chamber.sql").read_text()
            reference = reference[reference.index("CREATE OR REPLACE VIEW"):reference.index("GRANT SELECT")]
            cur.execute(reference.replace("v_voting_session_summary", "pg_temp.voting_reference"))
            migration = (ROOT / "supabase/migrations/20261013120000_bounded_voting_tallies.sql").read_text()
            cur.execute(migration.split("REVOKE ALL")[0].replace("public.", "pg_temp."))
            cur.execute("SELECT id,vote_count,votes_yes,votes_no,votes_abstain,divergence_count FROM pg_temp.voting_reference ORDER BY id")
            expected = cur.fetchall()
            cur.execute("SELECT * FROM pg_temp.get_voting_session_tallies(%s::uuid[]) ORDER BY id", (ids[:3],))
            assert cur.fetchall() == expected
            assert expected[2][1:] == (0, 0, 0, 0, 0)
            cur.execute("SELECT * FROM pg_temp.get_voting_session_tallies('{}'::uuid[])")
            assert cur.fetchall() == []
        conn.rollback()
