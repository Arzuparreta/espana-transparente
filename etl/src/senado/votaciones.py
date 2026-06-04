"""ETL: ingest Senate plenary votes from official open-data XML.

The stable source is the Senate static XML export under
/legis15/votaciones/ses_N.xml. Some catalog endpoints intermittently return
maintenance HTML, so discovery accepts catalog links when available and falls
back to probing the static session path at Senado request-delay speed.

Usage:
    PYTHONPATH=src python -m src.senado.votaciones --dry-run --limit 1
    PYTHONPATH=src python -m src.senado.votaciones --resume
"""

from __future__ import annotations

import argparse
import re
import subprocess
import time
import unicodedata
import xml.etree.ElementTree as ET
from dataclasses import dataclass

import psycopg2.extras
from common.db import get_pg_conn
from common.etl_runs import finish_run, start_run
from common.utils import normalize_name

BASE = "https://www.senado.es"
CATALOG_URL = f"{BASE}/web/ficopendataservlet?tipoFich=14&legis=15"
OPEN_DATA_CATALOG_URL = (
    f"{BASE}/web/relacionesciudadanos/datosabiertos/catalogodatos/"
    "sesionesplenariascd/votacionescd/index.html"
)
UA = "Mozilla/5.0 (compatible; EspanaTransparente/1.0)"
REQUEST_DELAY = 1.5
DEFAULT_MAX_SESSION = 120

MONTHS_ES = {
    "enero": 1,
    "febrero": 2,
    "marzo": 3,
    "abril": 4,
    "mayo": 5,
    "junio": 6,
    "julio": 7,
    "agosto": 8,
    "septiembre": 9,
    "octubre": 10,
    "noviembre": 11,
    "diciembre": 12,
}

MONTHS_SHORT_ES = {
    "ENE": 1,
    "FEB": 2,
    "MAR": 3,
    "ABR": 4,
    "MAY": 5,
    "JUN": 6,
    "JUL": 7,
    "AGO": 8,
    "SEP": 9,
    "OCT": 10,
    "NOV": 11,
    "DIC": 12,
}

VOTE_MAP = {
    "si": "Sí",
    "sí": "Sí",
    "no": "No",
    "abstencion": "Abstención",
    "abstención": "Abstención",
    "no vota": "No vota",
}

SPANISH_NAME_PARTICLES = {"de", "del", "la", "las", "los", "y", "i"}


@dataclass
class SenateSessionVote:
    session_number: int
    session_date: str | None
    title: str
    vote_xml_path: str | None


@dataclass
class SenateVoteRow:
    name: str
    vote: str
    seat: str | None
    group: str | None
    absent: bool = False


@dataclass
class SenateVotation:
    session_number: int
    session_date: str
    votation_number: int
    code: str | None
    initiative_number: str | None
    title: str
    subtitle: str | None
    vote_date: str | None
    vote_time: str | None
    totals: dict[str, int]
    votes: list[SenateVoteRow]
    source_url: str


@dataclass
class SenateUnmatchedVote:
    name: str
    normalized_name: str
    group: str | None
    session_number: int
    votation_number: int
    vote: str
    seat: str | None
    source_url: str


