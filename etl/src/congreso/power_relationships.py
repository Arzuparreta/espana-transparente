"""Populate power_relationships table from etl/data/party_leadership.yml.

The Congress does not publish a structured dataset for party leadership.
The mapping lives in a versioned YAML file so updates are PRs of data,
not code.
"""

from pathlib import Path

import yaml

from common.db import get_pg_conn

LEADERSHIP_YAML = Path(__file__).resolve().parents[2] / "data" / "party_leadership.yml"


def load_leadership() -> dict[str, dict[str, str | None]]:
    with LEADERSHIP_YAML.open(encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    parsed: dict[str, dict[str, str | None]] = {}
    for acronym, entry in data.items():
        parsed[acronym] = {
            "leader": entry.get("leader") if isinstance(entry, dict) else None,
            "spokesperson": entry.get("spokesperson") if isinstance(entry, dict) else None,
        }
    return parsed


def run():
    leadership = load_leadership()

    conn = get_pg_conn()
    cur = conn.cursor()

    cur.execute(
        """
        SELECT p.id, p.full_name, par.acronym, par.id as party_id
        FROM politicians p
        JOIN politician_memberships pm ON pm.politician_id = p.id
        JOIN parties par ON pm.party_id = par.id
        WHERE pm.is_active = true
        """,
    )
    deputies = cur.fetchall()

    cur.execute("SELECT id, full_name FROM politicians")
    name_to_id = {row[1].lower().strip(): row[0] for row in cur.fetchall()}

    inserted = 0
    missing: set[str] = set()

    for dep_id, dep_name, party_acronym, party_id in deputies:
        entry = leadership.get(party_acronym)
        if not entry:
            continue

        leader_name = entry["leader"]
        spox_name = entry["spokesperson"]
        norm = dep_name.lower().strip()

        if leader_name and norm == leader_name.lower().strip():
            continue
        if spox_name and norm == spox_name.lower().strip():
            continue

        if leader_name:
            leader_id = name_to_id.get(leader_name.lower().strip())
            if leader_id:
                cur.execute(
                    """
                    INSERT INTO power_relationships
                        (person_id, superior_id, relationship_type, party_id, description)
                    VALUES (%s, %s, 'party_leader', %s, %s)
                    ON CONFLICT DO NOTHING
                    """,
                    (dep_id, leader_id, party_id,
                     f"Responde ante el/la líder del {party_acronym}"),
                )
            else:
                missing.add(f"{party_acronym}:leader:{leader_name}")

        if spox_name:
            spox_id = name_to_id.get(spox_name.lower().strip())
            if spox_id:
                cur.execute(
                    """
                    INSERT INTO power_relationships
                        (person_id, superior_id, relationship_type, party_id, description)
                    VALUES (%s, %s, 'spokesperson', %s, %s)
                    ON CONFLICT DO NOTHING
                    """,
                    (dep_id, spox_id, party_id,
                     "Coordinado/a por el/la portavoz del grupo parlamentario"),
                )
            else:
                missing.add(f"{party_acronym}:spokesperson:{spox_name}")

        inserted += 1

    conn.commit()

    cur.execute("SELECT count(*) FROM power_relationships")
    count = cur.fetchone()[0]
    print(f"Inserted relationships for {inserted} deputies. Total in DB: {count}")

    if missing:
        print("\nWarning — names in YAML not found in politicians table:")
        for name in sorted(missing):
            print(f"  {name}")
        print("Update etl/data/party_leadership.yml or fix the politician's full_name.")

    cur.close()
    conn.close()


if __name__ == "__main__":
    run()
