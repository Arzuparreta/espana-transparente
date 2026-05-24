"""Wikipedia corruption-case scraper.

Ingests the curated annex of Spanish political corruption cases from Wikipedia
and enriches with structured data from individual case pages.

Sources:
  - https://es.wikipedia.org/wiki/Anexo:Casos_judiciales_relacionados_con_corrupci%C3%B3n_pol%C3%ADtica_en_Espa%C3%B1a
  - Individual case pages (via Wikipedia API extracts)

Usage:
    PYTHONPATH=src python -m src.judicial.wikipedia --dry-run
    PYTHONPATH=src python -m src.judicial.wikipedia --resume
    PYTHONPATH=src python -m src.judicial.wikipedia --dry-run --max-cases 5
"""

from __future__ import annotations

import argparse
import re
import time
from dataclasses import dataclass, field
from datetime import date
from hashlib import sha256
from typing import Any
from urllib.parse import unquote, urljoin

import httpx
import psycopg2.extras
from bs4 import BeautifulSoup, Tag

from common.db import get_pg_conn
from common.etl_runs import finish_run, start_run

WIKIPEDIA_ANNEX_URL = (
    "https://es.wikipedia.org/wiki/"
    "Anexo:Casos_judiciales_relacionados_con_corrupci%C3%B3n_pol%C3%ADtica_en_Espa%C3%B1a"
)

WIKIPEDIA_API_URL = "https://es.wikipedia.org/w/api.php"

USER_AGENT = (
    "EspanaTransparente/0.1 "
    "(https://github.com/Arzuparreta/espana-transparente; "
    "non-commercial transparency project)"
)

# Wikipedia policy: be conservative with rate limiting
REQUEST_DELAY = 1.0  # seconds between requests to respect Wikipedia's guidelines

# Section heading keywords that indicate a list of defendants/actors
ACTOR_SECTION_KEYWORDS = [
    "imputado", "imputados",
    "acusado", "acusados",
    "condenado", "condenados",
    "procesado", "procesados",
    "encausado", "encausados",
    "investigado", "investigados",
    "implicado", "implicados",
    "personas implicadas",
    "personas condenadas",
    "personas procesadas",
    "lista de imputados",
    "lista de acusados",
    "lista de condenados",
    "partes implicadas",
]

STATUS_VALUES = {
    "procesamiento_o_juicio_oral",
    "condena_no_firme",
    "condena_firme",
    "absuelto",
    "sobreseido",
    "desconocido",
}


@dataclass(frozen=True)
class WikiCase:
    """A corruption case extracted from the Wikipedia annex table."""
    title: str
    source_url: str
    external_id: str
    organizations_text: str | None
    territory: str | None
    start_year: str | None
    process_start: str | None
    sentence_date: str | None
    sentence_type: str | None
    crimes: str | None
    wiki_page_url: str | None = None
    source_name: str = "Wikipedia"
    source_type: str = "wikipedia"
    court_body: str | None = None
    procedural_status: str = "desconocido"
    summary: str | None = None
    last_verified_at: date = field(default_factory=date.today)
    raw_data: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class WikiActor:
    """A person or organization extracted from a case page."""
    case_external_id: str
    actor_label: str
    actor_type: str = "unknown"  # person, organization, unknown
    role: str | None = None
    evidence_url: str | None = None


def clean_text(value: str | None) -> str | None:
    """Clean and normalize text extracted from Wikipedia."""
    if not value:
        return None
    text = re.sub(r"\[\d+\]", "", value)  # remove footnote references [1], [2], etc.
    text = re.sub(r"\s+", " ", text).strip()
    if not text or text.lower() in {"—", "-", "―", "n/a", "?"}:
        return None
    return text


def stable_external_id(case_title: str) -> str:
    """Generate a stable external_id from the case title."""
    normalized = case_title.strip().lower()
    digest = sha256(normalized.encode("utf-8")).hexdigest()
    return f"wiki-{digest[:16]}"


def map_sentence_status(sentence_type: str | None, sentence_date: str | None) -> str:
    """Map Wikipedia sentence type to our procedural_status vocabulary."""
    if not sentence_type:
        return "desconocido"
    st = sentence_type.strip().lower()
    if "absolutoria" in st or "absuelto" in st:
        return "absuelto"
    if "condenatoria" in st or "condena" in st:
        if sentence_date and clean_text(sentence_date):
            return "condena_firme" if "firme" in st else "condena_no_firme"
        return "condena_no_firme"
    if "sobrese" in st or "archivo" in st:
        return "sobreseido"
    if "juicio oral" in st or "procesamiento" in st:
        return "procesamiento_o_juicio_oral"
    return "desconocido"


