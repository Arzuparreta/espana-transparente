"""Refresh the PCSP purchase summary: awards by year, administration level and CPV division.

Budgets are project tender budgets excluding VAT, never awarded amounts or payments.
Legacy rows (no verified PCSP identity) contribute only their first published result.
"""
import argparse

from common.db import get_pg_conn
from common.etl_runs import finish_run, start_run

PIPELINE = "contratacion.resumen"


def refresh(cur):
    cur.execute("SELECT public.refresh_contract_purchase_summary()")
    written = cur.fetchone()[0]
    cur.execute("SELECT source_rows FROM public.contract_purchase_coverage WHERE scope='pcsp-643'")
    source_rows = cur.fetchone()[0]
    # A contracts table that has ever been ingested cannot legitimately summarise to nothing.
    if source_rows and not written:
        raise RuntimeError(f"Purchase summary empty for {source_rows} contract rows")
    return written, source_rows


def run(dry_run=False):
    conn, run_id = get_pg_conn(), None
    try:
        if dry_run:
            with conn.cursor() as cur:
                written, source_rows = refresh(cur)
            conn.rollback()
            print(f"Validated {written} summary rows from {source_rows} contracts; rolled back")
            return
        with conn.cursor() as cur:
            run_id = start_run(cur, pipeline=PIPELINE)
        conn.commit()
        with conn.cursor() as cur:
            written, source_rows = refresh(cur)
            finish_run(cur, run_id=run_id, status="succeeded", rows_read=source_rows, rows_inserted=written)
        conn.commit()
        print(f"{PIPELINE}: {written} summary rows from {source_rows} contracts")
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
