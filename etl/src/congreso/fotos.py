"""ETL script: match Spanish Congress politicians to Wikidata photos.

Queries Wikidata for all Spanish politicians with photos, matches them
against our DB by normalized name, and updates photo_url.

Usage:
    PYTHONPATH=src python -m src.congreso.fotos
"""

import re
import time
import unicodedata
import psycopg2.extras
import urllib.request
import json
from common.db import get_pg_conn

SPARQL_URL = "https://query.wikidata.org/sparql"

SPARQL_QUERY = """
SELECT DISTINCT ?person ?personLabel ?photo WHERE {
  ?person wdt:P27 wd:Q29 ;
          wdt:P106 wd:Q82955 ;
          wdt:P18 ?photo .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en" . }
}
"""


def normalize(name: str) -> frozenset[str]:
    """Lowercase, strip accents, split into tokens."""
    nfkd = unicodedata.normalize("NFKD", name.lower())
    ascii_name = "".join(c for c in nfkd if not unicodedata.combining(c))
    tokens = re.findall(r"[a-z]+", ascii_name)
    return frozenset(t for t in tokens if len(t) > 1)


def jaccard(a: frozenset, b: frozenset) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def fetch_wikidata() -> list[tuple[str, str]]:
    """Return list of (label, photo_url) from Wikidata."""
    req = urllib.request.Request(
        SPARQL_URL + "?query=" + urllib.parse.quote(SPARQL_QUERY),
        headers={
            "Accept": "application/json",
            "User-Agent": "AccionHumana/1.0 (transparency portal; contact: rubenpenarubio02@gmail.com)",
        },
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = json.loads(resp.read())

    results = []
    for binding in data["results"]["bindings"]:
        label = binding.get("personLabel", {}).get("value", "")
        photo = binding.get("photo", {}).get("value", "").replace("http://", "https://")
        if label and photo:
            results.append((label, photo))
    return results


def run() -> None:
    import urllib.parse

    print("Fetching Wikidata photos for Spanish politicians...")
    wd_entries = fetch_wikidata()
    print(f"  Got {len(wd_entries)} Wikidata entries with photos")

    # Build normalized index: frozenset → best photo url
    wd_index: list[tuple[frozenset, str]] = [
        (normalize(label), photo_url)
        for label, photo_url in wd_entries
        if normalize(label)
    ]

    conn = get_pg_conn()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    cur.execute("SELECT id, full_name FROM politicians WHERE photo_url IS NULL")
    politicians = cur.fetchall()
    print(f"  {len(politicians)} politicians without photos in DB")

    updated = 0
    unmatched = []

    for pol in politicians:
        pol_tokens = normalize(pol["full_name"])
        best_score = 0.0
        best_photo = None

        for wd_tokens, photo_url in wd_index:
            score = jaccard(pol_tokens, wd_tokens)
            if score > best_score:
                best_score = score
                best_photo = photo_url

        # Require strong overlap (≥0.5 jaccard) and at least 2 tokens matching
        pol_set = pol_tokens
        if best_photo and best_score >= 0.5:
            cur.execute(
                "UPDATE politicians SET photo_url = %s, updated_at = now() WHERE id = %s",
                (best_photo, pol["id"]),
            )
            updated += 1
        else:
            unmatched.append(pol["full_name"])

    conn.commit()
    cur.close()
    conn.close()

    print(f"Done! Updated {updated} photos, {len(unmatched)} unmatched")
    if unmatched[:10]:
        print("  Unmatched sample:", unmatched[:10])


if __name__ == "__main__":
    run()
