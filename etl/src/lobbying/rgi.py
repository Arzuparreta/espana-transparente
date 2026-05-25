"""CNMC Lobbying Register ETL.

Scrapes the CNMC Registro de Grupos de Interés (rgi.cnmc.es) for lobbying
entities and their declared activities. The register is public and voluntary;
~1,200 entities are registered as of 2026.

Usage:
    PYTHONPATH=src python -m src.lobbying.rgi --dry-run
    PYTHONPATH=src python -m src.lobbying.rgi --limit 50
    PYTHONPATH=src python -m src.lobbying.rgi --resume
"""

import argparse
import re
import time
from typing import Any

import httpx
from bs4 import BeautifulSoup
import psycopg2.extras

from common.db import get_pg_conn

BASE_URL = "https://rgi.cnmc.es"
LIST_URL = f"{BASE_URL}/buscador"
REQUEST_DELAY = 1.5  # be respectful
BATCH_SIZE = 10
MAX_RETRIES = 3


def fetch_list_page(client: httpx.Client, page: int = 0) -> list[dict[str, str]]:
    """Fetch one page of the lobbying register listing and return name+slug pairs."""
    url = f"{LIST_URL}?page={page}"
    resp = client.get(url, timeout=30.0)
    resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "html.parser")
    entries = []

    # Find all links that point to /gruposdeinteres/...
    for link in soup.select("a[href]"):
        href = link.get("href", "")
        if "/gruposdeinteres/" in href and href.count("/") >= 2:
            name = link.get_text(strip=True)
            if name and len(name) > 2:
                slug = href.rstrip("/").split("/")[-1]
                entries.append({"name": name, "slug": slug})

    return entries


def fetch_detail(client: httpx.Client, slug: str) -> dict[str, Any] | None:
    """Scrape a lobbying group detail page."""
    url = f"{BASE_URL}/gruposdeinteres/{slug}"
    for attempt in range(MAX_RETRIES):
        try:
            resp = client.get(url, timeout=30.0)
            resp.raise_for_status()
            break
        except Exception:
            if attempt == MAX_RETRIES - 1:
                return None
            time.sleep(2 * (attempt + 1))

    soup = BeautifulSoup(resp.text, "html.parser")

    def field_after(label: str) -> str | None:
        """Find a field value following a label in the detail page."""
        # Look for the label text, then get the next text content
        for elem in soup.find_all(string=re.compile(re.escape(label), re.IGNORECASE)):
            parent = elem.find_parent()
            if parent:
                next_div = parent.find_next_sibling("div")
                if next_div:
                    text = next_div.get_text(strip=True)
                    if text and text != label:
                        return text
                # Try inside the same parent
                all_text = parent.get_text(strip=True)
                if all_text and label in all_text:
                    # Split by label and take what comes after
                    parts = all_text.split(label, 1)
                    if len(parts) > 1:
                        return parts[1].strip().rstrip(":")
        return None

    # Category and subcategory
    category = None
    subcategory = None
    cat_label = soup.find(string=re.compile("Categoría:"))
    if cat_label:
        cat_parent = cat_label.find_parent()
        if cat_parent:
            cat_text = cat_parent.get_text("|", strip=True).split("|")
            for part in cat_text:
                part = part.strip()
                if part.startswith("I.") or part.startswith("II.") or part.startswith("III.") or \
                   part.startswith("IV.") or part.startswith("V."):
                    category = part
                elif part and part != "Categoría:" and not part.startswith("I."):
                    if not subcategory:
                        subcategory = part

    # Address
    postal_code = field_after("Código Postal:")
    street = field_after("Domicilio Social/Profesional:")
    locality = field_after("Localidad:")
    country = field_after("País:")

    # Representatives
    legal_name = field_after("Nombre y apellidos:")
    legal_role = field_after("Cargo:")

    # Contact (may be different section)
    contact_name = None
    contact_role = None
    contact_section = soup.find(string=re.compile("persona de contacto principal"))
    if contact_section:
        contact_parent = contact_section.find_parent()
        if contact_parent:
            # Find the next "Nombre y apellidos" after this
            pass

    # Objectives and activities
    objectives = field_after("Finalidad y Objetivos:")
    activities = field_after("Actividades específicas")

    # Interest areas
    interest_areas = None
    ambito_header = soup.find(string=re.compile("Ámbitos de interés"))
    if ambito_header:
        ambito_parent = ambito_header.find_parent()
        if ambito_parent:
            # Get all text under this section
            areas_text = []
            for sibling in ambito_parent.find_next_siblings():
                areas_text.append(sibling.get_text(strip=True))
            interest_areas = " | ".join(areas_text)

    return {
        "slug": slug,
        "category": category,
        "subcategory": subcategory,
        "address_postal_code": postal_code,
        "address_street": street,
        "address_locality": locality,
        "address_country": country,
        "legal_rep_name": legal_name,
        "legal_rep_role": legal_role,
        "contact_name": contact_name,
        "contact_role": contact_role,
        "objectives": objectives,
        "activities": activities,
        "interest_areas": interest_areas,
        "source_url": url,
    }


