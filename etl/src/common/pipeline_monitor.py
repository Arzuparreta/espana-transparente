"""Record scheduled pipeline outcomes for ETLs without native etl_runs tracking."""

from __future__ import annotations

import argparse
import os
from datetime import date

from common.db import get_pg_conn
from common.etl_runs import finish_run, start_run


def start(pipeline: str) -> str:
    conn = get_pg_conn()
    try:
        cur = conn.cursor()
        run_id = start_run(
            cur,
            pipeline=pipeline,
            chunk_key=os.getenv("GITHUB_RUN_ID") or date.today().isoformat(),
            window_start=date.today(),
            window_end=date.today(),
        )
        conn.commit()
        cur.close()
        return str(run_id)
    finally:
        conn.close()


def finish(run_id: str, status: str, error_summary: str | None = None) -> None:
    conn = get_pg_conn()
    try:
        cur = conn.cursor()
        finish_run(
            cur,
            run_id=run_id,
            status=status,
            error_summary=error_summary,
        )
        conn.commit()
        cur.close()
    finally:
        conn.close()


def cleanup_stale_runs() -> int:
    conn = get_pg_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            UPDATE etl_runs
            SET status = 'failed',
                error_summary = 'Scheduled execution ended without reporting completion',
                finished_at = now()
            WHERE status = 'running'
              AND started_at < now() - interval '2 hours'
              AND chunk_key ~ '^[0-9]+$'
            """
        )
        updated = cur.rowcount
        conn.commit()
        cur.close()
        return updated
    finally:
        conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    start_parser = subparsers.add_parser("start")
    start_parser.add_argument("pipeline")

    finish_parser = subparsers.add_parser("finish")
    finish_parser.add_argument("run_id")
    finish_parser.add_argument("status", choices=("succeeded", "failed"))
    finish_parser.add_argument("--error-summary")

    subparsers.add_parser("cleanup")

    args = parser.parse_args()
    if args.command == "start":
        print(start(args.pipeline))
    elif args.command == "finish":
        finish(args.run_id, args.status, args.error_summary)
    else:
        print(cleanup_stale_runs())


if __name__ == "__main__":
    main()
