"""ETL: discover Senate plenary voting sessions from open data (tipoFich=14).

Individual senator vote XML under /legis15/votaciones/ often returns 404 from
batch hosts; this module indexes sessions and initiative-level vote metadata
first. Per-senator ingestion is deferred until a stable vote XML endpoint is
confirmed (ficopendataservlet params or live legis15 paths).

Usage:
    PYTHONPATH=src python -m src.senado.votaciones --dry-run
    PYTHONPATH=src python -m src.senado.votaciones --resume
"""

from __future__ import annotations

import argparse
import re
import subprocess
import time
import xml.etree.ElementTree as ET
from dataclasses import dataclass

import psycopg2.extras
from common.db import get_pg_conn
from common.etl_runs import finish_run, start_run

BASE = "https://www.senado.es"
CATALOG_URL = f"{BASE}/web/ficopendataservlet?tipoFich=14&legis=15"
UA = "Mozilla/5.0 (compatible; EspanaTransparente/1.0)"
REQUEST_DELAY = 1.5

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


@dataclass
class SenateSessionVote:
    session_number: int
    session_date: str | None
    title: str
    vote_xml_path: str | None


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


def _cdata(el: ET.Element | None) -> str:
    if el is None or el.text is None:
        return ""
    return el.text.strip()


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


def parse_initiative_vote_index(xml_text: str) -> list[tuple[str, str, str | None]]:
    """Return (tipo_ex, num_ex, vote_xml_url) tuples from tipoFich=12."""
    root = ET.fromstring(xml_text)
    tipo_ex = _cdata(root.find("tipoExpediente"))
    num_ex = _cdata(root.find("numeroExpediente"))
    votes: list[tuple[str, str, str | None]] = []
    for votacion in root.findall(".//votacion"):
        url = _cdata(votacion.find(".//fichUrlVotacion"))
        if url:
            votes.append((tipo_ex, num_ex, url if url.startswith("http") else f"{BASE}{url}"))
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


def run(dry_run: bool = False, resume: bool = False, limit: int | None = None) -> None:
    xml = curl_text(CATALOG_URL, delay=0)
    sessions = parse_session_catalog(xml)
    if limit:
        sessions = sessions[:limit]
    print(f"Discovered {len(sessions)} Senate plenary sessions (Leg XV catalog)")

    if dry_run:
        for s in sessions[:5]:
            print(f"  · {s.session_number}: {s.title} ({s.vote_xml_path})")
        indexes = discover_initiative_indexes(limit=3)
        print(f"Sample initiative vote indexes: {len(indexes)}")
        for url in indexes:
            print(f"  · {url}")
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

            run_id = start_run(cur, pipeline="senado.votaciones", chunk_key="catalog")
            conn.commit()

            inserted = 0
            for i, session in enumerate(sessions, 1):
                if resume:
                    cur.execute(
                        """
                        SELECT 1 FROM voting_sessions
                        WHERE legislature_id = %s AND chamber = 'senate'
                          AND session_number = %s
                        LIMIT 1
                        """,
                        (legislature_id, session.session_number),
                    )
                    if cur.fetchone():
                        continue

                session_date = parse_senate_date_label(session.session_date) or "2023-08-17"
                cur.execute(
                    """
                    INSERT INTO voting_sessions (
                      legislature_id, session_number, date, title, chamber,
                      votacion_number, raw_data
                    ) VALUES (%s, %s, %s::date, %s, 'senate', 1, %s::jsonb)
                    ON CONFLICT (session_number, date, legislature_id, votacion_number, chamber)
                    DO NOTHING
                    """,
                    (
                        legislature_id,
                        session.session_number,
                        session_date,
                        session.title[:500],
                        psycopg2.extras.Json(
                            {
                                "senate_vote_xml_path": session.vote_xml_path,
                                "senate_session_date_label": session.session_date,
                                "source": "senado_ficopendataservlet_tipoFich_14",
                            }
                        ),
                    ),
                )
                inserted += cur.rowcount
                if i % 10 == 0:
                    print(f"  indexed {i}/{len(sessions)} sessions")
            conn.commit()

            finish_run(cur, run_id=run_id, status="succeeded",
                       rows_read=len(sessions), rows_inserted=inserted)
            conn.commit()
    except Exception as exc:
        if run_id:
            with conn.cursor() as cur:
                finish_run(cur, run_id=run_id, status="failed", error_summary=str(exc)[:500])
                conn.commit()
        raise
    finally:
        conn.close()

    print("Senate session index complete (votes per senator pending XML endpoint).")


def main() -> None:
    parser = argparse.ArgumentParser(description="Senate voting session indexer")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--resume", action="store_true")
    parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args()
    run(dry_run=args.dry_run, resume=args.resume, limit=args.limit)


if __name__ == "__main__":
    main()
