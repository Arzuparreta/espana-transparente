"""Annual general-government accounts, ESA 2010. No budget-credit proxies."""

import argparse
import json
import math
from datetime import datetime, timezone
from decimal import Decimal
from urllib.parse import urlencode

from ine.bde import fetch_deuda_json

BASE = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/"
SERIES = [
    {
        "code": "INGRESOS_PUBLICOS",
        "name": "Ingresos de las administraciones públicas",
        "items": ["TR"],
    },
    {
        "code": "GASTO_PUBLICO",
        "name": "Gasto de las administraciones públicas",
        "items": ["TE"],
    },
    {
        "code": "SALDO_PUBLICO",
        "name": "Saldo público: superávit (+), déficit (−)",
        "items": ["B9"],
    },
    {
        "code": "INTERESES_PUBLICOS",
        "name": "Intereses de las administraciones públicas",
        "items": ["D41PAY"],
    },
    {
        "code": "IMPUESTOS_PUBLICOS",
        "name": "Impuestos devengados antes del ajuste por incobrables",
        "items": ["D2REC", "D5REC", "D91REC"],
    },
    {
        "code": "COTIZACIONES_SOCIALES",
        "name": "Cotizaciones sociales netas (incluidas las imputadas)",
        "items": ["D61REC"],
    },
]


def dataset_url(dataset):
    return (
        BASE
        + dataset
        + "?"
        + urlencode(
            {
                "geo": "ES",
                "sector": "S13",
                "unit": "MIO_EUR",
                "freq": "A",
                "sinceTimePeriod": "2016",
                **({"na_item": "GD"} if dataset == "gov_10dd_edpt1" else {}),
            }
        )
    )


def observations(raw):
    """Decode JSON-stat using declared dimension order (not a time-only offset)."""
    ids, sizes = raw["id"], raw["size"]
    categories = {}
    for dimension in ids:
        index = raw["dimension"][dimension]["category"]["index"]
        categories[dimension] = (
            {position: name for name, position in index.items()}
            if isinstance(index, dict)
            else dict(enumerate(index))
        )
    values = raw.get("value", {})
    flags = raw.get("status", {})
    entries = enumerate(values) if isinstance(values, list) else values.items()
    result = {}
    for flat, value in entries:
        if value is None:
            continue
        if not isinstance(value, (int, float)) or not math.isfinite(value):
            raise ValueError("Non-finite fiscal observation")
        remainder = int(flat)
        coordinates = {}
        for dimension, size in reversed(list(zip(ids, sizes))):
            coordinates[dimension] = categories[dimension][remainder % size]
            remainder //= size
        if remainder or any(
            coordinates.get(k) != v
            for k, v in {
                "geo": "ES",
                "sector": "S13",
                "unit": "MIO_EUR",
                "freq": "A",
            }.items()
        ):
            raise ValueError("Unexpected fiscal scope or units")
        year = coordinates["time"]
        if not year.isdigit() or len(year) != 4:
            raise ValueError("Expected annual periods")
        flag = (
            flags[int(flat)]
            if isinstance(flags, list) and int(flat) < len(flags)
            else flags.get(str(flat), "")
            if isinstance(flags, dict)
            else ""
        )
        result[(coordinates["na_item"], year)] = (Decimal(str(value)), flag)
    return result


def build_records(accounts, debt, retrieved_at=None):
    retrieved_at = retrieved_at or datetime.now(timezone.utc).isoformat()
    facts = observations(accounts)
    years = sorted({year for _, year in facts})
    records = []
    specs = SERIES + [
        {
            "code": "DEUDA_PUBLICA",
            "name": "Deuda pública consolidada (Maastricht)",
            "items": ["GD"],
        }
    ]
    debt_facts = observations(debt)
    for year in years:
        if all((item, year) in facts for item in ("TR", "TE", "B9")):
            residual = (
                facts[("TR", year)][0] - facts[("TE", year)][0] - facts[("B9", year)][0]
            )
            if abs(residual) > Decimal("0.3"):
                raise ValueError(
                    f"Fiscal identity failed in {year}: {residual} million EUR"
                )
        for spec in specs:
            source = debt_facts if spec["code"] == "DEUDA_PUBLICA" else facts
            if not all((item, year) in source for item in spec["items"]):
                continue
            dataset = "gov_10dd_edpt1" if source is debt_facts else "gov_10a_main"
            value = sum(source[(item, year)][0] for item in spec["items"])
            flags = sorted(
                {
                    source[(item, year)][1]
                    for item in spec["items"]
                    if source[(item, year)][1]
                }
            )
            metadata = {
                "source": "Eurostat",
                "dataset": dataset,
                "source_url": dataset_url(dataset),
                "sector": "S13",
                "frequency": "A",
                "unit": "MIO_EUR",
                "items": spec["items"],
                "flags": flags,
                "retrieved_at": retrieved_at,
                "source_updated": (debt if source is debt_facts else accounts).get(
                    "updated"
                ),
            }
            records.append(
                (
                    spec["code"],
                    spec["name"],
                    year,
                    value,
                    "millones EUR",
                    json.dumps(metadata),
                )
            )
    if any(not any(record[0] == spec["code"] for record in records) for spec in specs):
        raise ValueError("Missing required fiscal series; previous snapshot retained")
    return records


def run(dry_run=False):
    if dry_run:
        records = build_records(
            fetch_deuda_json(dataset_url("gov_10a_main")),
            fetch_deuda_json(dataset_url("gov_10dd_edpt1")),
        )
        print(
            f"Validated {len(records)} annual fiscal observations; no database writes"
        )
        return
    from common.db import get_pg_conn
    from common.etl_runs import start_run, finish_run

    conn = get_pg_conn()
    run_id = None
    try:
        with conn.cursor() as cur:
            run_id = start_run(cur, pipeline="ine.fiscal")
        conn.commit()
        records = build_records(
            fetch_deuda_json(dataset_url("gov_10a_main")),
            fetch_deuda_json(dataset_url("gov_10dd_edpt1")),
        )
        with conn.cursor() as cur:
            # Replace this bounded snapshot atomically, including withdrawn observations.
            cur.execute(
                "DELETE FROM economic_indicators WHERE indicator_code = ANY(%s) AND period >= '2016'",
                ([s["code"] for s in SERIES] + ["DEUDA_PUBLICA"],),
            )
            cur.executemany(
                """INSERT INTO economic_indicators(indicator_code,indicator_name,period,value,unit,raw_data)
                VALUES (%s,%s,%s,%s,%s,%s) ON CONFLICT(indicator_code,period) DO UPDATE SET
                indicator_name=EXCLUDED.indicator_name,value=EXCLUDED.value,unit=EXCLUDED.unit,raw_data=EXCLUDED.raw_data""",
                records,
            )
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
