"""Identity regressions against a disposable PostgreSQL schema."""
import os
from uuid import uuid4

import psycopg2
import psycopg2.extras
import pytest

from src.senado import votaciones as mod
from .test_senado_votaciones import SAMPLE_SESSION_VOTES


@pytest.fixture
def db():
    url = os.environ.get("TEST_COFOG_DB_URL")
    if not url:
        pytest.skip("requires disposable TEST_COFOG_DB_URL (provided in CI)")
    conn = psycopg2.connect(url)
    schema = "senate_test_" + uuid4().hex
    with conn.cursor() as cur:
        cur.execute(f'CREATE SCHEMA "{schema}"')
        cur.execute(f'SET search_path TO "{schema}"')
        cur.execute("""
            CREATE TABLE legislatures (id text PRIMARY KEY, number integer);
            CREATE TABLE politicians (
                id text PRIMARY KEY, full_name text, first_name text,
                last_name text, senate_id text
            );
            CREATE TABLE politician_memberships (
                politician_id text, legislature_id text, chamber text
            );
            CREATE TABLE voting_sessions (
                id serial PRIMARY KEY, legislature_id text, session_number integer,
                date date, title text, initiative_number text, chamber text,
                votacion_number integer, raw_data jsonb,
                UNIQUE(session_number,date,legislature_id,votacion_number,chamber)
            );
            CREATE TABLE votes (
                voting_session_id integer, politician_id text, vote text,
                raw_data jsonb, PRIMARY KEY(voting_session_id,politician_id)
            );
            CREATE TABLE senate_vote_unmatched_names (
                normalized_name text, name text, parliamentary_group text,
                first_seen_session integer, last_seen_session integer,
                vote_rows integer, seen_vote_keys text[] NOT NULL DEFAULT '{}',
                sample_source_url text, sample_raw_data jsonb DEFAULT '{}',
                updated_at timestamptz DEFAULT now(),
                PRIMARY KEY(normalized_name,parliamentary_group)
            );
            INSERT INTO legislatures VALUES ('xv',15),('xiv',14);
        """)
        yield cur
    conn.rollback()
    conn.close()


def person(cur, pid="p", name="PUJOL BONELL, EDUARD", first="Eduard",
           last="Pujol Bonell", official="20013", leg="xv", chamber="senate"):
    cur.execute("INSERT INTO politicians VALUES (%s,%s,%s,%s,%s)",
                (pid,name,first,last,official))
    cur.execute("INSERT INTO politician_memberships VALUES (%s,%s,%s)",
                (pid,leg,chamber))


def votation():
    result = mod.parse_senate_session_vote_xml(SAMPLE_SESSION_VOTES, "https://www.senado.es/legis15/votaciones/ses_60.xml")[0]
    result.votes = [mod.SenateVoteRow("EDUARDO PUJOL BONELL", "Sí", "54", "GPPLU"),
                    mod.SenateVoteRow("PERSONA DESCONOCIDA", "No", "55", "GPPLU")]
    return result


def test_alias_links_by_official_identity_and_preserves_provenance(db):
    person(db)
    index = mod.build_senator_index(db)
    assert mod.resolve_senator("EDUARDO PUJOL BONELL", index) == "p"
    assert mod.upsert_senate_votation(db,"xv",votation(),index) == (1,1)
    db.execute("SELECT raw_data FROM votes")
    raw = db.fetchone()[0]
    assert raw["name"] == "EDUARDO PUJOL BONELL"
    assert raw["identity_alias"]["senate_id"] == 20013
    assert "id1=20013" in raw["identity_alias"]["profile_url"]


@pytest.mark.parametrize("mode", ["missing","duplicate","other_legislature","other_chamber","namesake"])
def test_unverified_or_conflicting_identity_remains_pending(db, mode):
    if mode == "missing":
        person(db, official="999")
    elif mode == "duplicate":
        person(db)
        person(db,pid="q",name="Otro",first="Otro",last="",official="20013")
    elif mode == "other_legislature":
        person(db,leg="xiv")
    elif mode == "other_chamber":
        person(db,chamber="congress")
    else:
        person(db)
        person(db,pid="q",name="EDUARDO PUJOL BONELL",first="Eduardo",last="Pujol Bonell",official="999")
    index = mod.build_senator_index(db)
    assert mod.resolve_senator("EDUARDO PUJOL BONELL", index) is None
    assert mod.upsert_senate_votation(db,"xv",votation(),index) == (0,2)
    db.execute("SELECT count(*) FROM votes")
    assert db.fetchone()[0] == 0


def test_names_are_automatic_but_collisions_and_unknowns_are_not_guessed(db):
    person(db,pid="p",name="LEYTE COELLO, MARÍA DEL CARMEN",first="María del Carmen",last="Leyte Coello",official="11")
    index = mod.build_senator_index(db)
    assert mod.resolve_senator("MARIA CARMEN LEYTE COELLO",index) == "p"
    assert mod.resolve_senator("MARIA CARMEN LEYTE COELL",index) is None
    person(db,pid="q",name="Otra",first="María del Carmen",last="Leyte Coello",official="12")
    assert mod.resolve_senator("MARIA CARMEN LEYTE COELLO",mod.build_senator_index(db)) is None


