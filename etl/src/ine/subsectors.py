"""Bounded ESA accounts by sector. Flows are not shares of consolidated S13."""

import argparse
import json
import math
from datetime import datetime, timezone
from decimal import Decimal
from urllib.parse import urlencode
from ine.bde import fetch_deuda_json

SECTORS = ["S13", "S1311", "S1312", "S1313", "S1314"]
ITEMS = ["TR", "TE", "B9"]
SOURCE_URL = (
    "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/gov_10a_main?"
    + urlencode(
        dict(
            geo="ES",
            unit="MIO_EUR",
            freq="A",
            sinceTimePeriod="2016",
            na_item=ITEMS,
            sector=SECTORS,
        ),
        doseq=True,
    )
)


def decode(raw):
    ids, sizes = raw["id"], raw["size"]
    if (
        len(ids) != len(set(ids))
        or set(ids) != {"geo", "unit", "freq", "sector", "na_item", "time"}
        or len(ids) != len(sizes)
    ):
        raise ValueError("Unexpected sector dimensions")
    cats = {}
    for dim, size in zip(ids, sizes):
        index = raw["dimension"][dim]["category"]["index"]
        index = (
            dict(zip(index, range(len(index)))) if isinstance(index, list) else index
        )
        if (
            not isinstance(size, int)
            or size <= 0
            or sorted(index.values()) != list(range(size))
        ):
            raise ValueError("Invalid sector dimension index")
        cats[dim] = {pos: code for code, pos in index.items()}
    for dim, expected in dict(
        geo=["ES"], unit=["MIO_EUR"], freq=["A"], sector=SECTORS, na_item=ITEMS
    ).items():
        if set(cats[dim].values()) != set(expected):
            raise ValueError("Unexpected sector scope or unit")
    facts, seen = {}, set()
    values, flags = raw.get("value", {}), raw.get("status", {})
    for flat, value in (
        enumerate(values) if isinstance(values, list) else values.items()
    ):
        offset = int(flat)
        if offset in seen or not 0 <= offset < math.prod(sizes):
            raise ValueError("Duplicate or invalid offset")
        seen.add(offset)
        if value is None:
            continue
        if (
            isinstance(value, bool)
            or not isinstance(value, (int, float))
            or not math.isfinite(value)
        ):
            raise ValueError("Invalid sector amount")
        rem, coords = offset, {}
        for dim, size in reversed(list(zip(ids, sizes))):
            coords[dim] = cats[dim][rem % size]
            rem //= size
        year, sector, item = coords["time"], coords["sector"], coords["na_item"]
        if not year.isdigit() or len(year) != 4 or not 2016 <= int(year) <= 2100:
            raise ValueError("Invalid sector year")
        if item != "B9" and value < 0:
            raise ValueError("Negative revenue or expenditure")
        flag = (
            flags[offset]
            if isinstance(flags, list) and offset < len(flags)
            else flags.get(str(flat), "")
            if isinstance(flags, dict)
            else ""
        )
        key = (int(year), sector, item)
        if key in facts:
            raise ValueError("Duplicate sector observation")
        facts[key] = (Decimal(str(value)), flag)
    return facts


def build_records(raw, retrieved_at=None):
    facts = decode(raw)
    retrieved_at = retrieved_at or datetime.now(timezone.utc).isoformat()
    records = []
    for year in sorted({k[0] for k in facts}):
        if any((year, s, i) not in facts for s in SECTORS for i in ITEMS):
            raise ValueError(f"Incomplete sector year {year}")
        for sector in SECTORS:
            residual = (
                facts[year, sector, "TR"][0]
                - facts[year, sector, "TE"][0]
                - facts[year, sector, "B9"][0]
            )
            if abs(residual) > Decimal("0.3"):
                raise ValueError(f"Sector identity failed {year}/{sector}")
        balance = (
            sum(facts[year, s, "B9"][0] for s in SECTORS[1:])
            - facts[year, "S13", "B9"][0]
        )
        if abs(balance) > Decimal("0.6"):
            raise ValueError(f"Subsector balance mismatch {year}")
        # Revenue/expenditure differences need not be zero: consolidation is not allocation.
        for sector in SECTORS:
            for item in ITEMS:
                value, flag = facts[year, sector, item]
                meta = dict(
                    source="Eurostat",
                    dataset="gov_10a_main",
                    source_url=SOURCE_URL,
                    frequency="A",
                    unit="MIO_EUR",
                    mapping_version="esa-sectors-v1",
                    flags=[flag] if flag else [],
                    retrieved_at=retrieved_at,
                    source_updated=raw.get("updated"),
                )
                records.append(
                    ("ES", sector, year, item, value, "MIO_EUR", json.dumps(meta))
                )
    if not records:
        raise ValueError("Empty sector snapshot; previous data retained")
    return records


def replace_snapshot(cur, records):
    cur.execute("DELETE FROM fiscal_sector_accounts WHERE geo='ES' AND year>=2016")
    cur.executemany(
        """INSERT INTO fiscal_sector_accounts (geo,sector,year,item,value,unit,raw_data)
        VALUES (%s,%s,%s,%s,%s,%s,%s) ON CONFLICT (geo,sector,year,item) DO UPDATE SET
        value=EXCLUDED.value,unit=EXCLUDED.unit,raw_data=EXCLUDED.raw_data""",
        records,
    )


def run(dry_run=False):
    if dry_run:
        records = build_records(fetch_deuda_json(SOURCE_URL))
        print(f"Validated {len(records)} sector observations; no database writes")
        return
    from common.db import get_pg_conn
    from common.etl_runs import start_run, finish_run

    conn, run_id = get_pg_conn(), None
    try:
        with conn.cursor() as cur:
            run_id = start_run(cur, pipeline="ine.subsectors")
        conn.commit()
        records = build_records(fetch_deuda_json(SOURCE_URL))
        with conn.cursor() as cur:
            replace_snapshot(cur, records)
            finish_run(
                cur,
                run_id=run_id,
                status="succeeded",
                rows_read=len(records),
                rows_inserted=len(records),
            )
        conn.commit()
    except Exception as exc:
        conn.rollback()
        if run_id:
            with conn.cursor() as cur:
                finish_run(
                    cur, run_id=run_id, status="failed", error_summary=str(exc)[:500]
                )
            conn.commit()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    run(parser.parse_args().dry_run)
