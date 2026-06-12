"""Load the public_officials registry from YAML and link responsibility_positions.

Source of truth: etl/data/public_officials.yml. Keeps non-parliamentary
executive officials (state ministers without a Congress seat, CCAA
presidents/consejeros, mayors of major cities) separate from `politicians`
(Congress/Senate scope).
"""

from __future__ import annotations

import argparse
from pathlib import Path

import yaml
from common.db import get_pg_conn
from common.utils import normalize_name

DATA_FILE = Path(__file__).resolve().parents[2] / "data" / "public_officials.yml"


def load_officials(path: Path) -> list[dict]:
    with path.open(encoding="utf-8") as handle:
        doc = yaml.safe_load(handle) or {}
    return doc.get("officials", [])


def upsert_officials(officials: list[dict], dry_run: bool) -> int:
    if dry_run:
        return len(officials)

    conn = get_pg_conn()
    cur = conn.cursor()
    for entry in officials:
        cur.execute(
            """
            INSERT INTO public_officials (
              full_name,
              aliases,
              administration_level,
              political_party,
              wikidata_qid,
              source_url,
              notes,
              updated_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, now())
            ON CONFLICT (full_name) DO UPDATE SET
              aliases = EXCLUDED.aliases,
              administration_level = EXCLUDED.administration_level,
              political_party = EXCLUDED.political_party,
              wikidata_qid = EXCLUDED.wikidata_qid,
              source_url = EXCLUDED.source_url,
              notes = EXCLUDED.notes,
              updated_at = now()
            """,
            (
                entry["full_name"],
                entry.get("aliases", []),
                entry.get("administration_level"),
                entry.get("political_party"),
                entry.get("wikidata_qid"),
                entry.get("source_url"),
                entry.get("notes"),
            ),
        )
    conn.commit()
    cur.close()
    conn.close()
    return len(officials)


def link_responsibility_positions(dry_run: bool) -> int:
    conn = get_pg_conn()
    cur = conn.cursor()

    cur.execute("SELECT id, full_name, aliases FROM public_officials")
    officials_by_alias: dict[str, str] = {}
    for official_id, full_name, aliases in cur.fetchall():
        for name in [full_name, *(aliases or [])]:
            officials_by_alias[normalize_name(name)] = official_id

    cur.execute(
        """
        SELECT id, person_name FROM responsibility_positions
        WHERE politician_id IS NULL AND official_id IS NULL
        """
    )
    rows = cur.fetchall()

    linked = 0
    for position_id, person_name in rows:
        official_id = officials_by_alias.get(normalize_name(person_name))
        if not official_id:
            print(f"warning: no public_official match for {person_name!r}")
            continue
        linked += 1
        if dry_run:
            continue
        cur.execute(
            "UPDATE responsibility_positions SET official_id = %s, updated_at = now() WHERE id = %s",
            (official_id, position_id),
        )

    if not dry_run:
        conn.commit()
    cur.close()
    conn.close()
    return linked


def main() -> None:
    parser = argparse.ArgumentParser(description="Load public_officials registry and link responsibility_positions")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    officials = load_officials(DATA_FILE)
    upserted = upsert_officials(officials, args.dry_run)
    print(f"public_officials: {upserted} loaded")

    linked = link_responsibility_positions(args.dry_run)
    print(f"responsibility_positions: {linked} linked to public_officials")


if __name__ == "__main__":
    main()
