"""ETL: ingest legislative initiatives from Congreso Open Data.

The Congreso publishes initiative datasets as JSON under:
    https://www.congreso.es/webpublica/opendata/iniciativas/

Usage:
    PYTHONPATH=src python -m src.congreso.iniciativas --dry-run
    PYTHONPATH=src python -m src.congreso.iniciativas
"""

from __future__ import annotations

import argparse
import html
import json
import re
import subprocess
import time
import unicodedata
from datetime import datetime, timezone
from typing import Any

import psycopg2.extras

from common.db import get_pg_conn
from common.etl_runs import finish_run, start_run
from common.utils import normalize_name, search_display_name

CONGRESO_BASE = "https://www.congreso.es"
OPENDATA_PAGE = f"{CONGRESO_BASE}/es/opendata/iniciativas"
UA = "Mozilla/5.0 (compatible; AccionHumana/1.0)"
REQUEST_DELAY = 1.5  # Congress rate-limits; keep this aligned with CLAUDE.md.

INGESTED_DATASETS = {
    "ProyectosDeLey",
    "ProposicionesDeLey",
    "PropuestasDeReforma",
}

DATASET_LINK_RE = re.compile(
    r"(?P<path>/webpublica/opendata/iniciativas/"
    r"(?P<dataset>[A-Za-z0-9_]+)__\d+\.json)"
)

GROUP_PARTY_ACRONYMS = {
    "grupo parlamentario popular en el congreso": "PP",
    "grupo parlamentario socialista": "PSOE",
    "grupo parlamentario vox": "VOX",
    "grupo parlamentario plurinacional sumar": "SUMAR",
    "grupo parlamentario republicano": "ERC",
    "grupo parlamentario vasco eaj pnv": "EAJ-PNV",
    "grupo parlamentario junts per catalunya": "JUNTS",
    "grupo parlamentario euskal herria bildu": "EH Bildu",
}

PERSON_GROUP_ACRONYMS = {
    "GR": "ERC",
    "GSUMAR": "SUMAR",
    "GEH Bildu": "EH Bildu",
    "GV (EAJ-PNV)": "EAJ-PNV",
}


def curl_text(url: str) -> str:
    result = subprocess.run(
        ["curl", "-sS", "-L", "--max-time", "45", "-H", f"User-Agent: {UA}", url],
        capture_output=True,
        text=True,
        timeout=50,
    )
    if result.returncode != 0:
        raise RuntimeError(f"curl failed for {url}: {result.stderr.strip()}")
    return result.stdout


def collapse_ws(value: Any) -> str | None:
    if value is None:
        return None
    text = re.sub(r"\s+", " ", str(value)).strip()
    return text or None


def strip_accents(value: str) -> str:
    return "".join(
        char for char in unicodedata.normalize("NFKD", value)
        if not unicodedata.combining(char)
    )


def slugify(value: str | None) -> str | None:
    text = collapse_ws(value)
    if not text:
        return None
    text = strip_accents(text).lower()
    text = re.sub(r"[^a-z0-9]+", "_", text).strip("_")
    return text or None


def normalize_author_key(value: str | None) -> str:
    text = collapse_ws(value) or ""
    text = strip_accents(text).lower()
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def clean_group_code(value: str | None) -> str | None:
    text = collapse_ws(value)
    if not text:
        return None
    return text.strip()


def is_person_author(label: str) -> bool:
    if "," not in label:
        return False
    lowered = normalize_author_key(label)
    if lowered.startswith(("grupo parlamentario", "comunidad autonoma", "comision ")):
        return False
    return bool(re.match(r"^[^,]{2,80},\s*[^,]{2,80}", label))


def parse_person_author(label: str) -> tuple[str, str | None] | None:
    group_code = None
    name_part = label.strip()
    match = re.match(r"^(?P<name>.+?)\s+\((?P<group>.+)\)$", name_part)
    if match:
        name_part = match.group("name").strip()
        group_code = clean_group_code(match.group("group"))

    if not is_person_author(name_part):
        return None

    surnames, first = name_part.split(",", 1)
    official_name = f"{surnames.strip()}, {first.strip()}"
    return official_name, group_code


