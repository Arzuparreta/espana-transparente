import os
from pathlib import Path
from unittest.mock import Mock

import httpx
import pytest
from bdns.convocatorias import parse_call, fetch_call, store_calls, pending_codes, run


def call(**changes):
    return dict(codigoBDNS="877378", descripcion="Ayudas", descripcionFinalidad="Agricultura",
                tipoConvocatoria="Canónica", **changes)


def test_public_descriptor_has_no_beneficiary_budget_or_documents():
    raw = call(beneficiario="Private", presupuestoTotal=999, documentos=[{"id": 5}])
    row = parse_call(raw, "877378", "2026-10-11T00:00:00Z")
    assert row == ("877378", "Ayudas", "Agricultura", "Canónica",
                   "https://www.infosubvenciones.es/bdnstrans/GE/es/convocatoria/877378", "2026-10-11T00:00:00Z")


def test_missing_purpose_is_unknown_not_inferred():
    raw = call(); raw.pop("descripcionFinalidad")
    assert parse_call(raw, "877378")[2] is None


@pytest.mark.parametrize("change", ["identity", "title", "purpose", "code"])
def test_invalid_source_does_not_classify(change):
    raw = call(); code = "877378"
    if change == "identity": raw["codigoBDNS"] = "1078939"  # internal ID != BDNS code
    if change == "title": raw["descripcion"] = None
    if change == "purpose": raw["descripcionFinalidad"] = ["A", "B"]
    if change == "code": code = "877378junk"
    with pytest.raises(ValueError): parse_call(raw, code)


def test_fetch_retries_bad_json_and_stops_on_404(monkeypatch):
    monkeypatch.setattr("bdns.convocatorias.time.sleep", lambda _: None)
    request = httpx.Request("GET", "https://example.test")
    responses = [httpx.Response(200, content=b"<html>", request=request),
                 httpx.Response(200, json=call(), request=request)]
    getter = Mock(side_effect=lambda *a, **kw: responses.pop(0))
    monkeypatch.setattr("bdns.convocatorias.httpx.get", getter)
    assert fetch_call("877378")[2] == "Agricultura"
    assert getter.call_count == 2
    getter = Mock(return_value=httpx.Response(404, request=request))
    monkeypatch.setattr("bdns.convocatorias.httpx.get", getter)
    with pytest.raises(httpx.HTTPStatusError): fetch_call("877378")
    assert getter.call_count == 1


def test_fetch_returns_none_when_bdns_has_no_descriptor(monkeypatch):
    request = httpx.Request("GET", "https://example.test")
    getter = Mock(return_value=httpx.Response(204, request=request))
    monkeypatch.setattr("bdns.convocatorias.httpx.get", getter)
    assert fetch_call("1000000") is None
    assert getter.call_count == 1


def test_dry_run_with_codes_never_opens_database(monkeypatch):
    monkeypatch.setattr("bdns.convocatorias.get_pg_conn", lambda: pytest.fail("database opened"))
    monkeypatch.setattr("bdns.convocatorias.fetch_call", lambda code: parse_call(call(), code))
    run(codes=["877378", "877378"], dry_run=True)
    with pytest.raises(ValueError): run(limit=251, dry_run=True)


