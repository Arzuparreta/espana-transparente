"""Legacy wrapper for loading state government positions into the canonical table."""

from __future__ import annotations

import argparse
from pathlib import Path

from common.responsibility import ResponsibilityPosition
from congreso.responsables import STATE_FILE, load_state_positions, upsert_positions

DATA_FILE = Path(__file__).resolve().parents[2] / "data" / "gobierno_historico.yml"


def load_positions(path: Path) -> list[dict]:
    rows: list[ResponsibilityPosition] = load_state_positions(path)
    return [
        {
            "position_type": row.position_type,
            "organization_name": row.organization_name,
            "organization_aliases": row.organization_aliases,
            "person_name": row.person_name,
            "political_party": row.political_party,
            "government": row.government,
            "start_date": row.start_date,
            "end_date": row.end_date,
            "source_url": row.source_url,
        }
        for row in rows
    ]


def main() -> None:
    parser = argparse.ArgumentParser(description="Load historical state government positions")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    loaded, matched = upsert_positions(args.dry_run)
    print(f"Loaded {loaded} responsibility positions ({matched} politician matches)")


if __name__ == "__main__":
    main()