def split_author_entries(author: str | None) -> list[dict[str, Any]]:
    """Split Congreso's AUTOR field into factual proposer entries.

    Current Congreso Open Data mostly publishes groups or institutions, but a
    few initiatives publish individual signers as one person per line.
    """
    text = collapse_ws(author.replace("\r", "\n")) if author else None
    if not text:
        return []

    raw_parts = [
        collapse_ws(part)
        for part in re.split(r"\n+| {2,}", author.replace("\r", "\n"))
    ]
    parts = [part for part in raw_parts if part]

    if len(parts) <= 1:
        parts = [text]

    proposers: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    for part in parts:
        parsed_person = parse_person_author(part)
        if parsed_person:
            label, group_code = parsed_person
            role = "firmante"
            kind = "person"
        else:
            label = part.strip()
            group_code = None
            kind = "group" if normalize_author_key(label).startswith("grupo parlamentario") else "organization"
            role = "grupo_proponente" if kind == "group" else "organismo_proponente"

        key = (label.casefold(), role)
        if key in seen:
            continue
        seen.add(key)
        proposers.append({
            "label": label,
            "role": role,
            "kind": kind,
            "group_code": group_code,
        })
    return proposers


def parse_legislature_number(value: str | None) -> int | None:
    if not value:
        return None
    match = re.search(r"\d+", value)
    return int(match.group(0)) if match else None


def parse_spanish_date(value: str | None) -> str | None:
    text = collapse_ws(value)
    if not text:
        return None
    match = re.fullmatch(r"(\d{1,2})/(\d{1,2})/(\d{4})", text)
    if match:
        day, month, year = match.groups()
        return f"{year}-{int(month):02d}-{int(day):02d}"
    match = re.fullmatch(r"(\d{4})-(\d{1,2})-(\d{1,2})", text)
    if match:
        year, month, day = match.groups()
        return f"{year}-{int(month):02d}-{int(day):02d}"
    return None


def initiative_type_slug(record_type: str | None, dataset: str) -> str:
    normalized = strip_accents(collapse_ws(record_type) or "").lower()
    if "proyecto de ley" in normalized:
        return "proyecto_ley"
    if "proposicion de ley" in normalized:
        return "proposicion_ley"
    if "propuesta" in normalized and "reforma" in normalized:
        return "propuesta_reforma_estatuto"

    by_dataset = {
        "ProyectosDeLey": "proyecto_ley",
        "ProposicionesDeLey": "proposicion_ley",
        "PropuestasDeReforma": "propuesta_reforma_estatuto",
    }
    return by_dataset.get(dataset) or slugify(record_type) or slugify(dataset) or "iniciativa"


def status_slug(situation: str | None, result: str | None) -> str:
    combined = strip_accents(" ".join(filter(None, [
        collapse_ws(result),
        collapse_ws(situation),
    ]))).lower()

    if any(token in combined for token in ("aprobado", "aprobada")):
        return "aprobada"
    if any(token in combined for token in ("rechazado", "rechazada", "inadmitido", "inadmitida")):
        return "rechazada"
    if any(token in combined for token in ("retirado", "retirada")):
        return "retirada"
    if any(token in combined for token in ("caducado", "caducada", "decaido", "decaida")):
        return "caducada"
    if "cerrado" in combined or "cerrada" in combined:
        return "cerrada"
    return "en_tramitacion"


def detail_id(number: str) -> str:
    parts = number.split("/")
    if len(parts) == 3 and parts[-1] == "0000":
        return "/".join(parts[:2])
    return number


def detail_url(number: str, legislature_number: int | None) -> str:
    legislature = f"{legislature_number}" if legislature_number is not None else "15"
    return (
        f"{CONGRESO_BASE}/es/busqueda-de-iniciativas"
        "?p_p_id=iniciativas&p_p_lifecycle=0&p_p_state=normal&p_p_mode=view"
        "&_iniciativas_mode=mostrarDetalle"
        f"&_iniciativas_legislatura={legislature}"
        f"&_iniciativas_id={detail_id(number)}"
    )


def discover_sources(html_text: str) -> list[dict[str, str]]:
    decoded = html.unescape(html_text)
    sources: dict[str, dict[str, str]] = {}
    for match in DATASET_LINK_RE.finditer(decoded):
        dataset = match.group("dataset")
        if dataset not in INGESTED_DATASETS:
            continue
        path = match.group("path")
        sources[dataset] = {
            "dataset": dataset,
            "url": f"{CONGRESO_BASE}{path}",
        }
    return sorted(sources.values(), key=lambda item: item["dataset"])


def discover_current_sources() -> list[dict[str, str]]:
    sources = discover_sources(curl_text(OPENDATA_PAGE))
    if not sources:
        raise RuntimeError(f"No initiative JSON links found at {OPENDATA_PAGE}")
    return sources


def fetch_json_records(url: str) -> list[dict[str, Any]]:
    payload = curl_text(url)
    data = json.loads(payload)
    if not isinstance(data, list):
        raise RuntimeError(f"Expected a JSON list from {url}")
    return [row for row in data if isinstance(row, dict)]


