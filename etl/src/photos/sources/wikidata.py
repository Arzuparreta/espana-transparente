"""Wikidata source: maps Spanish politicians to Wikimedia Commons photos.

Strategy:
  1. Bulk-load all Spanish politicians (P27=Q29, P106=político/diputado/senador/…)
     that have a P18 image. Capture P1768 (Congress ID) when present.
  2. For each politician row:
       a. If cod_parlamentario matches a P1768 → exact match.
       b. Else: token-Jaccard match on `personLabel` (≥0.6 + ≥2 shared tokens).

The previous fotos.py used Jaccard ≥0.5 with no QID anchor — that produced
false positives. P1768 fixes most ambiguity.
"""

import json
import re
import time
import unicodedata
import urllib.parse
import urllib.request
from typing import Optional

from ..validate import to_webp_square, download_with_final_url, PhotoValidationError
from .base import PhotoSource, PoliticianRow, SourceMatch

SPARQL_URL = "https://query.wikidata.org/sparql"

# P106 occupations that cover deputies, senators, ministers, mayors, autonomic MPs.
# Wide on purpose: we filter further client-side by name/QID/cod_parlamentario.
SPARQL_QUERY = """
SELECT DISTINCT ?person ?personLabel ?photo ?congressId WHERE {
  ?person wdt:P27 wd:Q29 .
  ?person wdt:P18 ?photo .
  OPTIONAL { ?person wdt:P1768 ?congressId }
  {
    VALUES ?occ {
      wd:Q82955    # politician
      wd:Q1930187  # diputado (member of parliament)
      wd:Q486839   # member of a national parliament
      wd:Q4175034  # senator of Spain
      wd:Q83307    # minister
      wd:Q30185    # mayor
    }
    ?person wdt:P106 ?occ .
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en" . }
}
"""

USER_AGENT = "EspanaTransparente/1.0 (transparency portal; rubenpenarubio02@gmail.com)"
RETRIES = 3


def _normalize(name: str) -> frozenset[str]:
    nfkd = unicodedata.normalize("NFKD", name.lower())
    ascii_name = "".join(c for c in nfkd if not unicodedata.combining(c))
    tokens = re.findall(r"[a-z]+", ascii_name)
    return frozenset(t for t in tokens if len(t) > 1)


def _jaccard(a: frozenset, b: frozenset) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def _qid_from_iri(iri: str) -> Optional[str]:
    m = re.search(r"/(Q\d+)$", iri)
    return m.group(1) if m else None


def _fetch_sparql(query: str) -> list[dict]:
    last_exc: Optional[Exception] = None
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


class WikidataSource:
    name = "wikidata"
    priority = 2

    # Lower threshold = more false positives. 0.6 + 2-shared-token guard works well
    # because Spanish full names are 3–4 tokens after dropping particles.
    MIN_JACCARD = 0.6
    MIN_SHARED_TOKENS = 2

    def __init__(self) -> None:
        self._index: Optional[list[dict]] = None
        self._by_congress_id: dict[str, dict] = {}

    def _ensure_index(self) -> None:
        if self._index is not None:
            return
        print("[wikidata] fetching SPARQL index (Spanish politicians with photos)...")
        rows = _fetch_sparql(SPARQL_QUERY)
        entries: list[dict] = []
        for b in rows:
            person_iri = b.get("person", {}).get("value", "")
            qid = _qid_from_iri(person_iri)
            label = b.get("personLabel", {}).get("value", "")
            photo = b.get("photo", {}).get("value", "").replace("http://", "https://")
            cong = b.get("congressId", {}).get("value")
            if not (qid and label and photo):
                continue
            entry = {
                "qid": qid,
                "label": label,
                "tokens": _normalize(label),
                "photo": photo,
                "congress_id": cong,
            }
            entries.append(entry)
            if cong:
                # Some Wikidata entries have multiple P1768 statements — last wins.
                self._by_congress_id[cong] = entry
        self._index = entries
        print(f"[wikidata] index ready: {len(entries)} entries "
              f"({len(self._by_congress_id)} with P1768 cod_parlamentario)")

    def find(self, politician: PoliticianRow) -> Optional[SourceMatch]:
        self._ensure_index()

        # 1. Exact match by cod_parlamentario (P1768).
        entry = None
        if politician.cod_parlamentario:
            entry = self._by_congress_id.get(politician.cod_parlamentario)
            if entry:
                print(f"[wikidata] {politician.full_name}: matched by cod_parlamentario "
                      f"({politician.cod_parlamentario} → {entry['qid']})")

        # 2. Fallback: token Jaccard on name.
        if entry is None:
            pol_tokens = _normalize(politician.full_name)
            best_score = 0.0
            best_entry = None
            for candidate in self._index or []:
                shared = pol_tokens & candidate["tokens"]
                if len(shared) < self.MIN_SHARED_TOKENS:
                    continue
                score = _jaccard(pol_tokens, candidate["tokens"])
                if score > best_score:
                    best_score = score
                    best_entry = candidate
            if best_entry and best_score >= self.MIN_JACCARD:
                entry = best_entry
                print(f"[wikidata] {politician.full_name}: matched by name "
                      f"(jaccard={best_score:.2f} → {entry['qid']} '{entry['label']}')")

        if entry is None:
            return None

        try:
            downloaded = download_with_final_url(entry["photo"], user_agent=USER_AGENT)
            normalized = to_webp_square(downloaded.data)
        except PhotoValidationError as exc:
            print(f"[wikidata] {politician.full_name}: download/validate failed: {exc}")
            return None

        return SourceMatch(
            photo_bytes=normalized,
            source=self.name,
            wikidata_qid=entry["qid"],
            source_url=downloaded.final_url,
            source_etag=downloaded.etag,
            source_last_modified=downloaded.last_modified,
        )
