"""ETL: ingest curated election results from YAML seed data.

Usage:
    PYTHONPATH=src python -m src.elections.ingest
    PYTHONPATH=src python -m src.elections.ingest --dry-run
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path

import yaml
from common.db import get_pg_conn

DATA_PATH = Path(__file__).parent.parent.parent / "data" / "election_results.yml"


def run(dry_run: bool = False) -> int:
    if not DATA_PATH.exists():
        print(f"Election results data file not found: {DATA_PATH}")
        return 0

    with open(DATA_PATH, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)

    elections = data.get("elections", [])
    if not elections:
        print("No elections found in YAML.")
        return 0

    conn = get_pg_conn() if not dry_run else None
    cur = conn.cursor() if conn else None
    total_results = 0
    total_provinces = 0

    for election in elections:
        date = election["date"]
        total_seats = election["total_seats"]
        participation = election["participation_pct"]

        for result in election.get("results", []):
            if dry_run:
                total_results += 1
                continue
            if cur is None:
                continue
            cur.execute("""
                INSERT INTO election_results
                (election_date, party, party_short_name, votes, seats, pct_vote, color, total_seats, participation_pct)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (election_date, party) DO UPDATE SET
                    votes = EXCLUDED.votes,
                    seats = EXCLUDED.seats,
                    pct_vote = EXCLUDED.pct_vote,
                    color = EXCLUDED.color,
                    total_seats = EXCLUDED.total_seats,
                    participation_pct = EXCLUDED.participation_pct
            """, (
                date, result["party"], result["short_name"],
                result["votes"], result["seats"], result["pct_vote"],
                result["color"], total_seats, participation,
            ))
            total_results += 1

        for prov in election.get("provinces", []):
            if dry_run:
                total_provinces += 1
                continue
            if cur is None:
                continue
            cur.execute("""
                INSERT INTO election_provinces
                (election_date, province_name, seats, effective_threshold, description)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (election_date, province_name) DO UPDATE SET
                    seats = EXCLUDED.seats,
                    effective_threshold = EXCLUDED.effective_threshold,
                    description = EXCLUDED.description
            """, (
                date, prov["name"], prov["seats"],
                prov["effective_threshold"], prov["description"],
            ))
            total_provinces += 1

        if conn:
            conn.commit()

    if cur:
        cur.close()
    if conn:
        conn.close()

    print(f"Done! Upserted {total_results} results + {total_provinces} provinces across {len(elections)} elections.")
    return total_results + total_provinces


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    run(dry_run=args.dry_run)