def parse_record(record: dict[str, Any], *, dataset: str, dataset_url: str) -> dict[str, Any] | None:
    number = collapse_ws(record.get("NUMEXPEDIENTE"))
    title = collapse_ws(record.get("OBJETO"))
    if not number or not title:
        return None

    legislature_number = parse_legislature_number(collapse_ws(record.get("LEGISLATURA")))
    fetched_at = datetime.now(timezone.utc).isoformat()
    presentation_date = parse_spanish_date(collapse_ws(record.get("FECHAPRESENTACION")))
    qualification_date = parse_spanish_date(collapse_ws(record.get("FECHACALIFICACION")))
    author_text = record.get("AUTOR")

    return {
        "legislature_number": legislature_number or 15,
        "type": initiative_type_slug(collapse_ws(record.get("TIPO")), dataset),
        "number": number,
        "title": title,
        "proposer_group": collapse_ws(author_text),
        "proposers": split_author_entries(author_text),
        "status": status_slug(record.get("SITUACIONACTUAL"), record.get("RESULTADOTRAMITACION")),
        "source_url": detail_url(number, legislature_number),
        "raw_data": {
            "source": "congreso_opendata_iniciativas",
            "dataset": dataset,
            "dataset_url": dataset_url,
            "fetched_at": fetched_at,
            "presentation_date": presentation_date,
            "qualification_date": qualification_date,
            "official": record,
        },
    }


def load_legislatures(cur) -> dict[int, str]:
    cur.execute("SELECT number, id FROM legislatures")
    return {int(number): leg_id for number, leg_id in cur.fetchall()}


def load_politician_index(cur) -> dict[str, str]:
    cur.execute("SELECT id, full_name FROM politicians")
    index: dict[str, str] = {}
    for politician_id, full_name in cur.fetchall():
        for candidate in (full_name, search_display_name(full_name)):
            key = normalize_name(candidate)
            if key:
                index[key] = politician_id
    return index


def match_party(cur, label: str, group_code: str | None = None) -> tuple[str | None, float | None, str | None]:
    acronym = PERSON_GROUP_ACRONYMS.get(group_code or "")
    normalized = normalize_author_key(label)
    if not acronym:
        acronym = GROUP_PARTY_ACRONYMS.get(normalized)

    if acronym:
        cur.execute(
            """
            SELECT id
            FROM parties
            WHERE lower(acronym) = lower(%s)
            LIMIT 1
            """,
            (acronym,),
        )
        row = cur.fetchone()
        if row:
            return row[0], 1.0, "official_group_acronym"

    cur.execute(
        """
        SELECT id
        FROM parties
        WHERE lower(name) = lower(%s)
           OR lower(acronym) = lower(%s)
        LIMIT 1
        """,
        (label, label),
    )
    row = cur.fetchone()
    if row:
        return row[0], 1.0, "official_party_label"

    return None, None, None


def upsert_initiative(cur, row: dict[str, Any], legislature_id: str) -> tuple[str, str]:
    cur.execute(
        """
        SELECT id
        FROM initiatives
        WHERE legislature_id = %s AND number = %s
        ORDER BY created_at DESC
        LIMIT 1
        """,
        (legislature_id, row["number"]),
    )
    existing = cur.fetchone()
    payload = (
        row["type"],
        row["title"],
        row["proposer_group"],
        row["status"],
        psycopg2.extras.Json(row["raw_data"]),
        row["source_url"],
    )
    if existing:
        cur.execute(
            """
            UPDATE initiatives
            SET type = %s,
                title = %s,
                proposer_group = %s,
                status = %s,
                raw_data = %s,
                source_url = %s
            WHERE id = %s
            """,
            (*payload, existing[0]),
        )
        return existing[0], "updated"

    cur.execute(
        """
        INSERT INTO initiatives
            (legislature_id, type, number, title, proposer_group, status, raw_data, source_url)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id
        """,
        (
            legislature_id,
            row["type"],
            row["number"],
            row["title"],
            row["proposer_group"],
            row["status"],
            psycopg2.extras.Json(row["raw_data"]),
            row["source_url"],
        ),
    )
    return cur.fetchone()[0], "inserted"


