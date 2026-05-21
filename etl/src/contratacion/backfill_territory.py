"""Backfill administration_level and region for contracts that couldn't be inferred
at ingest time.  Safe to re-run: only updates rows where the field is currently NULL
or where the new inference would change the value.

Usage:
    PYTHONPATH=src python -m src.contratacion.backfill_territory [--dry-run]
"""

from __future__ import annotations

import argparse
import sys

from common.db import get_pg_conn
from common.responsibility import (
    infer_autonomic_territory,
    infer_contract_administration_level,
    infer_municipal_territory,
)


def _run(dry_run: bool) -> None:
    conn = get_pg_conn()
    cur = conn.cursor()

    # ── Phase 1: fill in region for autonomic/municipal contracts that have a
    #    known level but no region yet.
    cur.execute(
        """
        SELECT id, awarding_body_normalized, administration_level
        FROM contracts
        WHERE administration_level IN ('autonomic', 'municipal')
          AND region IS NULL
          AND awarding_body_normalized IS NOT NULL
        """
    )
    rows = cur.fetchall()
    region_updates: list[tuple[str, int]] = []
    for row_id, body, level in rows:
        region = (
            infer_autonomic_territory(body)
            if level == "autonomic"
            else infer_municipal_territory(body)
        )
        if region:
            region_updates.append((region, row_id))

    print(f"Phase 1 – region backfill: {len(region_updates)} / {len(rows)} rows resolved")

    # ── Phase 2: infer administration_level for contracts that are still NULL.
    cur.execute(
        """
        SELECT id, awarding_body_normalized, ministry_normalized
        FROM contracts
        WHERE administration_level IS NULL
          AND awarding_body_normalized IS NOT NULL
        """
    )
    null_rows = cur.fetchall()
    level_updates: list[tuple[str, str | None, int]] = []
    for row_id, body, ministry in null_rows:
        level = infer_contract_administration_level(body, ministry)
        if level:
            region: str | None = None
            if level == "autonomic":
                region = infer_autonomic_territory(body)
            elif level == "municipal":
                region = infer_municipal_territory(body)
            level_updates.append((level, region, row_id))

    print(f"Phase 2 – level backfill:  {len(level_updates)} / {len(null_rows)} rows classified")

    if dry_run:
        print("Dry-run mode — no writes.")
        if region_updates:
            print("  Sample region updates:")
            for region, row_id in region_updates[:10]:
                print(f"    id={row_id}  region={region!r}")
        if level_updates:
            print("  Sample level updates:")
            for level, region, row_id in level_updates[:10]:
                print(f"    id={row_id}  level={level!r}  region={region!r}")
        conn.close()
        return

    if region_updates:
        cur.executemany(
            "UPDATE contracts SET region = %s, updated_at = NOW() WHERE id = %s",
            region_updates,
        )
        print(f"  Wrote {cur.rowcount} region updates")

    if level_updates:
        cur.executemany(
            "UPDATE contracts SET administration_level = %s, region = %s, updated_at = NOW() WHERE id = %s",
            level_updates,
        )
        print(f"  Wrote {cur.rowcount} level+region updates")

    conn.commit()
    conn.close()
    print("Done.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Show what would change without writing")
    args = parser.parse_args()
    _run(dry_run=args.dry_run)


if __name__ == "__main__":
    main()
