"""Helpers to register resumable ETL chunk executions."""

from __future__ import annotations

from datetime import date


def start_run(cur, *, pipeline: str, chunk_key: str | None = None, window_start: date | None = None, window_end: date | None = None) -> str:
    cur.execute(
        """
        INSERT INTO etl_runs (pipeline, chunk_key, window_start, window_end, status)
        VALUES (%s, %s, %s, %s, 'running')
        RETURNING id
        """,
        (pipeline, chunk_key, window_start, window_end),
    )
    return cur.fetchone()[0]


def finish_run(
    cur,
    *,
    run_id: str,
    status: str,
    rows_read: int = 0,
    rows_inserted: int = 0,
    rows_updated: int = 0,
    error_summary: str | None = None,
) -> None:
    cur.execute(
        """
        UPDATE etl_runs
        SET status = %s,
            rows_read = %s,
            rows_inserted = %s,
            rows_updated = %s,
            error_summary = %s,
            finished_at = now()
        WHERE id = %s
        """,
        (status, rows_read, rows_inserted, rows_updated, error_summary, run_id),
    )


def is_chunk_succeeded(
    cur, *, pipeline: str, chunk_key: str, window_start: date, window_end: date
) -> bool:
    cur.execute(
        """
        SELECT 1
        FROM etl_runs
        WHERE pipeline = %s
          AND chunk_key = %s
          AND window_start = %s
          AND window_end = %s
          AND status = 'succeeded'
        ORDER BY finished_at DESC NULLS LAST
        LIMIT 1
        """,
        (pipeline, chunk_key, window_start, window_end),
    )
    return cur.fetchone() is not None