def upsert_initiative_proposers(
    cur,
    *,
    initiative_id: str,
    proposers: list[dict[str, Any]],
    source_url: str | None,
    politician_index: dict[str, str],
) -> int:
    count = 0
    for proposer in proposers:
        label = proposer["label"]
        group_code = proposer.get("group_code")
        politician_id = None
        party_id = None
        match_confidence = None
        match_method = None

        if proposer["kind"] == "person":
            politician_id = politician_index.get(normalize_name(label))
            if politician_id:
                match_confidence = 1.0
                match_method = "official_name_exact"
            party_id, party_confidence, party_method = match_party(cur, label, group_code)
            if party_id and not match_method:
                match_confidence = party_confidence
                match_method = party_method
        elif proposer["kind"] == "group":
            party_id, match_confidence, match_method = match_party(cur, label, group_code)

        cur.execute(
            """
            INSERT INTO initiative_proposers (
              initiative_id, proposer_label, proposer_role,
              politician_id, party_id, source_url,
              match_confidence, match_method, raw_data
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (initiative_id, proposer_label, proposer_role) DO UPDATE SET
              politician_id = COALESCE(EXCLUDED.politician_id, initiative_proposers.politician_id),
              party_id = COALESCE(EXCLUDED.party_id, initiative_proposers.party_id),
              source_url = COALESCE(EXCLUDED.source_url, initiative_proposers.source_url),
              match_confidence = COALESCE(EXCLUDED.match_confidence, initiative_proposers.match_confidence),
              match_method = COALESCE(EXCLUDED.match_method, initiative_proposers.match_method),
              raw_data = EXCLUDED.raw_data,
              updated_at = now()
            """,
            (
                initiative_id,
                label,
                proposer["role"],
                politician_id,
                party_id,
                source_url,
                match_confidence,
                match_method,
                psycopg2.extras.Json({
                    "kind": proposer["kind"],
                    "group_code": group_code,
                }),
            ),
        )
        count += 1
    return count


def run(dry_run: bool = False, source_url: str | None = None) -> None:
    conn = get_pg_conn()
    cur = conn.cursor()
    run_id = None
    rows_read = 0
    rows_inserted = 0
    rows_updated = 0
    proposer_rows = 0
    skipped = 0

    try:
        if not dry_run:
            run_id = start_run(cur, pipeline="congreso.iniciativas", chunk_key="full")

        sources = (
            [{"dataset": "manual", "url": source_url}]
            if source_url
            else discover_current_sources()
        )
        legislatures = load_legislatures(cur)
        politician_index = load_politician_index(cur) if not dry_run else {}
        if 15 not in legislatures:
            raise RuntimeError("Legislature XV not found. Run diputados first.")

        for source in sources:
            print(f"Fetching {source['dataset']} from: {source['url']}")
            records = fetch_json_records(source["url"])
            rows_read += len(records)
            print(f"Downloaded {len(records)} records")

            for record in records:
                parsed = parse_record(
                    record,
                    dataset=source["dataset"],
                    dataset_url=source["url"],
                )
                if not parsed:
                    skipped += 1
                    continue

                leg_id = legislatures.get(parsed["legislature_number"])
                if not leg_id:
                    skipped += 1
                    continue

                if dry_run:
                    print(
                        f"  {parsed['number']} {parsed['type']} "
                        f"{parsed['status']} - {parsed['title'][:80]}"
                        f" ({len(parsed['proposers'])} proponentes)"
                    )
                    continue

                initiative_id, outcome = upsert_initiative(cur, parsed, leg_id)
                if outcome == "inserted":
                    rows_inserted += 1
                else:
                    rows_updated += 1
                proposer_rows += upsert_initiative_proposers(
                    cur,
                    initiative_id=initiative_id,
                    proposers=parsed["proposers"],
                    source_url=parsed["source_url"],
                    politician_index=politician_index,
                )

            time.sleep(REQUEST_DELAY)

        if run_id:
            finish_run(
                cur,
                run_id=run_id,
                status="succeeded",
                rows_read=rows_read,
                rows_inserted=rows_inserted,
                rows_updated=rows_updated,
            )
        if not dry_run:
            conn.commit()
    except Exception as exc:
        conn.rollback()
        if run_id:
            finish_run(
                cur,
                run_id=run_id,
                status="failed",
                rows_read=rows_read,
                rows_inserted=rows_inserted,
                rows_updated=rows_updated,
                error_summary=str(exc)[:500],
            )
            conn.commit()
        raise
    finally:
        cur.close()
        conn.close()

    print(
        f"Done! {rows_read} read, {rows_inserted} inserted, "
        f"{rows_updated} updated, {proposer_rows} proposer rows, {skipped} skipped."
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--source-url",
        help="Use one Congreso Open Data JSON URL instead of discovering current datasets.",
    )
    args = parser.parse_args()
    run(dry_run=args.dry_run, source_url=args.source_url)


if __name__ == "__main__":
    main()
