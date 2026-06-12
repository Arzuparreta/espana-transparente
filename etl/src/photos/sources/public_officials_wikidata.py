"""Fetch Wikidata (P18) photos for public_officials.

Standalone script — not part of the politicians PhotoSource pipeline.
For each `public_officials` row with a `wikidata_qid` and no `photo_url` yet,
fetches the P18 image from Wikidata, builds responsive WebP variants, and
uploads them to the `politician-photos` bucket under `public-officials/`.
"""

from __future__ import annotations

import argparse
import json
import re
import time
import urllib.parse
import urllib.request

from common.db import get_pg_conn

from ..storage import public_official_variant_key, slugify, upload_photo
from ..validate import (
    PhotoValidationError,
    build_responsive_variants,
    download_with_final_url,
    sha256_hex,
)

SPARQL_URL = "https://query.wikidata.org/sparql"
USER_AGENT = "EspanaTransparente/1.0 (transparency portal; rubenpenarubio02@gmail.com)"
RETRIES = 3


def _fetch_sparql(query: str) -> list[dict]:
    last_exc: Exception | None = None
    for attempt in range(RETRIES):
        try:
            req = urllib.request.Request(
                SPARQL_URL + "?query=" + urllib.parse.quote(query),
                headers={"Accept": "application/json", "User-Agent": USER_AGENT},
            )
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = json.loads(resp.read())
            return data["results"]["bindings"]
        except Exception as exc:  # noqa: BLE001 — third-party transient errors
            last_exc = exc
            backoff = 2 ** attempt
            print(f"  ! Wikidata SPARQL attempt {attempt + 1}/{RETRIES} failed: {exc} (retry in {backoff}s)")
            time.sleep(backoff)
    raise RuntimeError(f"Wikidata SPARQL failed after {RETRIES} retries: {last_exc}")


def _qid_from_iri(iri: str) -> str | None:
    m = re.search(r"/(Q\d+)$", iri)
    return m.group(1) if m else None


def fetch_photo_urls(qids: list[str]) -> dict[str, str]:
    """Batch-fetch P18 image URLs for a list of QIDs via SPARQL."""
    if not qids:
        return {}
    values = " ".join(f"wd:{qid}" for qid in qids)
    query = f"""
    SELECT ?person ?photo WHERE {{
      VALUES ?person {{ {values} }}
      OPTIONAL {{ ?person wdt:P18 ?photo }}
    }}
    """
    rows = _fetch_sparql(query)
    result: dict[str, str] = {}
    for row in rows:
        qid = _qid_from_iri(row.get("person", {}).get("value", ""))
        photo = row.get("photo", {}).get("value", "")
        if qid and photo:
            result[qid] = photo.replace("http://", "https://")
    return result


def run(dry_run: bool) -> int:
    conn = get_pg_conn()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT id, full_name, wikidata_qid
        FROM public_officials
        WHERE wikidata_qid IS NOT NULL AND photo_url IS NULL
        """
    )
    rows = cur.fetchall()
    if not rows:
        print("public_officials: no pending photo fetches")
        cur.close()
        conn.close()
        return 0

    qids = [r[2] for r in rows]
    print(f"[wikidata] fetching P18 photo claims for {len(qids)} officials...")
    photo_urls = fetch_photo_urls(qids)

    updated = 0
    for official_id, full_name, qid in rows:
        photo_url = photo_urls.get(qid)
        if not photo_url:
            print(f"[wikidata] {full_name}: no P18 photo on Wikidata")
            continue

        if dry_run:
            print(f"[wikidata] {full_name}: would fetch {photo_url}")
            updated += 1
            continue

        try:
            downloaded = download_with_final_url(photo_url, user_agent=USER_AGENT)
            variants = build_responsive_variants(downloaded.data)
        except PhotoValidationError as exc:
            print(f"[wikidata] {full_name}: download/validate failed: {exc}")
            continue

        content_hash = sha256_hex(variants[max(variants)])
        slug = slugify(full_name)
        variant_urls: dict[str, str] = {}
        for size, data in sorted(variants.items()):
            key = public_official_variant_key(slug, content_hash, size)
            variant_urls[str(size)] = upload_photo(data, key)

        primary_url = variant_urls.get("256") or variant_urls[str(max(variants))]

        cur.execute(
            """
            UPDATE public_officials
            SET photo_url = %s,
                photo_variants = %s::jsonb,
                photo_source = 'wikidata',
                updated_at = now()
            WHERE id = %s
            """,
            (primary_url, json.dumps(variant_urls), official_id),
        )
        print(f"[wikidata] {full_name}: uploaded {len(variant_urls)} variants")
        updated += 1

    if not dry_run:
        conn.commit()
    cur.close()
    conn.close()
    return updated


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch Wikidata photos for public_officials")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    updated = run(args.dry_run)
    print(f"public_officials: {updated} photo(s) {'would be ' if args.dry_run else ''}updated")


if __name__ == "__main__":
    main()