def curl_text(url: str, delay: float = REQUEST_DELAY) -> str:
    if delay:
        time.sleep(delay)
    result = subprocess.run(
        ["curl", "-sL", "-H", f"User-Agent: {UA}", url],
        capture_output=True,
        timeout=60,
    )
    raw = result.stdout
    for enc in ("utf-8", "iso-8859-1", "windows-1252", "latin1"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", errors="replace")


def curl_status(url: str, delay: float = REQUEST_DELAY) -> int:
    if delay:
        time.sleep(delay)
    result = subprocess.run(
        ["curl", "-sIL", "-o", "/dev/null", "-w", "%{http_code}", "-H", f"User-Agent: {UA}", url],
        capture_output=True,
        text=True,
        timeout=30,
    )
    try:
        return int(result.stdout.strip()[-3:])
    except ValueError:
        return 0


def parse_senate_date_label(label: str | None) -> str | None:
    if not label:
        return None
    match = re.search(r"(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})", label.lower())
    if not match:
        return None
    day, month_name, year = match.groups()
    month = MONTHS_ES.get(month_name)
    if not month:
        return None
    return f"{year}-{month:02d}-{int(day):02d}"


def parse_senate_slash_date(label: str | None) -> str | None:
    if not label:
        return None
    match = re.search(r"(\d{1,2})/(\d{1,2})/(\d{4})", label)
    if not match:
        return None
    day, month, year = match.groups()
    return f"{year}-{int(month):02d}-{int(day):02d}"


def parse_senate_vote_date(label: str | None) -> str | None:
    if not label:
        return None
    match = re.search(r"(\d{1,2})-([A-ZÁÉÍÓÚÑ]{3})-(\d{4})", label.upper())
    if not match:
        return parse_senate_slash_date(label)
    day, month_name, year = match.groups()
    month_key = unicodedata.normalize("NFKD", month_name).encode("ascii", "ignore").decode("ascii")
    month = MONTHS_SHORT_ES.get(month_key)
    if not month:
        return None
    return f"{year}-{month:02d}-{int(day):02d}"


def _cdata(el: ET.Element | None) -> str:
    if el is None or el.text is None:
        return ""
    return el.text.strip()


def _absolute_url(path_or_url: str) -> str:
    if path_or_url.startswith("http"):
        return path_or_url
    if path_or_url.startswith("/"):
        return f"{BASE}{path_or_url}"
    return f"{BASE}/{path_or_url}"


def parse_session_catalog(xml_text: str) -> list[SenateSessionVote]:
    root = ET.fromstring(xml_text)
    sessions: list[SenateSessionVote] = []
    for node in root.findall(".//sesionPlenaria"):
        num = _cdata(node.find("sesionNumero"))
        title = _cdata(node.find("sesionTitulo")) or f"Sesión {num}"
        date_raw = _cdata(node.find("sesionFechaInicio"))
        vote_path = _cdata(node.find("fichUrlVotaciones")) or None
        if not num.isdigit():
            continue
        sessions.append(
            SenateSessionVote(
                session_number=int(num),
                session_date=date_raw or None,
                title=title,
                vote_xml_path=vote_path,
            )
        )
    return sessions


def parse_open_data_catalog_links(html: str, legis: int = 15) -> list[str]:
    pattern = rf"(?:https://www\.senado\.es)?/legis{legis}/votaciones/ses_(\d+)\.xml"
    by_session: dict[int, str] = {}
    for match in re.finditer(pattern, html, flags=re.IGNORECASE):
        session_number = int(match.group(1))
        by_session[session_number] = f"{BASE}/legis{legis}/votaciones/ses_{session_number}.xml"
    return [by_session[k] for k in sorted(by_session)]


def discover_static_session_xml_urls(
    legis: int = 15,
    from_session: int = 1,
    max_session: int = DEFAULT_MAX_SESSION,
    limit: int | None = None,
) -> list[str]:
    urls: list[str] = []
    for session_number in range(from_session, max_session + 1):
        url = f"{BASE}/legis{legis}/votaciones/ses_{session_number}.xml"
        if curl_status(url) == 200:
            urls.append(url)
            if limit and len(urls) >= limit:
                break
    return urls


def discover_session_vote_urls(
    legis: int = 15,
    from_session: int = 1,
    max_session: int = DEFAULT_MAX_SESSION,
    limit: int | None = None,
) -> list[str]:
    html = curl_text(OPEN_DATA_CATALOG_URL, delay=0)
    urls = parse_open_data_catalog_links(html, legis=legis)

    if not urls:
        catalog = curl_text(f"{BASE}/web/ficopendataservlet?tipoFich=14&legis={legis}", delay=0)
        try:
            sessions = parse_session_catalog(catalog)
            urls = [_absolute_url(s.vote_xml_path) for s in sessions if s.vote_xml_path]
        except ET.ParseError:
            urls = []

    static_urls = discover_static_session_xml_urls(
        legis=legis,
        from_session=from_session,
        max_session=max_session,
        limit=limit,
    )
    urls = list(dict.fromkeys(urls + static_urls))

    unique: dict[int, str] = {}
    for url in urls:
        match = re.search(r"/ses_(\d+)\.xml$", url)
        if not match:
            continue
        session_number = int(match.group(1))
        if from_session <= session_number <= max_session:
            unique[session_number] = url

    ordered = [unique[k] for k in sorted(unique)]
    return ordered[:limit] if limit else ordered


def parse_initiative_vote_index(xml_text: str) -> list[tuple[str, str, str | None]]:
    """Return (tipo_ex, num_ex, vote_xml_url) tuples from tipoFich=12."""
    root = ET.fromstring(xml_text)
    tipo_ex = _cdata(root.find("tipoExpediente"))
    num_ex = _cdata(root.find("numeroExpediente"))
    votes: list[tuple[str, str, str | None]] = []
    for votacion in root.findall(".//votacion"):
        url = _cdata(votacion.find(".//fichUrlVotacion"))
        if url:
            votes.append((tipo_ex, num_ex, _absolute_url(url)))
    return votes


def discover_initiative_indexes(legis: int = 15, limit: int | None = None) -> list[str]:
    """Walk tipoFich=9 catalog and collect tipoFich=12 index URLs."""
    catalog = curl_text(f"{BASE}/web/ficopendataservlet?tipoFich=9&legis={legis}", delay=0)
    urls = re.findall(
        rf"ficopendataservlet\?legis={legis}&tipoFich=12&tipoEx=(\d+)&numEx=(\d+)",
        catalog,
    )
    if limit:
        urls = urls[:limit]
    return [
        f"{BASE}/web/ficopendataservlet?legis={legis}&tipoFich=12&tipoEx={tipo}&numEx={num}"
        for tipo, num in urls
    ]


def normalize_vote(value: str | None) -> str:
    normalized = (value or "").strip().lower()
    normalized = unicodedata.normalize("NFKD", normalized).encode("ascii", "ignore").decode("ascii")
    return VOTE_MAP.get(normalized, (value or "").strip().capitalize())


def senate_name_keys(name: str | None) -> set[str]:
    key = normalize_name(name or "")
    if not key:
        return set()

    keys = {key}
    particleless = " ".join(part for part in key.split() if part not in SPANISH_NAME_PARTICLES)
    if particleless and particleless != key:
        keys.add(particleless)
    return keys


def parse_int(value: str | None) -> int:
    raw = (value or "").strip()
    return int(raw) if raw.isdigit() else 0


def parse_senate_session_vote_xml(xml_text: str, source_url: str) -> list[SenateVotation]:
    root = ET.fromstring(xml_text)
    session_node = root.find(".//sesion")
    if session_node is None:
        return []

    session_number = parse_int(_cdata(session_node.find("num_sesion")))
    session_date = parse_senate_slash_date(_cdata(session_node.find("fecha_sesion")))
    if not session_number or not session_date:
        return []

    votations: list[SenateVotation] = []
    for node in session_node.findall("votacion"):
        votation_number = parse_int(_cdata(node.find("num_vot")))
        if not votation_number:
            continue

        totals = {
            "presentes": parse_int(_cdata(node.find("tot_presentes"))),
            "afirmativos": parse_int(_cdata(node.find("tot_afirmativos"))),
            "negativos": parse_int(_cdata(node.find("tot_negativos"))),
            "abstenciones": parse_int(_cdata(node.find("tot_abstenciones"))),
            "no_votan": parse_int(_cdata(node.find("tot_novotan"))),
            "nulos": parse_int(_cdata(node.find("tot_nulos"))),
            "ausentes": parse_int(_cdata(node.find("tot_ausentes"))),
        }

        rows: list[SenateVoteRow] = []
        for vote_node in node.findall(".//resultado/VotoSenador"):
            vote = normalize_vote(_cdata(vote_node.find("voto")))
            if vote not in {"Sí", "No", "Abstención", "No vota"}:
                continue
            rows.append(
                SenateVoteRow(
                    name=_cdata(vote_node.find("nombre")),
                    vote=vote,
                    seat=_cdata(vote_node.find("escano")) or None,
                    group=_cdata(vote_node.find("grupo")) or None,
                )
            )

        for absence_node in node.findall(".//ausentes/ausencia"):
            rows.append(
                SenateVoteRow(
                    name=_cdata(absence_node.find("nombre")),
                    vote="No vota",
                    seat=_cdata(absence_node.find("escano")) or None,
                    group=_cdata(absence_node.find("grupo")) or None,
                    absent=True,
                )
            )

        title = _cdata(node.find("tit_vot")) or f"Votación {votation_number}"
        subtitle = _cdata(node.find("tit_sec")) or None
        votations.append(
            SenateVotation(
                session_number=session_number,
                session_date=session_date,
                votation_number=votation_number,
                code=_cdata(node.find("CodVotacion")) or None,
                initiative_number=_cdata(node.find("num_exp")) or None,
                title=title[:500],
                subtitle=subtitle,
                vote_date=parse_senate_vote_date(_cdata(node.find("fecha_v"))),
                vote_time=_cdata(node.find("hora_vot")) or None,
                totals=totals,
                votes=rows,
                source_url=source_url,
            )
        )

    return votations


def build_senator_index(cur) -> dict[str, str | None]:
    cur.execute(
        """
        SELECT p.id, p.full_name, p.first_name, p.last_name
        FROM politicians p
        JOIN politician_memberships pm ON pm.politician_id = p.id
        WHERE pm.chamber = 'senate'
        """
    )
    candidates: dict[str, set[str]] = {}
    for pid, full, first, last in cur.fetchall():
        names = {full or ""}
        if first and last:
            names.add(f"{first} {last}")
            names.add(f"{last}, {first}")
        for name in names:
            for key in senate_name_keys(name):
                candidates.setdefault(key, set()).add(pid)
    return {key: next(iter(ids)) if len(ids) == 1 else None for key, ids in candidates.items()}


def record_unmatched_senate_votes(cur, rows: list[SenateUnmatchedVote]) -> None:
    if not rows:
        return
    psycopg2.extras.execute_values(
        cur,
        """
        INSERT INTO senate_vote_unmatched_names (
          normalized_name, name, parliamentary_group, first_seen_session, last_seen_session,
          vote_rows, seen_vote_keys, sample_source_url, sample_raw_data
        )
        VALUES %s
        ON CONFLICT (normalized_name, parliamentary_group) DO UPDATE SET
          name = EXCLUDED.name,
          first_seen_session = LEAST(
            senate_vote_unmatched_names.first_seen_session,
            EXCLUDED.first_seen_session
          ),
          last_seen_session = GREATEST(
            senate_vote_unmatched_names.last_seen_session,
            EXCLUDED.last_seen_session
          ),
          vote_rows = senate_vote_unmatched_names.vote_rows + CASE
            WHEN EXCLUDED.seen_vote_keys[1] = ANY(senate_vote_unmatched_names.seen_vote_keys) THEN 0
            ELSE EXCLUDED.vote_rows
          END,
          seen_vote_keys = (
            SELECT array_agg(DISTINCT vote_key ORDER BY vote_key)
            FROM unnest(senate_vote_unmatched_names.seen_vote_keys || EXCLUDED.seen_vote_keys) AS keys(vote_key)
          ),
          sample_source_url = COALESCE(senate_vote_unmatched_names.sample_source_url, EXCLUDED.sample_source_url),
          sample_raw_data = CASE
            WHEN senate_vote_unmatched_names.sample_raw_data = '{}'::jsonb THEN EXCLUDED.sample_raw_data
            ELSE senate_vote_unmatched_names.sample_raw_data
          END,
          updated_at = now()
        """,
        [
            (
                row.normalized_name,
                row.name,
                row.group or "",
                row.session_number,
                row.session_number,
                1,
                [f"{row.session_number}:{row.votation_number}:{row.seat or ''}:{row.normalized_name}"],
                row.source_url,
                psycopg2.extras.Json(
                    {
                        "session_number": row.session_number,
                        "votation_number": row.votation_number,
                        "vote": row.vote,
                        "seat": row.seat,
                    }
                ),
            )
            for row in rows
        ],
    )


def upsert_senate_votation(
    cur,
    legislature_id: str,
    votation: SenateVotation,
    senator_index: dict[str, str | None],
) -> tuple[int, int]:
    title = votation.title
    if votation.subtitle:
        title = f"{votation.title} - {votation.subtitle[:200]}"

    cur.execute(
        """
        INSERT INTO voting_sessions (
          legislature_id, session_number, date, title, initiative_number, chamber,
          votacion_number, raw_data
        ) VALUES (%s, %s, %s::date, %s, %s, 'senate', %s, %s::jsonb)
        ON CONFLICT (session_number, date, legislature_id, votacion_number, chamber)
        DO UPDATE SET
          title = EXCLUDED.title,
          initiative_number = EXCLUDED.initiative_number,
          raw_data = EXCLUDED.raw_data
        RETURNING id
        """,
        (
            legislature_id,
            votation.session_number,
            votation.session_date,
            title[:500],
            votation.initiative_number,
            votation.votation_number,
            psycopg2.extras.Json(
                {
                    "source": "senado_static_session_xml",
                    "source_url": votation.source_url,
                    "cod_votacion": votation.code,
                    "vote_date": votation.vote_date,
                    "vote_time": votation.vote_time,
                    "totals": votation.totals,
                }
            ),
        ),
    )
    sid = cur.fetchone()[0]

    matched = 0
    unmatched = 0
    unmatched_rows: list[SenateUnmatchedVote] = []
    rows = []
    for vote in votation.votes:
        possible_ids = {
            senator_index[key]
            for key in senate_name_keys(vote.name)
            if key in senator_index and senator_index[key]
        }
        pol_id = next(iter(possible_ids)) if len(possible_ids) == 1 else None
        if not pol_id:
            unmatched += 1
            unmatched_rows.append(
                SenateUnmatchedVote(
                    name=vote.name,
                    normalized_name=normalize_name(vote.name),
                    group=vote.group,
                    session_number=votation.session_number,
                    votation_number=votation.votation_number,
                    vote=vote.vote,
                    seat=vote.seat,
                    source_url=votation.source_url,
                )
            )
            continue
        rows.append(
            (
                sid,
                pol_id,
                vote.vote,
                psycopg2.extras.Json(
                    {
                        "source": "senado_static_session_xml",
                        "source_url": votation.source_url,
                        "seat": vote.seat,
                        "group": vote.group,
                        "name": vote.name,
                        "absent": vote.absent,
                    }
                ),
            )
        )
        matched += 1

    if rows:
        psycopg2.extras.execute_values(
            cur,
            """
            INSERT INTO votes (voting_session_id, politician_id, vote, raw_data)
            VALUES %s
            ON CONFLICT (voting_session_id, politician_id) DO UPDATE SET
              vote = EXCLUDED.vote,
              raw_data = EXCLUDED.raw_data
            """,
            rows,
        )

    record_unmatched_senate_votes(cur, unmatched_rows)

    return matched, unmatched


def run(
    dry_run: bool = False,
    resume: bool = False,
    limit: int | None = None,
    from_session: int = 1,
    max_session: int = DEFAULT_MAX_SESSION,
) -> None:
    urls = discover_session_vote_urls(from_session=from_session, max_session=max_session, limit=limit)
    print(f"Discovered {len(urls)} Senate session XML files")

    if dry_run:
        for url in urls[:5]:
            xml = curl_text(url)
            votations = parse_senate_session_vote_xml(xml, source_url=url)
            vote_count = sum(len(v.votes) for v in votations)
            print(f"  · {url}: {len(votations)} votaciones, {vote_count} votos nominales")
        return

    conn = get_pg_conn()
    run_id = None
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM legislatures WHERE number = 15 LIMIT 1")
            row = cur.fetchone()
            if not row:
                raise RuntimeError("Legislature XV not found in DB")
            legislature_id = row[0]

            run_id = start_run(cur, pipeline="senado.votaciones", chunk_key="nominal")
            conn.commit()

            senator_index = build_senator_index(cur)
            rows_read = 0
            rows_inserted = 0
            rows_unmatched = 0
            for i, url in enumerate(urls, 1):
                xml = curl_text(url)
                votations = parse_senate_session_vote_xml(xml, source_url=url)
                if resume and votations:
                    cur.execute(
                        """
                        SELECT 1
                        FROM voting_sessions vs
                        JOIN votes v ON v.voting_session_id = vs.id
                        WHERE vs.legislature_id = %s
                          AND vs.chamber = 'senate'
                          AND vs.session_number = %s
                        LIMIT 1
                        """,
                        (legislature_id, votations[0].session_number),
                    )
                    if cur.fetchone():
                        continue

                session_read = sum(len(v.votes) for v in votations)
                session_inserted = 0
                session_unmatched = 0
                for votation in votations:
                    matched, unmatched = upsert_senate_votation(cur, legislature_id, votation, senator_index)
                    session_inserted += matched
                    session_unmatched += unmatched
                conn.commit()

                rows_read += session_read
                rows_inserted += session_inserted
                rows_unmatched += session_unmatched
                print(
                    f"  {i}/{len(urls)} {url.rsplit('/', 1)[-1]}: "
                    f"{len(votations)} votaciones, {session_inserted}/{session_read} matched"
                )

            finish_run(
                cur,
                run_id=run_id,
                status="succeeded",
                rows_read=rows_read,
                rows_inserted=rows_inserted,
                rows_updated=rows_unmatched,
            )
            conn.commit()
    except Exception as exc:
        if run_id:
            with conn.cursor() as cur:
                finish_run(cur, run_id=run_id, status="failed", error_summary=str(exc)[:500])
                conn.commit()
        raise
    finally:
        conn.close()

    print(f"Senate nominal vote ingestion complete ({rows_inserted} matched, {rows_unmatched} unmatched).")


def main() -> None:
    parser = argparse.ArgumentParser(description="Senate voting session indexer")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--resume", action="store_true")
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--from-session", type=int, default=1)
    parser.add_argument("--max-session", type=int, default=DEFAULT_MAX_SESSION)
    args = parser.parse_args()
    run(
        dry_run=args.dry_run,
        resume=args.resume,
        limit=args.limit,
        from_session=args.from_session,
        max_session=args.max_session,
    )


if __name__ == "__main__":
    main()