def upsert_group(cur, data: dict[str, Any]) -> bool:
    """Insert or update a lobbying group record."""
    cur.execute("""
        INSERT INTO lobbying_groups (
            name, slug, category, subcategory,
            address_postal_code, address_street, address_locality, address_country,
            legal_rep_name, legal_rep_role,
            contact_name, contact_role,
            objectives, activities, interest_areas,
            source_url, fetched_at, updated_at
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, now(), now())
        ON CONFLICT (slug) DO UPDATE SET
            name = EXCLUDED.name,
            category = EXCLUDED.category,
            subcategory = EXCLUDED.subcategory,
            address_postal_code = EXCLUDED.address_postal_code,
            address_street = EXCLUDED.address_street,
            address_locality = EXCLUDED.address_locality,
            address_country = EXCLUDED.address_country,
            legal_rep_name = EXCLUDED.legal_rep_name,
            legal_rep_role = EXCLUDED.legal_rep_role,
            contact_name = EXCLUDED.contact_name,
            contact_role = EXCLUDED.contact_role,
            objectives = EXCLUDED.objectives,
            activities = EXCLUDED.activities,
            interest_areas = EXCLUDED.interest_areas,
            source_url = EXCLUDED.source_url,
            updated_at = now()
    """, (
        data["name"], data["slug"], data["category"], data["subcategory"],
        data["address_postal_code"], data["address_street"], data["address_locality"], data["address_country"],
        data["legal_rep_name"], data["legal_rep_role"],
        data["contact_name"], data["contact_role"],
        data["objectives"], data["activities"], data["interest_areas"],
        data["source_url"],
    ))
    return True


def link_to_organizations(cur) -> int:
    """Fuzzy-match lobbying groups to organizations we track.

    Two-step strategy to use the GIN trigram index:
    1. Pre-filter using the % (similarity) operator which uses the index
    2. Score the survivors with similarity() and keep best match
    """
    cur.execute("""
        WITH new_groups AS (
            SELECT lg.id AS group_id, lg.name
            FROM lobbying_groups lg
            WHERE lg.id NOT IN (
                SELECT lobbying_group_id FROM lobbying_organization_links
            )
        ),
        candidates AS (
            SELECT
                ng.group_id,
                o.id AS organization_id,
                o.name AS org_name
            FROM new_groups ng
            JOIN organizations o
              ON lower(o.name) % lower(ng.name)
            WHERE o.name IS NOT NULL
              AND trim(o.name) <> ''
              AND similarity(lower(o.name), lower(ng.name)) >= 0.55
        ),
        best_matches AS (
            SELECT DISTINCT ON (c.group_id)
                c.group_id,
                c.organization_id,
                similarity(lower(c.org_name), lower(ng.name))::numeric(3,2) AS confidence
            FROM candidates c
            JOIN new_groups ng ON c.group_id = ng.group_id
            ORDER BY c.group_id, similarity(lower(c.org_name), lower(ng.name)) DESC
        )
        INSERT INTO lobbying_organization_links
            (lobbying_group_id, organization_id, confidence, match_method)
        SELECT group_id, organization_id, confidence, 'pg_trgm'
        FROM best_matches
        WHERE confidence >= 0.75
        ON CONFLICT (lobbying_group_id, organization_id) DO NOTHING
    """)
    return cur.rowcount


def run(dry_run: bool = False, limit: int | None = None, resume: bool = False) -> tuple[int, int]:
    """Main ETL: scrape CNMC lobbying register."""
    conn = get_pg_conn()
    groups_processed = 0
    pages_scraped = 0

    try:
        with httpx.Client(
            headers={"User-Agent": "EspanaTransparente/1.0 (open data portal)"},
            timeout=30.0
        ) as client:
            # Step 1: Collect all entries from list pages
            all_entries: list[dict[str, str]] = []
            page = 0
            while True:
                entries = fetch_list_page(client, page)
                if not entries:
                    break
                all_entries.extend(entries)
                pages_scraped += 1
                page += 1
                if limit and len(all_entries) >= limit:
                    all_entries = all_entries[:limit]
                    break
                time.sleep(REQUEST_DELAY)

            print(f"Found {len(all_entries)} entries across {pages_scraped} pages")

            if dry_run:
                print("[DRY-RUN] Would scrape detail pages for:")
                for e in all_entries[:10]:
                    print(f"  {e['name'][:70]} → {BASE_URL}/gruposdeinteres/{e['slug']}")
                if len(all_entries) > 10:
                    print(f"  ... and {len(all_entries) - 10} more")
                return len(all_entries), 0

            # Step 2: Check which ones we already have (resume mode)
            with conn.cursor() as cur:
                if resume:
                    cur.execute("SELECT slug FROM lobbying_groups")
                    existing = {row[0] for row in cur.fetchall()}
                    to_process = [e for e in all_entries if e['slug'] not in existing]
                    print(f"Resuming: {len(to_process)} new out of {len(all_entries)} total")
                else:
                    to_process = all_entries

                # Step 3: Scrape each detail page
                for i, entry in enumerate(to_process):
                    print(f"[{i+1}/{len(to_process)}] {entry['name'][:70]}...", end=' ', flush=True)

                    detail = fetch_detail(client, entry['slug'])
                    if detail is None:
                        print("(failed)")
                        continue

                    detail['name'] = entry['name']
                    upsert_group(cur, detail)
                    groups_processed += 1
                    print("✓")

                    if groups_processed % BATCH_SIZE == 0:
                        conn.commit()
                        print(f"  [committed batch at {groups_processed}]")

                    time.sleep(REQUEST_DELAY)

                conn.commit()

                # Step 4: Link to organizations
                print("\nLinking lobbying groups to organizations...")
                links = link_to_organizations(cur)
                conn.commit()
                print(f"  {links} organization links found")

    finally:
        conn.close()

    print(f"\nDone. Scraped {groups_processed} groups across {pages_scraped} pages.")
    return groups_processed, pages_scraped


def main() -> None:
    parser = argparse.ArgumentParser(description="Scrape CNMC lobbying register")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--resume", action="store_true")
    args = parser.parse_args()

    run(dry_run=args.dry_run, limit=args.limit, resume=args.resume)


if __name__ == "__main__":
    main()
