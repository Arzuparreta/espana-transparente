"""ETL: ingest voting data from Congress session 177 (April 30, 2026)"""

import json
import subprocess
import psycopg2
import psycopg2.extras
import os

DB_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres.zktpodkvlgciluhbulwr:A%28H_2026_Supabase_Secure%21@aws-0-eu-west-1.pooler.supabase.com:5432/postgres",
)

UA = "Mozilla/5.0"

VOTACION_URLS = [
    "https://www.congreso.es/webpublica/opendata/votaciones/Leg15/Sesion177/20260430/Votacion001/VOT_20260430125140.json",
    "https://www.congreso.es/webpublica/opendata/votaciones/Leg15/Sesion177/20260430/Votacion002/VOT_20260430125141.json",
    "https://www.congreso.es/webpublica/opendata/votaciones/Leg15/Sesion177/20260430/Votacion003/VOT_20260430125143.json",
    "https://www.congreso.es/webpublica/opendata/votaciones/Leg15/Sesion177/20260430/Votacion004/VOT_20260430125145.json",
    "https://www.congreso.es/webpublica/opendata/votaciones/Leg15/Sesion177/20260430/Votacion005/VOT_20260430125148.json",
    "https://www.congreso.es/webpublica/opendata/votaciones/Leg15/Sesion177/20260430/Votacion006/VOT_20260430125150.json",
    "https://www.congreso.es/webpublica/opendata/votaciones/Leg15/Sesion177/20260430/Votacion007/VOT_20260430125151.json",
    "https://www.congreso.es/webpublica/opendata/votaciones/Leg15/Sesion177/20260430/Votacion008/VOT_20260430125153.json",
    "https://www.congreso.es/webpublica/opendata/votaciones/Leg15/Sesion177/20260430/Votacion009/VOT_20260430125155.json",
    "https://www.congreso.es/webpublica/opendata/votaciones/Leg15/Sesion177/20260430/Votacion010/VOT_20260430125157.json",
    "https://www.congreso.es/webpublica/opendata/votaciones/Leg15/Sesion177/20260430/Votacion011/VOT_20260430125159.json",
    "https://www.congreso.es/webpublica/opendata/votaciones/Leg15/Sesion177/20260430/Votacion012/VOT_20260430125200.json",
]

VOTE_MAP = {"sí": "Sí", "si": "Sí", "no": "No", "abstención": "Abstención",
            "abstencion": "Abstención", "no vota": "No vota"}


def build_politician_index(cur) -> dict:
    """Build in-memory index: name -> politician_id"""
    cur.execute("SELECT id, full_name, first_name, last_name FROM politicians")
    index = {}
    for pid, full, first, last in cur.fetchall():
        fl = full.lower().strip()
        index[fl] = pid
        # Also index first+last combos
        if first and last:
            f, l = first.lower().strip(), last.lower().strip()
            index[f"{f} {l}"] = pid
            index[f"{l}, {f}"] = pid
    return index


def run():
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()

    print("Building politician index...")
    pol_idx = build_politician_index(cur)
    print(f"Indexed {len(pol_idx)} name variants")

    cur.execute("SELECT id FROM legislatures WHERE number = 15")
    leg_id = cur.fetchone()[0]

    total_votes = 0

    for i, url in enumerate(VOTACION_URLS):
        num = i + 1
        print(f"[{num}/12] Fetching...", end=" ", flush=True)

        result = subprocess.run(
            ["curl", "-sL", "-H", f"User-Agent: {UA}", url],
            capture_output=True, text=True, timeout=30
        )
        data = json.loads(result.stdout)
        info = data.get("informacion", {})
        votos_data = data.get("votaciones", [])

        # Session title
        title = info.get("titulo", "") or ""
        texto = info.get("textoExpediente", "") or ""
        title_full = (f"{title} - {texto[:200]}" if texto else title)[:500]

        # Unique key: session_number + date + legislature + votacion number
        exp_num = texto[:80] if texto else ""
        cur.execute("""
            INSERT INTO voting_sessions (legislature_id, session_number, date, title, initiative_number, votacion_number, raw_data)
            VALUES (%s, 177, '2026-04-30', %s, %s, %s, %s)
            ON CONFLICT (session_number, date, legislature_id, votacion_number) DO NOTHING
            RETURNING id
        """, (leg_id, title_full, exp_num, num, psycopg2.extras.Json(info)))
        row = cur.fetchone()
        if row:
            sid = row[0]
        else:
            cur.execute(
                "SELECT id FROM voting_sessions WHERE legislature_id=%s AND session_number=177 AND date='2026-04-30' AND title=%s",
                (leg_id, title_full)
            )
            sid = cur.fetchone()[0]

        # Insert votes using bulk insert
        vote_rows = []
        for v in votos_data:
            name = v.get("diputado", "").strip()
            voto_raw = v.get("voto", "").strip()
            voto = VOTE_MAP.get(voto_raw.lower(), voto_raw.capitalize())

            name_lower = name.lower().strip()
            pol_id = pol_idx.get(name_lower)
            if pol_id:
                vote_rows.append((sid, pol_id, voto, psycopg2.extras.Json(v)))

        if vote_rows:
            psycopg2.extras.execute_values(cur, """
                INSERT INTO votes (voting_session_id, politician_id, vote, raw_data)
                VALUES %s
                ON CONFLICT (voting_session_id, politician_id) DO UPDATE SET
                    vote = EXCLUDED.vote, raw_data = EXCLUDED.raw_data
            """, vote_rows)

        conn.commit()
        print(f"{len(vote_rows)} votes")
        total_votes += len(vote_rows)

    cur.close()
    conn.close()
    print(f"\nDone! {total_votes} total votes ingested.")


if __name__ == "__main__":
    run()
