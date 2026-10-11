import json
import os
from pathlib import Path
from decimal import Decimal
import pytest
from ine.subsectors import SECTORS, ITEMS, decode, build_records, replace_snapshot


def payload():
    dims = dict(
        time=["2024"],
        sector=SECTORS,
        geo=["ES"],
        na_item=ITEMS,
        unit=["MIO_EUR"],
        freq=["A"],
    )
    return dict(
        id=list(dims),
        size=[len(v) for v in dims.values()],
        dimension={
            k: {"category": {"index": dict(zip(v, range(len(v))))}}
            for k, v in dims.items()
        },
        value={
            str(s * 3 + i): v
            for s in range(5)
            for i, v in enumerate([100, 120, -20] if s == 0 else [50, 55, -5])
        },
    )


def test_consolidation_is_not_a_share_but_balances_reconcile():
    raw = payload()
    raw["status"] = {"4": "p"}
    records = build_records(raw, "2026-10-11T00:00:00Z")
    assert len(records) == 15
    assert sum(r[4] for r in records if r[1] != "S13" and r[3] == "TE") == 220
    assert records[1][4] == 120
    assert json.loads(records[4][-1])["flags"] == ["p"]
    assert records == build_records(raw, "2026-10-11T00:00:00Z")


@pytest.mark.parametrize(
    "issue",
    [
        "missing",
        "identity",
        "balance",
        "negative",
        "nan",
        "duplicate",
        "scope",
        "dimensions",
        "empty",
        "year",
    ],
)
def test_bad_snapshot_retains_previous_data(issue):
    raw = payload()
    if issue == "missing":
        raw["value"].pop("14")
    if issue == "identity":
        raw["value"]["0"] = 101
    if issue == "balance":
        raw["value"]["3"] = 60
        raw["value"]["5"] = 5
    if issue == "negative":
        raw["value"]["1"] = -1
    if issue == "nan":
        raw["value"]["2"] = float("nan")
    if issue == "duplicate":
        raw["value"]["00"] = 100
    if issue == "scope":
        raw["dimension"]["geo"]["category"]["index"] = {"FR": 0}
    if issue == "dimensions":
        raw["id"][0] = "sector"
    if issue == "empty":
        raw["value"] = {}
    if issue == "year":
        raw["dimension"]["time"]["category"]["index"] = {"2024Q1": 0}
    with pytest.raises(ValueError):
        build_records(raw)


def test_dense_zero_empty_year_and_rounding():
    raw = payload()
    raw["value"] = [0] * 15
    assert len(build_records(raw)) == 15
    raw["size"][0] = 2
    raw["dimension"]["time"]["category"]["index"] = {"2024": 0, "2025": 1}
    assert len(build_records(raw)) == 15
    raw["value"].append(0)
    with pytest.raises(ValueError, match="Incomplete"):
        build_records(raw)
    raw = payload()
    raw["value"]["0"] = 100.2
    assert len(build_records(raw)) == 15


@pytest.mark.skipif(
    not os.getenv("TEST_COFOG_DB_URL"), reason="disposable PostgreSQL only"
)
def test_migration_seed_idempotence_rollback_and_read_permissions():
    import psycopg2

    conn = psycopg2.connect(os.environ["TEST_COFOG_DB_URL"])
    conn.set_client_encoding("UTF8")
    migrations = Path(__file__).resolve().parents[2] / "supabase/migrations"
    try:
        with conn.cursor() as cur:
            for role in ["anon", "authenticated", "service_role"]:
                cur.execute("SELECT 1 FROM pg_roles WHERE rolname=%s", (role,))
                if not cur.fetchone():
                    cur.execute(f"CREATE ROLE {role}")
            pre = (
                (migrations / "20260514180000_multilevel_responsibility.sql")
                .read_text()
                .split("CREATE TABLE IF NOT EXISTS etl_runs (", 1)[1]
                .split(");", 1)[0]
            )
            cur.execute("CREATE TABLE IF NOT EXISTS etl_runs (" + pre + ");")
            cur.execute("DROP TABLE IF EXISTS fiscal_sector_accounts")
            cur.execute(
                (migrations / "20261011020000_fiscal_sector_accounts.sql").read_text()
            )
            cur.execute(
                "SELECT count(*),min(year),max(year) FROM fiscal_sector_accounts"
            )
            assert cur.fetchone() == (150, 2016, 2025)
            cur.execute(
                "SELECT year,sector FROM fiscal_sector_accounts GROUP BY year,sector HAVING count(*)<>3 OR abs(sum(value) FILTER(WHERE item='TR')-sum(value) FILTER(WHERE item='TE')-sum(value) FILTER(WHERE item='B9'))>0.3"
            )
            assert cur.fetchall() == []
            cur.execute(
                "SELECT year FROM fiscal_sector_accounts WHERE item='B9' GROUP BY year HAVING abs(sum(value) FILTER(WHERE sector<>'S13')-sum(value) FILTER(WHERE sector='S13'))>0.6"
            )
            assert cur.fetchall() == []
            records = build_records(payload())
            replace_snapshot(cur, records)
            replace_snapshot(cur, records)
            cur.execute("SELECT count(*) FROM fiscal_sector_accounts")
            assert cur.fetchone()[0] == 15
        conn.commit()
        with pytest.raises(psycopg2.Error):
            with conn.cursor() as cur:
                bad = list(records[0])
                bad[4] = Decimal(-1)
                replace_snapshot(cur, [bad])
        conn.rollback()
        with conn.cursor() as cur:
            cur.execute("SET LOCAL ROLE anon")
            cur.execute("SELECT count(*) FROM fiscal_sector_accounts")
            assert cur.fetchone()[0] == 15
        with pytest.raises(psycopg2.Error):
            with conn.cursor() as cur:
                cur.execute("DELETE FROM fiscal_sector_accounts")
        conn.rollback()
    finally:
        conn.close()
