"""Populate power_relationships table with party leadership data"""

import os
import psycopg2

DB_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres.zktpodkvlgciluhbulwr:A%28H_2026_Supabase_Secure%21@aws-0-eu-west-1.pooler.supabase.com:5432/postgres",
)

# Party leaders and spokespersons (verified public info, May 2026)
PARTY_LEADERS = {
    "PP": ("Núñez Feijóo, Alberto", "Gamarra Ruiz-Clavijo, Concepción"),
    "PSOE": ("Sánchez Pérez-Castejón, Pedro", None),  # No single spokesperson in DB
    "VOX": ("Abascal Conde, Santiago", None),
    "SUMAR": ("Díaz Pérez, Yolanda", None),
    "ERC": (None, "Álvaro Vidal, Francesc-Marc"),
    "JUNTS": (None, "Calvo Gómez, Pilar"),
    "EH Bildu": (None, "Aizpurua Arzallus, Mertxe"),
    "EAJ-PNV": (None, "Agirretxea Urresti, Joseba Andoni"),
}


def run():
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()

    # Get all active politicians with their party
    cur.execute("""
        SELECT p.id, p.full_name, par.acronym, par.id as party_id
        FROM politicians p
        JOIN politician_memberships pm ON pm.politician_id = p.id
        JOIN parties par ON pm.party_id = par.id
        WHERE pm.is_active = true
    """)
    deputies = cur.fetchall()

    # Build index: full_name -> id
    cur.execute("SELECT id, full_name FROM politicians")
    name_to_id = {row[1].lower().strip(): row[0] for row in cur.fetchall()}

    inserted = 0
    for dep_id, dep_name, party_acronym, party_id in deputies:
        if party_acronym not in PARTY_LEADERS:
            continue

        leader_name, spox_name = PARTY_LEADERS[party_acronym]
        norm = dep_name.lower().strip()

        # Skip if this deputy IS the leader
        if leader_name and norm == leader_name.lower().strip():
            continue
        if spox_name and norm == spox_name.lower().strip():
            continue

        # Add party leader relationship
        if leader_name:
            leader_id = name_to_id.get(leader_name.lower().strip())
            if leader_id:
                cur.execute("""
                    INSERT INTO power_relationships (person_id, superior_id, relationship_type, party_id, description)
                    VALUES (%s, %s, 'party_leader', %s, %s)
                    ON CONFLICT DO NOTHING
                """, (dep_id, leader_id, party_id,
                      f"Responde ante el/la líder del {party_acronym}"))

        # Add spokesperson relationship
        if spox_name:
            spox_id = name_to_id.get(spox_name.lower().strip())
            if spox_id:
                cur.execute("""
                    INSERT INTO power_relationships (person_id, superior_id, relationship_type, party_id, description)
                    VALUES (%s, %s, 'spokesperson', %s, %s)
                    ON CONFLICT DO NOTHING
                """, (dep_id, spox_id, party_id,
                      f"Coordinado/a por el/la portavoz del grupo parlamentario"))

        inserted += 1

    conn.commit()

    # Verify
    cur.execute("SELECT count(*) FROM power_relationships")
    count = cur.fetchone()[0]
    print(f"Inserted relationships for {inserted} deputies. Total in DB: {count}")

    # Show a sample
    cur.execute("""
        SELECT p.full_name as deputy, s.full_name as superior, pr.relationship_type, par.acronym
        FROM power_relationships pr
        JOIN politicians p ON pr.person_id = p.id
        LEFT JOIN politicians s ON pr.superior_id = s.id
        LEFT JOIN parties par ON pr.party_id = par.id
        LIMIT 10
    """)
    for row in cur.fetchall():
        print(f"  {row[0]} → {row[1]} ({row[2]}, {row[3]})")

    cur.close()
    conn.close()


if __name__ == "__main__":
    run()
