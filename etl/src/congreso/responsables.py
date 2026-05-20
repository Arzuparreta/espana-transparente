"""Load multilevel responsibility positions and curated body maps from YAML."""

from __future__ import annotations

import argparse
from pathlib import Path

import yaml
from common.db import get_pg_conn
from common.responsibility import (
    PublicBodyMapEntry,
    ResponsibilityPosition,
    normalize_public_body,
)
from puertas_giratorias.db import match_politician

STATE_FILE = Path(__file__).resolve().parents[2] / "data" / "gobierno_historico.yml"
POSITIONS_FILE = Path(__file__).resolve().parents[2] / "data" / "responsibility_positions.yml"
MAP_FILE = Path(__file__).resolve().parents[2] / "data" / "public_body_responsibility_map.yml"


def load_state_positions(path: Path) -> list[ResponsibilityPosition]:
    with path.open(encoding="utf-8") as handle:
        doc = yaml.safe_load(handle) or {}

    rows: list[ResponsibilityPosition] = []
    for government in doc.get("governments", []):
        for minister in government.get("ministers", []):
            rows.append(
                ResponsibilityPosition(
                    administration_level="state",
                    position_type=minister["position_type"],
                    territory_name="España",
                    territory_code="ES",
                    organization_name=normalize_public_body(minister["organization"]) or minister["organization"],
                    organization_aliases=[
                        normalize_public_body(alias) or alias for alias in minister.get("aliases", [])
                    ],
                    person_name=minister["person"],
                    political_party=minister.get("party"),
                    government=government["name"],
                    start_date=str(minister["start"]),
                    end_date=str(minister["end"]) if minister.get("end") else None,
                    source_url=minister.get("source"),
                )
            )
    return rows


def load_registry_positions(path: Path) -> list[ResponsibilityPosition]:
    with path.open(encoding="utf-8") as handle:
        doc = yaml.safe_load(handle) or {}

    rows: list[ResponsibilityPosition] = []
    for entry in doc.get("positions", []):
        rows.append(
            ResponsibilityPosition(
                administration_level=entry["administration_level"],
                position_type=entry["position_type"],
                territory_name=entry.get("territory_name"),
                territory_code=entry.get("territory_code"),
                organization_name=normalize_public_body(entry["organization_name"]) or entry["organization_name"],
                organization_aliases=[
                    normalize_public_body(alias) or alias for alias in entry.get("organization_aliases", [])
                ],
                person_name=entry["person_name"],
                political_party=entry.get("political_party"),
                government=entry.get("government"),
                start_date=str(entry["start_date"]),
                end_date=str(entry["end_date"]) if entry.get("end_date") else None,
                source_url=entry.get("source_url"),
            )
        )
    return rows


def load_body_map(path: Path) -> list[PublicBodyMapEntry]:
    with path.open(encoding="utf-8") as handle:
        doc = yaml.safe_load(handle) or {}

    rows: list[PublicBodyMapEntry] = []
    for entry in doc.get("entries", []):
        rows.append(
            PublicBodyMapEntry(
                body_normalized=normalize_public_body(entry["body_normalized"]) or entry["body_normalized"],
                administration_level=entry["administration_level"],
                territory_name=entry.get("territory_name"),
                territory_code=entry.get("territory_code"),
                ministry_or_department_normalized=normalize_public_body(
                    entry["ministry_or_department_normalized"]
                )
                or entry["ministry_or_department_normalized"],
                match_strategy=entry["match_strategy"],
                start_date=str(entry.get("start_date", "2016-01-01")),
                end_date=str(entry["end_date"]) if entry.get("end_date") else None,
                source_url=entry.get("source_url"),
            )
        )
    return rows


def upsert_positions(dry_run: bool) -> tuple[int, int]:
    rows = load_state_positions(STATE_FILE) + load_registry_positions(POSITIONS_FILE)
    if dry_run:
        return len(rows), 0

    conn = get_pg_conn()
    cur = conn.cursor()

    # Pass 1: insert new rows (ON CONFLICT DO NOTHING for existing)
    inserted = 0
    for row in rows:
        politician_id = None
        politician_score = 0.0
        politician_id, _party, politician_score = match_politician(cur, row.person_name)

        cur.execute(
            """
            INSERT INTO responsibility_positions (
              administration_level,
              position_type,
              territory_name,
              territory_code,
              organization_name,
              organization_aliases,
              person_name,
              politician_id,
              political_party,
              government,
              start_date,
              end_date,
              source_url,
              updated_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, now())
            ON CONFLICT DO NOTHING
            """,
            (
                row.administration_level,
                row.position_type,
                row.territory_name,
                row.territory_code,
                row.organization_name,
                row.organization_aliases,
                row.person_name,
                politician_id,
                row.political_party,
                row.government,
                row.start_date,
                row.end_date,
                row.source_url,
            ),
        )
        if cur.rowcount > 0:
            inserted += 1

    # Pass 2: backfill politician_id for existing rows that were previously unmatched
    backfilled = 0
    for row in rows:
        politician_id, _party, score = match_politician(cur, row.person_name)
        if politician_id:
            cur.execute(
                """
                UPDATE responsibility_positions
                SET politician_id = %s, updated_at = now()
                WHERE administration_level = %s
                  AND position_type = %s
                  AND organization_name = %s
                  AND person_name = %s
                  AND start_date = %s
                  AND politician_id IS NULL
                """,
                (
                    politician_id,
                    row.administration_level,
                    row.position_type,
                    row.organization_name,
                    row.person_name,
                    row.start_date,
                ),
            )
            if cur.rowcount > 0:
                backfilled += 1
                print(f"backfilled politician_id for {row.person_name}")
        elif score > 0.70:
            print(f"warning: no politician match for {row.person_name} (score={score:.2f})")

    conn.commit()
    cur.close()
    conn.close()
    return len(rows), inserted + backfilled


def upsert_body_map(dry_run: bool) -> int:
    rows = load_body_map(MAP_FILE)
    if dry_run:
        return len(rows)

    conn = get_pg_conn()
    cur = conn.cursor()
    for row in rows:
        cur.execute(
            """
            INSERT INTO public_body_responsibility_map (
              body_normalized,
              administration_level,
              territory_name,
              territory_code,
              ministry_or_department_normalized,
              match_strategy,
              start_date,
              end_date,
              source_url,
              updated_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, now())
            ON CONFLICT DO NOTHING
            """,
            (
                row.body_normalized,
                row.administration_level,
                row.territory_name,
                row.territory_code,
                row.ministry_or_department_normalized,
                row.match_strategy,
                row.start_date,
                row.end_date,
                row.source_url,
            ),
        )
    conn.commit()
    cur.close()
    conn.close()
    return len(rows)


def main() -> None:
    parser = argparse.ArgumentParser(description="Load multilevel responsibility data")
    parser.add_argument(
        "--target",
        choices=("all", "positions", "map"),
        default="all",
        help="What to load",
    )
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if args.target in ("all", "positions"):
        loaded, matched = upsert_positions(args.dry_run)
        print(f"positions: {loaded} loaded ({matched} politician matches)")
    if args.target in ("all", "map"):
        loaded = upsert_body_map(args.dry_run)
        print(f"body-map: {loaded} loaded")


if __name__ == "__main__":
    main()
