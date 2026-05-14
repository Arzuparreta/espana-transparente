"""Alcaldes (mayors) source: Wikidata SPARQL filtered to people holding P39 'mayor of X'.

Only runs for politicians whose responsibility_positions include 'alcalde'. Uses
a more relaxed name-matching threshold (Jaccard ≥0.55, ≥2 shared tokens) than
the global WikidataSource because:
  - the candidate set is much smaller (a few thousand mayors of Spain, not
    every Spanish public figure with a photo)
  - false positives are constrained by also requiring the person to be a mayor
"""

import re
import time
import unicodedata
from typing import Optional

from ..validate import PhotoValidationError, download_with_final_url, to_webp_square
from .base import PhotoSource, PoliticianRow, SourceMatch
from .wikidata import SPARQL_URL, USER_AGENT, _fetch_sparql, _normalize, _jaccard, _qid_from_iri

# Q30185 = mayor. P39 = position held; the office is itself an instance of
# 'mayor' so we can fetch every Spanish mayor in one query.
SPARQL_QUERY = """
SELECT DISTINCT ?person ?personLabel ?photo WHERE {
  ?person wdt:P27 wd:Q29 .
  ?person wdt:P18 ?photo .
  ?person wdt:P39 ?pos .
  ?pos wdt:P279* wd:Q30185 .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en" . }
}
"""


class AlcaldesWikidataSource:
    name = "alcaldes_wikidata"
    priority = 3

    MIN_JACCARD = 0.55
    MIN_SHARED_TOKENS = 2

    def __init__(self) -> None:
        self._index: Optional[list[dict]] = None

    def _ensure_index(self) -> None:
        if self._index is not None:
            return
        print("[alcaldes_wikidata] fetching SPARQL index (Spanish mayors with photos)...")
        rows = _fetch_sparql(SPARQL_QUERY)
        entries: list[dict] = []
        for b in rows:
            person_iri = b.get("person", {}).get("value", "")
            qid = _qid_from_iri(person_iri)
            label = b.get("personLabel", {}).get("value", "")
            photo = b.get("photo", {}).get("value", "").replace("http://", "https://")
            if not (qid and label and photo):
                continue
            entries.append({
                "qid": qid,
                "label": label,
                "tokens": _normalize(label),
                "photo": photo,
            })
        self._index = entries
        print(f"[alcaldes_wikidata] index ready: {len(entries)} entries")

    def find(self, politician: PoliticianRow) -> Optional[SourceMatch]:
        if "alcalde" not in politician.position_types:
            return None

        self._ensure_index()

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

        if not best_entry or best_score < self.MIN_JACCARD:
            return None

        print(f"[alcaldes_wikidata] {politician.full_name}: matched "
              f"(jaccard={best_score:.2f} → {best_entry['qid']} '{best_entry['label']}')")

        try:
            downloaded = download_with_final_url(best_entry["photo"], user_agent=USER_AGENT)
            normalized = to_webp_square(downloaded.data)
        except PhotoValidationError as exc:
            print(f"[alcaldes_wikidata] {politician.full_name}: download/validate failed: {exc}")
            return None

        return SourceMatch(
            photo_bytes=normalized,
            source=self.name,
            wikidata_qid=best_entry["qid"],
            source_url=downloaded.final_url,
        )
