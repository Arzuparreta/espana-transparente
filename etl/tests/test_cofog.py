import json
import os
from decimal import Decimal
from pathlib import Path

import pytest
from ine.cofog import CODES, build_records, decode, replace_snapshot
from tests.test_fiscal import payload as accounts_payload


def payload(values=None, codes=None):
    # Time first deliberately differs from Eurostat's production axis order.
    codes = codes or CODES
    dims = dict(time=["2024"], geo=["ES"], cofog99=codes, sector=["S13"], unit=["MIO_EUR"], freq=["A"], na_item=["TE"])
    return dict(id=list(dims), size=[len(c) for c in dims.values()],
                dimension={d: {"category": {"index": dict(zip(c, range(len(c))))}} for d, c in dims.items()},
                value=values if values is not None else {str(i): 100 if i == 0 else 10 for i in range(11)})


def accounts(value=100):
    return accounts_payload(["TE"], years=("2024",), values={"0": value})


def test_reconciliation_metadata_idempotent_records():
    raw = payload(); raw["status"] = {"2": "p"}
    records = build_records(raw, accounts(), "2026-10-11T00:00:00Z")
    assert len(records) == 11
    assert records == build_records(raw, accounts(), "2026-10-11T00:00:00Z")
    assert records[0][:6] == ("ES", "S13", 2024, "TOTAL", Decimal(100), "MIO_EUR")
    assert json.loads(records[2][-1])["flags"] == ["p"]
    assert json.loads(records[0][-1])["accounts_total"] == "100"


def test_dense_values_zero_and_nested_groups_are_not_double_counted():
    raw = payload(values=[0] * 12, codes=CODES + ["GF0101"])
    raw["value"][-1] = 25
    assert len(build_records(raw, accounts(0))) == 11
    assert decode(raw)["2024", "TOTAL"][0] == 0


@pytest.mark.parametrize("change", ["scope", "unit", "missing", "negative", "nan", "duplicate", "sum", "empty"])
def test_invalid_snapshot_is_rejected(change):
    raw = payload()
    if change == "scope": raw["dimension"]["sector"]["category"]["index"] = {"S1311": 0}
    if change == "unit": raw["dimension"]["unit"]["category"]["index"] = {"PC_GDP": 0}
    if change == "missing": del raw["value"]["1"]
    if change == "negative": raw["value"]["1"] = -1
    if change == "nan": raw["value"]["1"] = float("nan")
    if change == "duplicate": raw["value"]["01"] = 10
    if change == "sum": raw["value"]["1"] = 30
    if change == "empty": raw["value"] = {}
    with pytest.raises(ValueError): build_records(raw, accounts())


def test_reconciliation_with_accounts_is_required():
    with pytest.raises(ValueError, match="accounts mismatch"):
        build_records(payload(), accounts(101))
    assert len(build_records(payload(), accounts(100.5))) == 11


def test_empty_year_is_not_zero_or_a_partial_new_snapshot():
    raw = payload()
    raw["dimension"]["time"]["category"]["index"] = {"2024": 0, "2025": 1}
    raw["size"][0] = 2
    assert len(build_records(raw, accounts())) == 11
    raw["value"]["11"] = 0
    with pytest.raises(ValueError, match="Incomplete COFOG year"):
        build_records(raw, accounts())


@pytest.mark.skipif(not os.getenv("TEST_COFOG_DB_URL"), reason="isolated PostgreSQL integration only")
def test_postgres_idempotence_rollback_scope_and_public_permissions():
    import psycopg2
    conn = psycopg2.connect(os.environ["TEST_COFOG_DB_URL"])
    try:
        # TEST_COFOG_DB_URL must name a disposable test database, never production.
        migrations = Path(__file__).resolve().parents[2] / "supabase" / "migrations"
        prerequisite = (migrations / "20260514180000_multilevel_responsibility.sql").read_text()
        etl_runs = prerequisite.split("CREATE TABLE IF NOT EXISTS etl_runs (", 1)[1].split(");", 1)[0]
        with conn.cursor() as cur:
            for role in ("anon", "authenticated", "service_role"):
                cur.execute("SELECT 1 FROM pg_roles WHERE rolname=%s", (role,))
                if not cur.fetchone():
                    cur.execute(f"CREATE ROLE {role}")
            cur.execute("CREATE TABLE IF NOT EXISTS etl_runs (" + etl_runs + ");")
            cur.execute("DROP TABLE IF EXISTS expenditure_functions")
            cur.execute((migrations / "20261011000000_expenditure_functions.sql").read_text())
            cur.execute("SELECT count(*), min(year), max(year) FROM expenditure_functions")
            assert cur.fetchone() == (99, 2016, 2024)
            cur.execute("""SELECT year FROM expenditure_functions GROUP BY year
                HAVING abs(sum(value) FILTER (WHERE function_code <> 'TOTAL') -
                    max(value) FILTER (WHERE function_code = 'TOTAL')) > 0.6
                OR count(*) <> 11
                OR max(abs(value - (raw_data->>'accounts_total')::numeric))
                    FILTER (WHERE function_code = 'TOTAL') > 0.6""")
            assert cur.fetchall() == []
            cur.execute("SELECT count(*) FROM etl_runs WHERE pipeline='ine.cofog' AND status='succeeded'")
            assert cur.fetchone()[0] >= 1
        conn.commit()
        records = build_records(payload(), accounts(), "2026-10-11T00:00:00Z")
        with conn.cursor() as cur:
            replace_snapshot(cur, records)
            replace_snapshot(cur, records)
            # An independent subsector survives replacement of S13.
            other = list(records[0]); other[1] = "S1311"
            cur.execute("INSERT INTO expenditure_functions VALUES (%s,%s,%s,%s,%s,%s,%s) ON CONFLICT DO NOTHING", other)
        conn.commit()
        with conn.cursor() as cur:
            cur.execute("SELECT count(*) FROM expenditure_functions WHERE sector='S13'")
            assert cur.fetchone()[0] == 11
            replace_snapshot(cur, records)
            cur.execute("SELECT count(*) FROM expenditure_functions WHERE sector='S1311'")
            assert cur.fetchone()[0] == 1
        conn.commit()
        bad = list(records[0]); bad[4] = -1
        with pytest.raises(psycopg2.Error):
            with conn.cursor() as cur: replace_snapshot(cur, [bad])
        conn.rollback()
        with conn.cursor() as cur:
            cur.execute("SELECT count(*) FROM expenditure_functions WHERE sector='S13'")
            assert cur.fetchone()[0] == 11
            cur.execute("SET LOCAL ROLE anon")
            cur.execute("SELECT count(*) FROM expenditure_functions")
            assert cur.fetchone()[0] == 12
        with pytest.raises(psycopg2.Error):
            with conn.cursor() as cur: cur.execute("DELETE FROM expenditure_functions")
        conn.rollback()
    finally:
        conn.close()
