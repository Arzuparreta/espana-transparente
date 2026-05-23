"""BORME company officers ETL via OpenMercantil API.

OpenMercantil (openmercantil.es) provides a free REST API with company
officer data derived from the BORME (Boletín Oficial del Registro Mercantil).
License: CC BY 4.0.

This module:
1. Finds organizations in our DB that have company/public_body types
2. Looks up each one on the OpenMercantil API by name
3. Extracts current officers (directors, executives, attorneys)
4. Upserts into borme_officers table
5. Cross-references officer names against our politicians table (fuzzy match)

Usage:
    PYTHONPATH=src python -m src.borme.officers --dry-run
    PYTHONPATH=src python -m src.borme.officers --limit 50
    PYTHONPATH=src python -m src.borme.officers --resume
"""

import argparse
import re
import time
import urllib.parse
from datetime import date, datetime, timezone
from typing import Any

import httpx
import psycopg2.extras

from common.db import get_pg_conn

API_BASE = "https://openmercantil.es/api/v1"
REQUEST_DELAY = 1.0  # be nice to the API
BATCH_SIZE = 10
MAX_RETRIES = 3

# Sluggify company name for API lookup (same algo OpenMercantil uses)
def company_slug(name: str) -> str:
    """Convert a company name to an OpenMercantil-compatible slug."""
    slug = name.strip().lower()
    # Remove legal form suffixes that OpenMercantil strips
    slug = re.sub(
        r'\b(s\.?a\.?|s\.?l\.?|s\.?l\.?u\.?|s\.?a\.?s\.?m\.?e\.?|s\.?m\.?e\.?|'
        r's\.?coop\.?|s\.?a\.?u\.?|s\.?l\.?l\.?|s\.?c\.?|s\.?c\.?p\.?|s\.?com\.?|'
        r's\.?a\.?p\.?|s\.?a\.?t\.?|a\.?i\.?e\.?|s\.?g\.?r\.?|s\.?i\.?c\.?a\.?v\.?|'
        r's\.?a\.?d\.?|u\.?t\.?e\.?)\b',
        '', slug, flags=re.IGNORECASE
    )
    # Remove parentheticals: "Empresa (EN LIQUIDACION)" → "Empresa"
    slug = re.sub(r'\([^)]*\)', '', slug)
    # Clean special chars, replace spaces with hyphens
    slug = re.sub(r'[^a-z0-9\s-]', '', slug)
    slug = re.sub(r'\s+', '-', slug.strip())
    slug = re.sub(r'-+', '-', slug)
    return slug.strip('-')


def fetch_officers(client: httpx.Client, name: str, cif: str | None = None) -> dict[str, Any] | None:
    """Query OpenMercantil API for a company's officers."""
    slug = company_slug(name)
    url = f"{API_BASE}/company/{slug}"

    for attempt in range(MAX_RETRIES):
        try:
            resp = client.get(url, timeout=30.0)
            if resp.status_code == 404:
                # Try with CIF if name lookup fails
                if cif and attempt == 1:
                    slug = cif.lower().replace(' ', '')
                    url = f"{API_BASE}/company/{slug}"
                    continue
                return None
            resp.raise_for_status()
            data = resp.json()
            if not data.get('company'):
                return None
            return data
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 429:
                time.sleep(5 * (attempt + 1))
                continue
            if e.response.status_code >= 500:
                time.sleep(2 * (attempt + 1))
                continue
            return None
        except Exception:
            time.sleep(1)
            continue
    return None


def get_orgs_to_process(cur, limit: int | None = None, resume: bool = False) -> list[dict]:
    """Get organizations that potentially have BORME data."""
    query = """
        SELECT o.id, o.name, o.organization_type,
               (regexp_match(o.source_url, '[A-Z][0-9]{7}[A-Z0-9]'))[1] AS cif
        FROM organizations o
        WHERE o.organization_type IN ('company', 'public_body', 'other')
          AND o.name IS NOT NULL
          AND trim(o.name) <> ''
    """
    if resume:
        query += """
          AND o.id NOT IN (
            SELECT DISTINCT organization_id FROM borme_officers
          )
        """
    query += """
        ORDER BY o.name
    """
    if limit:
        query += f" LIMIT {limit}"

    cur.execute(query)
    cols = [desc[0] for desc in cur.description]
    return [dict(zip(cols, row)) for row in cur.fetchall()]


