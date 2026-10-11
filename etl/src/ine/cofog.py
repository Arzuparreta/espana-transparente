"""Reconciled COFOG level-I snapshot, Spain/S13/TE/MIO_EUR, 2016+."""
import argparse
import json
import math
from datetime import datetime, timezone
from decimal import Decimal
from urllib.parse import urlencode

from ine.bde import fetch_deuda_json
from ine.fiscal import dataset_url, observations

CODES = ["TOTAL"] + [f"GF{i:02}" for i in range(1, 11)]
TOLERANCE = Decimal("0.6")  # max rounding: ten components plus total at 0.1 M EUR
SOURCE_URL = (
    "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/gov_10a_exp?"
    + urlencode(dict(geo="ES", sector="S13", unit="MIO_EUR", freq="A", na_item="TE", sinceTimePeriod="2016"))
)


def decode(raw):
    ids, sizes = raw["id"], raw["size"]
    if len(ids) != len(set(ids)) or set(ids) != {"geo", "sector", "unit", "freq", "na_item", "cofog99", "time"} or len(ids) != len(sizes):
        raise ValueError("Unexpected COFOG dimensions")
    categories = {}
    for dim, size in zip(ids, sizes):
        index = raw["dimension"][dim]["category"]["index"]
        index = dict(zip(index, range(len(index)))) if isinstance(index, list) else index
        if size <= 0 or sorted(index.values()) != list(range(size)):
            raise ValueError("Invalid COFOG category index")
        categories[dim] = {pos: code for code, pos in index.items()}
    for dim, expected in dict(geo="ES", sector="S13", unit="MIO_EUR", freq="A", na_item="TE").items():
        if list(categories[dim].values()) != [expected]:
            raise ValueError("Unexpected COFOG scope or unit")
    values, flags = raw.get("value", {}), raw.get("status", {})
    facts = {}
    seen = set()
    for flat, value in (enumerate(values) if isinstance(values, list) else values.items()):
        offset = int(flat)
        if offset in seen or offset < 0 or offset >= math.prod(sizes):
            raise ValueError("Duplicate or invalid COFOG offset")
        seen.add(offset)
        if value is None:
            continue
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0:
            raise ValueError("Invalid COFOG amount")
        remainder, coords = offset, {}
        for dim, size in reversed(list(zip(ids, sizes))):
            coords[dim] = categories[dim][remainder % size]
            remainder //= size
        year, code = coords["time"], coords["cofog99"]
        if not year.isdigit() or len(year) != 4 or not 2016 <= int(year) <= 2100:
            raise ValueError("Invalid COFOG year")
        if code not in CODES:  # groups are nested; never sum them with divisions
            continue
        flag = flags[offset] if isinstance(flags, list) and offset < len(flags) else flags.get(str(flat), "") if isinstance(flags, dict) else ""
        key = (year, code)
        if key in facts:
            raise ValueError("Duplicate COFOG observation")
        facts[key] = (Decimal(str(value)), flag)
    return facts


def build_records(raw, accounts, retrieved_at=None):
    facts, totals = decode(raw), observations(accounts)
    retrieved_at = retrieved_at or datetime.now(timezone.utc).isoformat()
    records = []
    for year in sorted({year for year, _ in facts}):
        if any((year, code) not in facts for code in CODES):
            raise ValueError(f"Incomplete COFOG year {year}; snapshot retained")
        total = facts[year, "TOTAL"][0]
        residual = sum(facts[year, code][0] for code in CODES[1:]) - total
        if abs(residual) > TOLERANCE:
            raise ValueError(f"COFOG reconciliation failed in {year}: {residual}")
        if ("TE", year) not in totals or abs(totals["TE", year][0] - total) > TOLERANCE:
            raise ValueError(f"COFOG/accounts mismatch in {year}")
        for code in CODES:
            value, flag = facts[year, code]
            metadata = dict(
                source="Eurostat", dataset="gov_10a_exp", source_url=SOURCE_URL,
                frequency="A", na_item="TE", mapping_version="cofog-level1-v1",
                flags=[flag] if flag else [], retrieved_at=retrieved_at,
                source_updated=raw.get("updated"),
                accounts_total=str(totals["TE", year][0]),
                accounts_flags=[totals["TE", year][1]] if totals["TE", year][1] else [],
                accounts_updated=accounts.get("updated"), reconciliation_residual=str(residual),
            )
            records.append(("ES", "S13", int(year), code, value, "MIO_EUR", json.dumps(metadata)))
    if not records:
        raise ValueError("No complete COFOG observations; snapshot retained")
    return records


def replace_snapshot(cur, records):
    cur.execute("DELETE FROM expenditure_functions WHERE geo='ES' AND sector='S13' AND year >= 2016")
    cur.executemany("""INSERT INTO expenditure_functions
        (geo, sector, year, function_code, value, unit, raw_data)
        VALUES (%s,%s,%s,%s,%s,%s,%s)
        ON CONFLICT (geo, sector, year, function_code) DO UPDATE SET
          value=EXCLUDED.value, unit=EXCLUDED.unit, raw_data=EXCLUDED.raw_data""", records)


def run(dry_run=False):
    # All validation precedes DELETE; replacement and successful run are atomic.
    if dry_run:
        records = build_records(fetch_deuda_json(SOURCE_URL), fetch_deuda_json(dataset_url("gov_10a_main")))
        print(f"Validated {len(records)} COFOG observations; no database writes")
        return
    from common.db import get_pg_conn
    from common.etl_runs import start_run, finish_run
    conn, run_id = get_pg_conn(), None
    try:
        with conn.cursor() as cur:
            run_id = start_run(cur, pipeline="ine.cofog")
        conn.commit()
        records = build_records(fetch_deuda_json(SOURCE_URL), fetch_deuda_json(dataset_url("gov_10a_main")))
        with conn.cursor() as cur:
            replace_snapshot(cur, records)
            finish_run(cur, run_id=run_id, status="succeeded", rows_read=len(records), rows_inserted=len(records))
        conn.commit()
    except Exception as exc:
        conn.rollback()
        if run_id:
            with conn.cursor() as cur:
                finish_run(cur, run_id=run_id, status="failed", error_summary=str(exc)[:500])
            conn.commit()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    run(parser.parse_args().dry_run)
