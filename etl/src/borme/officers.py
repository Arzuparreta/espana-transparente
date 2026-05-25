"""BORME company officers ETL via OpenMercantil API.

OpenMercantil (openmercantil.es) provides a free REST API with company
officer data derived from the BORME (Boletín Oficial del Registro Mercantil).
License: CC BY 4.0.

This module:
1. Finds organizations in our DB that have company types
2. Uses the OpenMercantil SEARCH API to find matching companies by name
3. Fetches current officers (directors, executives, attorneys) for matched companies
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
from datetime import date
from typing import Any

import httpx
import psycopg2.extras

from common.db import get_pg_conn

API_BASE = "https://openmercantil.es/api/v1"
REQUEST_DELAY = 1.2  # free tier: 200 req/day, be conservative
BATCH_SIZE = 5
MAX_RETRIES = 3

# ── Prefix patterns that don't contain the actual company name ────────────────
ADMIN_PREFIXES = [
    r"(?i)\bconsejo\s+de\s+administraci[oó]n[^a-z]*",
    r"(?i)\bcomit[eé]\s+(de\s+)?(direcci[oó]n|inversiones|compras|central|corporativo)?\s*(de\s+)?(la\s+)?[^a-z]*",
    r"(?i)\bpresidencia\s+(de\s+)?(la\s+)?[^a-z]*",
    r"(?i)\bdirecci[oó]n\s+(de\s+)?(compras\s+)?(corporativa\s+)?(de\s+)?(la\s+)?[^a-z]*",
    r"(?i)\bdelegaci[oó]n\s+(provincial\s+)?(de\s+)?(la\s+)?[^a-z]*",
    r"(?i)\bsecretar[ií]a\s+(general\s+)?(de\s+)?(la\s+)?[^a-z]*",
    r"(?i)\bcomisi[oó]n\s+(de\s+)?\w+\s+(de\s+)?(la\s+)?[^a-z]*",
    r"(?i)\b(oficina|servicio|departamento|unidad|subdirecci[oó]n)\s+(de\s+)?\w+\s+(de\s+)?(la\s+)?[^a-z]*",
    r"(?i)\b(inspecci[oó]n|intervenci[oó]n)\s+(general\s+)?(de\s+)?(la\s+)?[^a-z]*",
    r"(?i)\bgerencia\s+(de\s+)?(la\s+)?[^a-z]*",
]

# ── Suffix patterns to strip ──────────────────────────────────────────────────
ADMIN_SUFFIXES = [
    r"(?i)\s+-\s+presidencia\s*$",
    r"(?i)\s+-\s+gerencia\s*$",
    r"(?i)\s+-\s+direcci[oó]n\s*$",
    r"(?i)\s+-\s+secretar[ií]a\s*$",
]

# Legal form patterns to strip
LEGAL_FORMS = (
    r'\b(s\.?a\.?(?:\s*s\.?m\.?e\.?)?|s\.?a\.?u\.?|s\.?l\.?(?:\s*u\.?)?|'
    r's\.?l\.?l\.?|s\.?coop\.?|s\.?c\.?(?:\s*p\.?)?|s\.?com\.?|a\.?i\.?e\.?|'
    r's\.?g\.?r\.?|s\.?a\.?d\.?|u\.?t\.?e\.?|s\.?a\.?p\.?|s\.?a\.?t\.?)\b'
)


def strip_legal_forms(name: str) -> str:
    """Remove legal form suffixes and artifacts like S.A., S.L., .,S.M.E., etc."""
    cleaned = re.sub(LEGAL_FORMS, '', name, flags=re.IGNORECASE)
    # Remove artifacts left by legal form stripping: ",.,S.M.E., M.P." → ""
    cleaned = re.sub(r'[,.]{2,}', '', cleaned)  # double punctuation
    cleaned = re.sub(r'(?:^|\s)[,.]\s*', ' ', cleaned)  # orphaned comma/dot
    cleaned = re.sub(r'\s*,\s*,\s*', ', ', cleaned)  # double comma
    cleaned = re.sub(r'^[,\s]+', '', cleaned)  # leading punctuation
    cleaned = re.sub(r'[,\s]+$', '', cleaned)  # trailing punctuation
    return re.sub(r'\s+', ' ', cleaned).strip()


def extract_core_company_name(org_name: str) -> str:
    """Extract the actual company name from a long administrative org name.

    "Consejo de Administración de la Sociedad Estatal Correos y Telégrafos S.A"
    → "Sociedad Estatal Correos y Telégrafos"

    "Comité de Compras de Navantia S.A., S.M.E."
    → "Navantia"
    """
    name = org_name.strip()
    # Strip legal forms first
    name = strip_legal_forms(name)
    # Remove parentheticals
    name = re.sub(r'\([^)]*\)', '', name).strip()
    # Remove administrative prefixes
    for pattern in ADMIN_PREFIXES:
        name = re.sub(pattern, '', name).strip()
    # Remove administrative suffixes
    for pattern in ADMIN_SUFFIXES:
        name = re.sub(pattern, '', name).strip()
    # Clean up: remove leading/trailing commas, "de la/de los/del" at start
    name = re.sub(r'^[,\s]*(de\s+)?(la\s+|los\s+|las\s+|el\s+)?', '', name)
    # Remove trailing punctuation
    name = re.sub(r'[,\s]+$', '', name)
    # Clean spaces
    name = re.sub(r'\s+', ' ', name).strip()
    return name


def extract_search_terms(org_name: str) -> list[str]:
    """Generate candidate search queries for an organization name, ordered by specificity.

    Returns up to 3 candidate search queries, from most to least specific.
    """
    core = extract_core_company_name(org_name)
    if not core or len(core) < 3:
        return []

    terms = []

    # Strategy 1: The full core name
    terms.append(core[:100])

    # Strategy 2: Extract the most distinctive words (capitalized, non-generic)
    words = core.split()
    # Remove very common Spanish words
    stopwords = {'de', 'la', 'las', 'los', 'del', 'el', 'y', 'e', 'en', 'a', 'con',
                 'para', 'por', 'su', 'al', 'un', 'una', 'o', 'lo', 'se', 'es'}
    distinctive = [w for w in words if w.lower() not in stopwords and len(w) > 2]
    if distinctive and ' '.join(distinctive) != core:
        terms.append(' '.join(distinctive[:5]))

    # Strategy 3: Just the acronym-like words (all caps or capitalized unique words)
    proper_nouns = [w for w in words if w[0].isupper() and w.lower() not in stopwords]
    if proper_nouns and ' '.join(proper_nouns) != core:
        terms.append(' '.join(proper_nouns[:3]))

    # Deduplicate
    seen = set()
    unique = []
    for t in terms:
        if t.lower() not in seen:
            seen.add(t.lower())
            unique.append(t)
    return unique[:3]


def search_company(client: httpx.Client, query: str) -> dict[str, Any] | None:
    """Search OpenMercantil for a company by name and return the best match."""
    url = f"{API_BASE}/search"
    params = {"q": query}

    for attempt in range(MAX_RETRIES):
        try:
            resp = client.get(url, params=params, timeout=30.0)
            if resp.status_code == 429:
                wait = 10 * (attempt + 1)
                print(f"(rate limited, waiting {wait}s)", end=' ', flush=True)
                time.sleep(wait)
                continue
            if resp.status_code >= 500:
                time.sleep(2 * (attempt + 1))
                continue
            resp.raise_for_status()
            data = resp.json()
            items = data.get("items", [])
            if not items:
                return None
            # Return the first (best) match
            return items[0]
        except Exception:
            time.sleep(1)
            continue
    return None


def find_company(client: httpx.Client, org_name: str, org_cif: str | None = None) -> dict[str, Any] | None:
    """Find a company on OpenMercantil using multiple search strategies.

    Returns the matched company dict (with slug, name, cif) or None.
    """
    search_terms = extract_search_terms(org_name)

    for term in search_terms:
        if len(term) < 3:
            continue
        result = search_company(client, term)
        if result and _validate_match(org_name, result):
            return result

    # Fallback: try with CIF if we have one
    if org_cif:
        # Search by CIF
        result = search_company(client, org_cif)
        if result and _validate_match(org_name, result):
            return result

    return None


def _validate_match(org_name: str, match: dict, min_similarity: float = 0.35) -> bool:
    """Check that the matched company name is plausibly related to the org name.

    Uses simple token overlap: at least one significant word (len > 3) from
    the core name must appear in the matched company name.
    """
    matched_name = match.get('name', '').lower()
    core = extract_core_company_name(org_name).lower()

    if not core or not matched_name:
        return False

    # Tokenize and filter short/stop words
    stopwords = {'de', 'la', 'las', 'los', 'del', 'el', 'y', 'e', 'en', 'a', 'con',
                 'para', 'por', 'su', 'al', 'un', 'una', 'o', 'lo', 'se', 'es',
                 'sociedad', 'limitada', 'anonima', 'estatal'}
    core_tokens = [t for t in core.split() if len(t) > 3 and t not in stopwords]
    matched_tokens = matched_name.split()

    if not core_tokens:
        return False

    # At least one significant token must appear as a whole word or word-start
    # in the matched name (substring match only for tokens >= 5 chars to avoid
    # false matches like "ADIF" matching "ADIFORM")
    overlap = 0
    for t in core_tokens:
        for mt in matched_tokens:
            if len(t) >= 5:
                if t in mt:  # substring ok for longer tokens
                    overlap += 1
                    break
            else:
                if mt == t:  # exact match for short tokens
                    overlap += 1
                    break
    ratio = overlap / len(core_tokens)

    return ratio >= min_similarity


def fetch_officers_for_slug(client: httpx.Client, slug: str) -> dict[str, Any] | None:
    """Fetch officers for a company given its OpenMercantil slug."""
    url = f"{API_BASE}/company/{slug}"

    for attempt in range(MAX_RETRIES):
        try:
            resp = client.get(url, timeout=30.0)
            if resp.status_code == 404:
                return None
            if resp.status_code == 429:
                time.sleep(5 * (attempt + 1))
                continue
            if resp.status_code >= 500:
                time.sleep(2 * (attempt + 1))
                continue
            resp.raise_for_status()
            data = resp.json()
            if not data.get('company'):
                return None
            return data
        except Exception:
            time.sleep(1)
            continue
    return None


def get_orgs_to_process(cur, limit: int | None = None, resume: bool = False) -> list[dict]:
    """Get organizations that potentially have BORME data.

    Prioritizes companies and public bodies (which are most likely to have
    Mercantil Registry entries). Skips individual people names.
    """
    query = """
        SELECT o.id, o.name, o.organization_type,
               (regexp_match(o.source_url, '[A-Z][0-9]{7}[A-Z0-9]'))[1] AS cif
        FROM organizations o
        WHERE o.organization_type IN ('company', 'public_body')
          AND o.name IS NOT NULL
          AND trim(o.name) <> ''
          AND o.name !~ '^[A-Z][0-9]'  -- skip CIF-only names
          -- Exclude municipal/administrative positions (not in Mercantil Registry)
          AND o.name !~* '^Alcald(e|ía)'
          AND o.name !~* '^Alcalde'
          AND o.name !~* '^Teniente de Alcalde'
          AND o.name !~* '^Concejal'
          AND o.name !~* '^Portavoz de(l| la)? (Grupo|Ayuntamiento|Diputación)'
          AND o.name !~* '^Diputado'
          AND o.name !~* '^Senador'
          AND o.name !~* '^Ministro'
          AND o.name !~* '^Secretario de Estado'
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
    """Fuzzy-match BORME officer names against our politicians table.

    Uses the GIN trigram index on politicians.full_name via the % operator
    for pre-filtering, then similarity() for scoring.
    """
    cur.execute("""
        WITH new_officers AS (
            SELECT bo.id AS officer_id, bo.person_name
            FROM borme_officers bo
            WHERE bo.id NOT IN (
                SELECT borme_officer_id FROM borme_politician_matches
            )
        ),
        candidates AS (
            SELECT
                no.officer_id,
                p.id AS politician_id,
                p.full_name
            FROM new_officers no
            JOIN politicians p
              ON p.full_name % no.person_name
            WHERE similarity(p.full_name, no.person_name) >= 0.65
        ),
        best_matches AS (
            SELECT DISTINCT ON (officer_id)
                officer_id,
                politician_id,
                similarity(c.full_name, no.person_name)::numeric(3,2) AS confidence
            FROM candidates c
            JOIN new_officers no ON c.officer_id = no.officer_id
            ORDER BY officer_id, similarity(c.full_name, no.person_name) DESC
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
                print("[DRY-RUN] Would search OpenMercantil for these orgs:")
                for org in orgs[:15]:
                    terms = extract_search_terms(org['name'])
                    print(f"  {org['name'][:60]}")
                    for t in terms:
                        print(f"    → search: {t[:80]}")
                if len(orgs) > 15:
                    print(f"  ... and {len(orgs) - 15} more")
                return 0, 0

            with httpx.Client(
                headers={"User-Agent": "EspanaTransparente/1.0 (non-commercial open data)"},
                timeout=30.0
            ) as client:
                for i, org in enumerate(orgs):
                    name_short = org['name'][:60]
                    print(f"[{i+1}/{len(orgs)}] {name_short}...", end=' ', flush=True)

                    # Step 1: Find company via search API
                    match = find_company(client, org['name'], org.get('cif'))
                    if not match:
                        print("(no match)")
                        processed += 1
                        time.sleep(REQUEST_DELAY)
                        continue

                    matched_name = match.get('name', '?')
                    matched_slug = match.get('slug', '')
                    print(f"→ {matched_name[:50]}", end=' ', flush=True)

                    # Step 2: Fetch officers via company slug
                    data = fetch_officers_for_slug(client, matched_slug)
                    if not data:
                        print("(no officer data)")
                    else:
                        count = upsert_officers(cur, org['id'], data)
                        total_officers += count
                        n_off = len(data.get('officers', {}).get('current', []))
                        print(f"✓ {n_off} officers")

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