@pytest.mark.skipif(not os.getenv("TEST_COFOG_DB_URL"), reason="disposable PostgreSQL integration only")
def test_migration_aggregation_idempotence_rollback_and_read_permissions(monkeypatch):
    import psycopg2
    from decimal import Decimal
    conn = psycopg2.connect(os.environ["TEST_COFOG_DB_URL"])
    conn.set_client_encoding("UTF8")
    migration = Path(__file__).resolve().parents[2] / "supabase/migrations/20261011010000_bdns_call_purposes.sql"
    try:
        with conn.cursor() as cur:
            for role in ("anon", "authenticated", "service_role"):
                cur.execute("SELECT 1 FROM pg_roles WHERE rolname=%s", (role,))
                if not cur.fetchone(): cur.execute(f"CREATE ROLE {role}")
            cur.execute("DROP FUNCTION IF EXISTS subsidy_purpose_year(integer)")
            cur.execute("DROP TABLE IF EXISTS bdns_calls")
            prerequisite = (migration.parent / "20260514180000_multilevel_responsibility.sql").read_text()
            etl_runs = prerequisite.split("CREATE TABLE IF NOT EXISTS etl_runs (", 1)[1].split(");", 1)[0]
            cur.execute("CREATE TABLE IF NOT EXISTS etl_runs (" + etl_runs + ");")
            cur.execute("DROP TABLE IF EXISTS subsidies")
            cur.execute("CREATE TABLE subsidies (id integer PRIMARY KEY, numero_convocatoria text, fecha_concesion date, instrumento text, importe numeric)")
            cur.execute("ALTER TABLE subsidies ENABLE ROW LEVEL SECURITY")
            cur.execute("CREATE POLICY subsidies_read ON subsidies FOR SELECT TO anon, authenticated USING(true)")
            cur.execute("GRANT SELECT ON subsidies TO anon, authenticated")
            cur.execute(migration.read_text())
            cur.execute("DROP TABLE IF EXISTS bdns_call_misses")
            cur.execute((migration.parent / "20261019150000_bdns_call_misses.sql").read_text())
            raw = call(); row = parse_call(raw, "877378", "2026-10-11T00:00:00Z")
            store_calls(cur, [row, row])
            cur.execute("SELECT count(*) FROM bdns_calls")
            assert cur.fetchone()[0] == 2
            cur.execute("INSERT INTO subsidies VALUES (1,'877378','2024-01-01','Subvención',100), (2,'877378','2024-02-01','Subvención',0), (3,'877378','2024-01-01','Préstamo',200), (4,'99','2024-01-01','Subvención',NULL), (5,NULL,'2024-01-01',NULL,-10), (6,'877378','2023-01-01','Subvención',500), (7,'877378',NULL,'Subvención',600), (8,'88','2024-01-01','Subvención',NULL)")
            raw.pop("descripcionFinalidad"); raw["codigoBDNS"] = "88"
            store_calls(cur, [parse_call(raw, "88")])
            cur.execute("SELECT * FROM subsidy_purpose_year(2024)")
            groups = cur.fetchall()
            assert sum(r[3] for r in groups) == 6  # date-null and other year excluded
            assert {r[2]: r[5] for r in groups if r[0] == 'Agricultura'} == {"Subvención": Decimal(100), "Préstamo": Decimal(200)}
            assert sum(r[6] for r in groups) == 2
            assert sum(r[7] for r in groups) == 1
            assert {r[1] for r in groups} == {"classified", "pending", "not_published"}
            assert pending_codes(cur, 1) == ['99']
        conn.commit()
        with pytest.raises(psycopg2.Error):
            with conn.cursor() as cur: store_calls(cur, [("877378", None, None, None, "url", "2026-10-11T00:00:00Z")])
        conn.rollback()
        monkeypatch.setattr("bdns.convocatorias.CAPACITY", 3)
        with pytest.raises(ValueError, match="capacity"):
            with conn.cursor() as cur: store_calls(cur, [parse_call(dict(call(), codigoBDNS='99'), '99')])
        conn.rollback()
        with conn.cursor() as cur:
            assert pending_codes(cur, 100) == []  # full cache does not repeatedly select new codes
            cur.execute("UPDATE bdns_calls SET checked_at='2020-01-01' WHERE numero_convocatoria='877378'")
            assert pending_codes(cur, 100) == ['877378']
            cur.execute("SELECT finalidad FROM bdns_calls WHERE numero_convocatoria='877378'")
            assert cur.fetchone()[0] == 'Agricultura'
            cur.execute("SET LOCAL ROLE anon")
            cur.execute("SELECT * FROM subsidy_purpose_year(2024)")
            assert sum(r[3] for r in cur.fetchall()) == 6
        with pytest.raises(psycopg2.Error):
            with conn.cursor() as cur: cur.execute("DELETE FROM bdns_calls")
        conn.rollback()
    finally:
        conn.close()