def test_replay_repairs_partial_votes_and_only_removes_proven_pending_keys(db):
    # First pass lacks the verified identity. Registry insertion is idempotent.
    assert mod.upsert_senate_votation(db,"xv",votation(),{}) == (0,2)
    assert mod.upsert_senate_votation(db,"xv",votation(),{}) == (0,2)
    db.execute("SELECT sum(vote_rows) FROM senate_vote_unmatched_names")
    assert db.fetchone()[0] == 2
    person(db)
    index = mod.build_senator_index(db)
    for _ in range(2):
        assert mod.upsert_senate_votation(db,"xv",votation(),index) == (1,1)
    db.execute("SELECT count(*) FROM votes")
    assert db.fetchone()[0] == 1
    db.execute("SELECT normalized_name,vote_rows FROM senate_vote_unmatched_names")
    assert db.fetchall() == [("persona desconocida",1)]


def test_partial_registry_cleanup_preserves_other_occurrences_and_legacy_counts(db):
    db.execute("""
        INSERT INTO senate_vote_unmatched_names
          (normalized_name,parliamentary_group,vote_rows,seen_vote_keys)
        VALUES ('n','g',5,ARRAY['a','b']),
               ('other','g',1,ARRAY['z'])
    """)
    mod.resolve_tracked_senate_votes(db,["a"])
    mod.resolve_tracked_senate_votes(db,["a"])
    db.execute("SELECT vote_rows,seen_vote_keys FROM senate_vote_unmatched_names WHERE normalized_name='n'")
    assert db.fetchone() == (4,["b"])
    mod.resolve_tracked_senate_votes(db,["b"])
    db.execute("SELECT vote_rows,seen_vote_keys FROM senate_vote_unmatched_names WHERE normalized_name='n'")
    assert db.fetchone() == (3,[])
    db.execute("SELECT vote_rows FROM senate_vote_unmatched_names WHERE normalized_name='other'")
    assert db.fetchone()[0] == 1


def test_duplicate_resolved_rows_fail_instead_of_inflating_coverage(db):
    person(db)
    vote = votation()
    vote.votes = [vote.votes[0],vote.votes[0]]
    with pytest.raises(RuntimeError,match="same senator"):
        mod.upsert_senate_votation(db,"xv",vote,mod.build_senator_index(db))


def test_plural_non_voter_is_preserved_and_unknown_labels_fail():
    xml = SAMPLE_SESSION_VOTES.replace("<voto>SÍ</voto>","<voto>No votan</voto>")
    result = mod.parse_senate_session_vote_xml(xml,"official")[0]
    assert len(result.votes) == 3
    assert result.votes[0].vote == "No vota"
    assert result.votes[0].absent is False
    with pytest.raises(RuntimeError,match="Unknown official vote label"):
        mod.parse_senate_session_vote_xml(xml.replace("No votan","Sin clasificación"),"official")


def test_resume_reconciles_sessions_even_when_they_already_have_votes(monkeypatch):
    from .test_senado_votaciones import _FakeVotesConn
    monkeypatch.setattr(mod,"get_pg_conn",lambda: _FakeVotesConn())
    monkeypatch.setattr(mod,"discover_session_vote_urls",lambda **kw:["official"])
    monkeypatch.setattr(mod,"fetch_senate_session_votations",lambda url:[votation()])
    monkeypatch.setattr(mod,"build_senator_index",lambda cur:{})
    monkeypatch.setattr(mod,"start_run",lambda *a,**kw:"run")
    monkeypatch.setattr(mod,"finish_run",lambda *a,**kw:None)
    calls = []
    monkeypatch.setattr(mod,"upsert_senate_votation",lambda *args: calls.append(args) or (1,1))
    mod.run(resume=True)
    assert len(calls) == 1


def test_production_verification_checks_identity_value_and_source_evidence(db):
    person(db)
    vote = votation()
    vote.votes = vote.votes[:1]
    index = mod.build_senator_index(db)
    mod.upsert_senate_votation(db,"xv",vote,index)
    db.execute("SELECT id FROM voting_sessions")
    sid = db.fetchone()[0]
    assert mod.verify_stored_senate_votation(db,sid,vote,index) == 1
    db.execute("UPDATE votes SET vote='No'")
    with pytest.raises(RuntimeError,match="differ"):
        mod.verify_stored_senate_votation(db,sid,vote,index)
    db.execute("UPDATE votes SET vote='Sí',politician_id='wrong-person'")
    with pytest.raises(RuntimeError,match="differ"):
        mod.verify_stored_senate_votation(db,sid,vote,index)
    db.execute("UPDATE votes SET politician_id='p',raw_data='{}'")
    with pytest.raises(RuntimeError,match="differ"):
        mod.verify_stored_senate_votation(db,sid,vote,index)


def test_production_verification_rejects_unresolved_rows(db):
    with pytest.raises(RuntimeError,match="Unresolved"):
        mod.verify_stored_senate_votation(db,1,votation(),{})
