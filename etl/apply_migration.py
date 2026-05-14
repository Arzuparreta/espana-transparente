"""Apply pending SQL migrations directly via PostgreSQL (psycopg2).

Reads DATABASE_URL from etl/.env and executes the given migration file.

Usage:
    cd etl
    python apply_migration.py ../supabase/migrations/20260514030000_subsidies.sql
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import psycopg2

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("ERROR: DATABASE_URL not set in etl/.env")
    print()
    print("Get it from: Supabase Dashboard → Settings → Database → Connection string")
    print("Use the 'URI' format (starts with postgresql://postgres:...)")
    print("Paste it in etl/.env as: DATABASE_URL=postgresql://postgres:PASSWORD@...")
    sys.exit(1)

if len(sys.argv) < 2:
    print(f"Usage: python {sys.argv[0]} <migration_file.sql>")
    sys.exit(1)

sql_file = Path(sys.argv[1])
if not sql_file.exists():
    print(f"ERROR: file not found: {sql_file}")
    sys.exit(1)

sql = sql_file.read_text()
print(f"Applying {sql_file.name} ...")

conn = psycopg2.connect(DATABASE_URL)
conn.autocommit = True
with conn.cursor() as cur:
    cur.execute(sql)
conn.close()

print("Done.")