def upsert_officers(cur, org_id: str, data: dict) -> int:
    """Insert/update BORME officers for an organization."""
    officers = data.get('officers', {})
    current_officers = officers.get('current', [])
    company = data.get('company', {})
    company_slug_val = company.get('slug', '')
    company_cif = company.get('cif', '')

    count = 0
    for officer in current_officers:
        name = officer.get('name', '').strip()
        if not name:
            continue

        role = officer.get('role', '') or ''
        person_slug = officer.get('person_slug', '') or ''
        since_str = officer.get('since', '') or ''
        since_date = None
        if since_str:
            try:
                since_date = date.fromisoformat(since_str)
            except ValueError:
                pass

        source_url = f"https://openmercantil.es/empresa/{company_slug_val}"

        cur.execute("""
            INSERT INTO borme_officers
                (organization_id, person_name, person_slug, role, since,
                 is_current, company_slug, company_cif, source, source_url, fetched_at)
            VALUES (%s, %s, %s, %s, %s, true, %s, %s, 'openmercantil', %s, now())
            ON CONFLICT (organization_id, person_name, role, company_slug)
            DO UPDATE SET
                is_current = true,
                since = EXCLUDED.since,
                person_slug = EXCLUDED.person_slug,
                fetched_at = now()
        """, (org_id, name, person_slug, role, since_date, company_slug_val, company_cif, source_url))
        count += 1

    return count


def cross_reference_politicians(cur) -> int:
    """Fuzzy-match BORME officer names against our politicians table."""
    cur.execute("""
        WITH new_officers AS (
            SELECT bo.id AS officer_id, bo.person_name
            FROM borme_officers bo
            WHERE bo.id NOT IN (
                SELECT borme_officer_id FROM borme_politician_matches
            )
        ),
        matches AS (
            SELECT
                no.officer_id,
                p.id AS politician_id,
                similarity(
                    lower(unaccent(no.person_name)),
                    lower(unaccent(p.full_name))
                ) AS conf
            FROM new_officers no
            CROSS JOIN politicians p
            WHERE similarity(
                lower(unaccent(no.person_name)),
                lower(unaccent(p.full_name))
            ) >= 0.65
        ),
        best_matches AS (
            SELECT DISTINCT ON (officer_id)
                officer_id, politician_id, conf::numeric(3,2) AS confidence
            FROM matches
            ORDER BY officer_id, conf DESC
        )
        INSERT INTO borme_politician_matches
            (borme_officer_id, politician_id, confidence, match_method)
        SELECT officer_id, politician_id, confidence, 'pg_trgm'
        FROM best_matches
        WHERE confidence >= 0.85
        ON CONFLICT (borme_officer_id, politician_id) DO NOTHING
    """)
    return cur.rowcount


def run(dry_run: bool = False, limit: int | None = None, resume: bool = False) -> tuple[int, int]:
    """Main ETL: fetch BORME officers and cross-reference with politicians."""
    conn = get_pg_conn()
    processed = 0
    total_officers = 0

    try:
        with conn.cursor() as cur:
            orgs = get_orgs_to_process(cur, limit=limit, resume=resume)
            print(f"Found {len(orgs)} organizations to check for BORME data")

            if dry_run:
                print("[DRY-RUN] Would query OpenMercantil API for these orgs:")
                for org in orgs[:10]:
                    slug = company_slug(org['name'])
                    print(f"  {org['name'][:60]} → {API_BASE}/company/{slug}")
                if len(orgs) > 10:
                    print(f"  ... and {len(orgs) - 10} more")
                return 0, 0

            with httpx.Client(
                headers={"User-Agent": "EspanaTransparente/1.0 (open data portal)"},
                timeout=30.0
            ) as client:
                for i, org in enumerate(orgs):
                    print(f"[{i+1}/{len(orgs)}] {org['name'][:70]}...", end=' ', flush=True)

                    data = fetch_officers(client, org['name'], org.get('cif'))
                    if data is None:
                        print("(not found)")
                    else:
                        count = upsert_officers(cur, org['id'], data)
                        total_officers += count
                        n_off = len(data.get('officers', {}).get('current', []))
                        print(f"✓ {n_off} officers, {count} upserted")

                    processed += 1
                    if processed % BATCH_SIZE == 0:
                        conn.commit()
                        print(f"  [committed batch at {processed}]")

                    time.sleep(REQUEST_DELAY)

            conn.commit()

            # Cross-reference
            print("\nCross-referencing officers against politicians...")
            matches = cross_reference_politicians(cur)
            conn.commit()
            print(f"  {matches} politician matches found")

    finally:
        conn.close()

    print(f"\nDone. Processed {processed} orgs, {total_officers} officers total.")
    return processed, total_officers


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest BORME company officers from OpenMercantil")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--resume", action="store_true")
    args = parser.parse_args()

    run(dry_run=args.dry_run, limit=args.limit, resume=args.resume)


if __name__ == "__main__":
    main()