def parse_annex_table(html: str) -> list[WikiCase]:
    """Parse the Wikipedia annex table into WikiCase objects."""
    soup = BeautifulSoup(html, "html.parser")
    table = soup.find("table", class_="wikitable")
    if not table or not isinstance(table, Tag):
        raise RuntimeError("No wikitable found on annex page")

    headers = []
    header_row = table.find("tr")
    if header_row:
        for th in header_row.find_all("th"):
            headers.append(th.get_text(strip=True).lower())

    cases: list[WikiCase] = []
    for row in table.find_all("tr")[1:]:  # skip header
        cells = row.find_all("td")
        if len(cells) < 6:
            continue

        col = lambda i: cells[i].get_text(" ", strip=True) if i < len(cells) else ""

        case_name_raw = col(0)
        if not case_name_raw.strip():
            continue

        # Build url if the case name has a link
        case_link = cells[0].find("a")
        wiki_page_url = None
        if case_link and case_link.get("href"):
            wiki_page_url = urljoin("https://es.wikipedia.org", case_link["href"])
            # Skip if it just points back to the annex
            if "Casos_judiciales_relacionados" in (wiki_page_url or ""):
                wiki_page_url = None

        case_name = clean_text(case_name_raw) or case_name_raw.strip()
        # Remove footnote markers (e.g. "Caso 3% [ 3 ]" -> "Caso 3%")
        # Wikipedia renders footnotes with spaces inside brackets
        case_name = re.sub(r"\s*\[\s*\d+\s*\]", "", case_name).strip()
        # Clean up any double spaces created by removal
        case_name = re.sub(r"\s+", " ", case_name).strip()
        organizations_text = clean_text(col(1))
        territory = clean_text(col(3))
        start_year = clean_text(col(4))
        process_start = clean_text(col(5))
        sentence_date = clean_text(col(6))
        sentence_type = clean_text(col(7))
        crimes = clean_text(col(8))

        external_id = stable_external_id(case_name)
        status = map_sentence_status(sentence_type, sentence_date)

        source_url = WIKIPEDIA_ANNEX_URL

        cases.append(WikiCase(
            title=case_name[:500],
            source_url=source_url,
            external_id=external_id,
            organizations_text=organizations_text,
            territory=territory,
            start_year=start_year,
            process_start=process_start,
            sentence_date=sentence_date,
            sentence_type=sentence_type,
            crimes=crimes,
            wiki_page_url=wiki_page_url,
            procedural_status=status,
            summary=crimes,
            raw_data={
                "organizations_text": organizations_text,
                "start_year": start_year,
                "process_start": process_start,
                "sentence_date": sentence_date,
                "sentence_type": sentence_type,
            },
        ))

    return cases


def fetch_annex_cases(client: httpx.Client) -> list[WikiCase]:
    """Fetch and parse the Wikipedia annex page."""
    resp = client.get(WIKIPEDIA_ANNEX_URL)
    resp.raise_for_status()
    time.sleep(REQUEST_DELAY)
    return parse_annex_table(resp.text)


def build_organization_actors(case: WikiCase) -> list[WikiActor]:
    """Create actor entries for organizations mentioned in the annex table.

    The annex's 'Organizaciones implicadas' column lists political parties
    and organizations. We split on common delimiters and create an actor
    entry for each.
    """
    if not case.organizations_text:
        return []

    actors: list[WikiActor] = []
    # Split on common delimiters: commas, "y", "/", " e "
    parts = re.split(r",|\s+y\s+|\s+e\s+|/|;", case.organizations_text)
    seen: set[str] = set()
    for part in parts:
        name = clean_text(part)
        if not name or len(name) < 3:
            continue
        name_lower = name.lower()
        # Skip generic terms that aren't specific organizations
        if name_lower in ("varios", "otros", "etc", "partidos políticos", "diversos"):
            continue
        if name_lower in seen:
            continue
        seen.add(name_lower)
        actors.append(WikiActor(
            case_external_id=case.external_id,
            actor_label=name,
            actor_type="organization",
            role="implicated",
            evidence_url=case.wiki_page_url or case.source_url,
        ))
    return actors


def extract_page_title_from_url(url: str) -> str | None:
    """Extract Wikipedia page title from a URL like /wiki/Caso_Gürtel."""
    if "/wiki/" in url:
        title = url.split("/wiki/")[-1].split("?")[0].split("#")[0]
        return unquote(title)
    return None


def upsert_cases(cur, cases: list[WikiCase]) -> int:
    """Upsert corruption cases into the database."""
    count = 0
    for case in cases:
        cur.execute(
            """
            INSERT INTO corruption_cases (
              source_type, source_name, external_id, title, court_body, territory,
              offence_category, procedural_status, procedure_type, summary,
              source_url, source_published_at, last_verified_at, raw_data
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (source_type, external_id) WHERE external_id IS NOT NULL
            DO UPDATE SET
              title = EXCLUDED.title,
              court_body = EXCLUDED.court_body,
              territory = EXCLUDED.territory,
              offence_category = EXCLUDED.offence_category,
              procedural_status = EXCLUDED.procedural_status,
              procedure_type = EXCLUDED.procedure_type,
              summary = EXCLUDED.summary,
              source_url = EXCLUDED.source_url,
              source_published_at = EXCLUDED.source_published_at,
              last_verified_at = EXCLUDED.last_verified_at,
              raw_data = EXCLUDED.raw_data,
              updated_at = now()
            """,
            (
                case.source_type,
                case.source_name,
                case.external_id,
                case.title,
                case.court_body,
                case.territory,
                case.crimes,
                case.procedural_status,
                case.sentence_type,
                case.summary,
                case.source_url,
                None,
                case.last_verified_at,
                psycopg2.extras.Json(case.raw_data),
            ),
        )
        count += 1
    return count


