"""database client for ETL scripts - uses direct PostgreSQL connection"""

import os
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

DB_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres.zktpodkvlgciluhbulwr:A%28H_2026_Supabase_Secure%21@aws-0-eu-west-1.pooler.supabase.com:5432/postgres",
)
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL", "https://zktpodkvlgciluhbulwr.supabase.co")
PUBLISHABLE_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "sb_publishable_PP5UVS47MgYZfVhzFA5vHg_30G6Cc9O")


def get_client() -> Client:
    """Get Supabase client using publishable key (for reads only)."""
    return create_client(SUPABASE_URL, PUBLISHABLE_KEY)


def get_pg_conn():
    """Get direct PostgreSQL connection (for writes)."""
    return psycopg2.connect(DB_URL)


def upsert_politicians(rows: list[dict]) -> int:
    """Upsert politicians via direct SQL."""
    with get_pg_conn() as conn:
        with conn.cursor() as cur:
            count = 0
            for r in rows:
                cur.execute("""
                    INSERT INTO politicians (congress_id, first_name, last_name, full_name, photo_url, raw_data)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (congress_id) DO UPDATE SET
                        first_name = EXCLUDED.first_name,
                        last_name = EXCLUDED.last_name,
                        full_name = EXCLUDED.full_name,
                        photo_url = EXCLUDED.photo_url,
                        raw_data = EXCLUDED.raw_data,
                        updated_at = now()
                """, (r["congress_id"], r["first_name"], r["last_name"],
                      r["full_name"], r.get("photo_url"), psycopg2.extras.Json(r.get("raw_data", {}))))
                count += 1
            conn.commit()
            return count


def upsert_parties(rows: list[dict]) -> int:
    with get_pg_conn() as conn:
        with conn.cursor() as cur:
            count = 0
            for r in rows:
                cur.execute("""
                    INSERT INTO parties (name, acronym, color)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (name) DO UPDATE SET
                        acronym = EXCLUDED.acronym,
                        color = EXCLUDED.color,
                        updated_at = now()
                """, (r["name"], r.get("acronym"), r.get("color")))
                count += 1
            conn.commit()
            return count


def upsert_memberships(rows: list[dict]) -> int:
    with get_pg_conn() as conn:
        with conn.cursor() as cur:
            count = 0
            for r in rows:
                cur.execute("""
                    INSERT INTO politician_memberships
                        (politician_id, legislature_id, party_id, constituency,
                         is_active, group_parliamentary, start_date, raw_data)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (politician_id, legislature_id) DO UPDATE SET
                        party_id = EXCLUDED.party_id,
                        constituency = EXCLUDED.constituency,
                        is_active = EXCLUDED.is_active,
                        group_parliamentary = EXCLUDED.group_parliamentary,
                        start_date = EXCLUDED.start_date
                """, (r["politician_id"], r["legislature_id"], r.get("party_id"),
                      r.get("constituency"), r.get("is_active", True),
                      r.get("group_parliamentary"), r.get("start_date"),
                      psycopg2.extras.Json(r.get("raw_data", {}))))
                count += 1
            conn.commit()
            return count
