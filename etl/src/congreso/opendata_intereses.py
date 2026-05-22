"""ETL: ingest structured economic interests from Congreso Open Data.

The Congreso publishes "Declaración de Intereses Económicos" (docacteco) as
machine-readable JSON via their Open Data portal:
    https://www.congreso.es/webpublica/opendata/diputados/docacteco__*.json

This is updated daily and contains structured employer/activity/donation records
for all deputies. No OCR needed — this is the official machine-readable source.

Each deputy has multiple rows (one per activity/employer/donation).
We group by deputy and store one economic_declarations record per deputy
with the full structured data in raw_data.

Usage:
    PYTHONPATH=src python -m src.congreso.opendata_intereses --dry-run
    PYTHONPATH=src python -m src.congreso.opendata_intereses
"""

import argparse
import json
import subprocess
import time
from datetime import datetime, timezone

import psycopg2.extras

from common.db import get_pg_conn

# The JSON URL pattern includes a timestamp that changes daily.
# We can discover the latest URL from the opendata page, or use the base URL
# and let curl follow redirects. The current timestamp is in the filename.
OPENDATA_BASE = "https://www.congreso.es/webpublica/opendata/diputados"
OPENDATA_JSON = f"{OPENDATA_BASE}/docacteco__"

UA = "Mozilla/5.0 (compatible; AccionHumana/1.0)"


def _discover_latest_url() -> str:
    """Find the current docacteco JSON URL by scraping the opendata page."""
    result = subprocess.run(
        ["curl", "-sL", "-H", f"User-Agent: {UA}",
         "https://www.congreso.es/es/opendata/diputados"],
        capture_output=True, text=True, timeout=30,
    )
    html = result.stdout
    # Find the JSON link for docacteco
    import re
    match = re.search(r'(/webpublica/opendata/diputados/docacteco__\d+\.json)', html)
    if match:
        return f"https://www.congreso.es{match.group(1)}"
    # Fallback: try today's date pattern
    today = datetime.now().strftime("%Y%m%d")
    return f"{OPENDATA_JSON}{today}050233.json"


def fetch_json(url: str) -> list[dict]:
    """Download and parse the docacteco JSON."""
    result = subprocess.run(
        ["curl", "-sL", "--max-time", "30", "-H", f"User-Agent: {UA}", url],
        capture_output=True, text=True, timeout=35,
    )
    if result.returncode != 0:
        raise RuntimeError(f"curl failed: {result.stderr}")
    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError:
        # Try with a broader URL
        raise RuntimeError(f"Failed to parse JSON from {url}")
    return data


def normalize_name(name: str) -> str:
    """Normalize a name from 'Apellidos,Nombre' to 'Apellidos, Nombre' format."""
    parts = name.split(",")
    if len(parts) == 2:
        return f"{parts[0].strip()}, {parts[1].strip()}"
    return name.strip()


def run(dry_run: bool = False) -> None:
    conn = get_pg_conn()
    cur = conn.cursor()

    # Get legislature XV
    cur.execute("SELECT id FROM legislatures WHERE number = 15")
    row = cur.fetchone()
    if not row:
        raise SystemExit("Legislature XV not found. Run diputados first.")
    leg_id = row[0]

    # Fetch all politicians with cod_parlamentario
    cur.execute(
        "SELECT id, full_name, cod_parlamentario FROM politicians "
        "WHERE cod_parlamentario IS NOT NULL ORDER BY full_name"
    )
    politicians = {row[2]: (row[0], row[1]) for row in cur.fetchall()}

    # Discover and fetch the latest JSON
    url = _discover_latest_url()
    print(f"Fetching docacteco from: {url}")
    try:
        records = fetch_json(url)
    except RuntimeError as exc:
        print(f"ERROR: {exc}")
        cur.close()
        conn.close()
        return

    print(f"Downloaded {len(records)} activity records")

    # Group by deputy name
    deputy_activities: dict[str, list[dict]] = {}
    for rec in records:
        name = normalize_name(rec.get("NOMBRE", ""))
        if not name:
            continue
        if name not in deputy_activities:
            deputy_activities[name] = []
        deputy_activities[name].append({
            "type": rec.get("TIPO", ""),
            "period": rec.get("PERIODO", ""),
            "employer": rec.get("EMPLEADOR", ""),
            "sector": rec.get("SECTOR", ""),
            "description": rec.get("DESCRIPCION", ""),
            "declaration": rec.get("DECLARACION", ""),
            "registration_date": rec.get("FECHAREGISTRO", ""),
        })

    print(f"Grouped into {len(deputy_activities)} deputies")

    # Match to politicians by name
    matched = 0
    unmatched = 0
    inserted = 0

    # Build name index from politicians
    pol_by_name = {}
    for cod, (pol_id, full_name) in politicians.items():
        # Normalize for matching
        key = full_name.strip().upper()
        pol_by_name[key] = (pol_id, cod)

    for dep_name, activities in deputy_activities.items():
        # Try direct match
        key = dep_name.upper().replace(", ", ",")
        # Also try reversed (Nombre Apellidos vs Apellidos, Nombre)
        parts = dep_name.split(",")
        alt_key = None
        if len(parts) == 2:
            alt_key = f"{parts[1].strip()} {parts[0].strip()}".upper()

        pol_id = None
        cod = None
        if key in pol_by_name:
            pol_id, cod = pol_by_name[key]
        elif alt_key and alt_key in pol_by_name:
            pol_id, cod = pol_by_name[alt_key]

        if not pol_id:
            # Try fuzzy: check if dep_name is contained in any politician name
            for pol_key, (pid, pcod) in pol_by_name.items():
                if dep_name.upper().replace(",", "") in pol_key.replace(",", ""):
                    pol_id = pid
                    cod = pcod
                    break

        if pol_id:
            matched += 1
        else:
            unmatched += 1

        source_url = f"opendata:docacteco:{cod or dep_name.lower().replace(' ', '-')}"
        payload = {
            "type": "intereses_economicos",
            "source": "congreso_opendata",
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "activities": activities,
            "activity_count": len(activities),
            "original_name": dep_name,
        }

        if dry_run:
            match_info = pol_by_name.get(key, (None, None))
            status = f"→ {pol_id[:8] if pol_id else 'UNMATCHED'}"
            print(f"  {dep_name[:45]:45s} {len(activities):3d} acts {status}")
            continue

        if not pol_id:
            continue

        # Parse Spanish date (DD/MM/YYYY → YYYY-MM-DD)
        decl_date = None
        if activities:
            raw_date = activities[0]["registration_date"]
            if raw_date and "/" in raw_date:
                parts = raw_date.split("/")
                if len(parts) == 3:
                    decl_date = f"{parts[2]}-{parts[1]}-{parts[0]}"

        cur.execute(
            """
            INSERT INTO economic_declarations
                (politician_id, legislature_id, declaration_date, source_url, raw_data)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (source_url) WHERE source_url IS NOT NULL DO UPDATE SET
                politician_id = EXCLUDED.politician_id,
                legislature_id = EXCLUDED.legislature_id,
                raw_data = EXCLUDED.raw_data
            """,
            (
                pol_id, leg_id, decl_date,
                source_url,
                psycopg2.extras.Json(payload),
            ),
        )
        inserted += 1

    if not dry_run:
        conn.commit()
    cur.close()
    conn.close()

    print(f"\nDone! {matched} matched, {unmatched} unmatched, {inserted} upserted.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    run(dry_run=args.dry_run)


if __name__ == "__main__":
    main()