def upsert_actors(cur, actors: list[WikiActor], case_external_id: str) -> int:
    """Upsert case actors. Uses (case_id, actor_label) for dedup.

    All actors from Wikipedia enter as 'needs_review' — they won't be publicly
    visible until reviewed via judicial.review.
    """
    count = 0
    for actor in actors:
        # Get case UUID from external_id
        cur.execute(
            "SELECT id FROM corruption_cases WHERE source_type = 'wikipedia' AND external_id = %s",
            (case_external_id,),
        )
        case_row = cur.fetchone()
        if not case_row:
            continue
        case_id = case_row[0]

        # Try fuzzy match against organizations
        if actor.actor_type in ("organization", "unknown"):
            cur.execute(
                """
                SELECT id FROM organizations
                WHERE SIMILARITY(LOWER(name), LOWER(%s)) >= 0.85
                LIMIT 1
                """,
                (actor.actor_label,),
            )
            org_row = cur.fetchone()
            org_id = org_row[0] if org_row else None
        else:
            org_id = None

        cur.execute(
            """
            INSERT INTO corruption_case_actors (
              case_id, actor_type, actor_label, role,
              politician_id, organization_id,
              match_confidence, match_method,
              review_status, evidence_url, raw_data
            )
            VALUES (%s, %s, %s, %s, NULL, %s, %s, %s, 'needs_review', %s, %s)
            ON CONFLICT DO NOTHING
            """,
            (
                case_id,
                actor.actor_type,
                actor.actor_label,
                actor.role,
                org_id,
                0.85 if org_id else None,
                "fuzzy_name" if org_id else None,
                actor.evidence_url,
                psycopg2.extras.Json({}),
            ),
        )
        if cur.rowcount > 0:
            count += 1
    return count


def run(
    dry_run: bool = False,
    max_cases: int = 0,
    skip_actors: bool = False,
) -> tuple[int, int]:
    """Main ETL run.

    Returns (cases_parsed, actors_inserted).
    """
    with httpx.Client(
        timeout=45.0,
        follow_redirects=True,
        headers={"User-Agent": USER_AGENT},
    ) as client:
        # 1. Fetch annex table
        print(f"Fetching Wikipedia annex: {WIKIPEDIA_ANNEX_URL}")
        cases = fetch_annex_cases(client)
        print(f"Parsed {len(cases)} cases from annex table")

        if max_cases > 0:
            cases = cases[:max_cases]
            print(f"Limited to {len(cases)} cases (--max-cases={max_cases})")

        if dry_run:
            print(f"\n[DRY-RUN] Would ingest {len(cases)} cases:")
            for case in cases[:20]:
                print(f"  {case.procedural_status:20s} | {case.title[:80]}")
                if case.organizations_text:
                    print(f"    Orgs: {case.organizations_text[:100]}")
            return len(cases), 0

        # 2. Upsert cases
        conn = get_pg_conn()
        run_id = None
        try:
            with conn.cursor() as cur:
                run_id = start_run(cur, pipeline="judicial.wikipedia", chunk_key="annex")
                case_count = upsert_cases(cur, cases)
                finish_run(
                    cur, run_id=run_id, status="succeeded",
                    rows_read=len(cases), rows_updated=case_count,
                )
                conn.commit()
            print(f"Upserted {case_count} cases")

            # 3. Build organization actors from annex data
            if not skip_actors:
                actor_count = 0
                for case in cases:
                    actors = build_organization_actors(case)
                    if actors:
                        with conn.cursor() as cur:
                            added = upsert_actors(cur, actors, case.external_id)
                            conn.commit()
                            actor_count += added
                print(f"Organization actors added: {actor_count}")
                return case_count, actor_count

            return case_count, 0

        except Exception as exc:
            conn.rollback()
            if run_id:
                with conn.cursor() as cur:
                    finish_run(
                        cur, run_id=run_id, status="failed",
                        rows_read=len(cases),
                        error_summary=str(exc)[:500],
                    )
                    conn.commit()
            raise
        finally:
            conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Ingest Spanish corruption cases from Wikipedia"
    )
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--max-cases", type=int, default=0,
        help="Limit number of cases to scrape (0 = all)"
    )
    parser.add_argument(
        "--skip-actors", action="store_true",
        help="Only ingest cases, skip actor extraction from individual pages"
    )
    parser.add_argument(
        "--resume", action="store_true",
        help="Accepted for scheduler compatibility; upserts are idempotent."
    )
    args = parser.parse_args()
    cases_count, actors_count = run(
        dry_run=args.dry_run,
        max_cases=args.max_cases,
        skip_actors=args.skip_actors,
    )
    if not args.dry_run:
        print(f"\nDone. Cases: {cases_count}, Actors: {actors_count}")


if __name__ == "__main__":
    main()
