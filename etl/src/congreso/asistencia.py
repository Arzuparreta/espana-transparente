"""ETL: ingest all Leg XV plenary session votes and derive attendance.

Discovers all voting dates from the Congress portlet, downloads the ZIP for
each session, and upserts votes into the existing voting_sessions/votes tables.
Attendance is then queryable via the v_attendance_summary DB view.
The voting list summary is exposed via v_voting_session_summary and updates
automatically from the same voting_sessions/votes tables.

Usage:
    PYTHONPATH=src python -m src.congreso.asistencia
    PYTHONPATH=src python -m src.congreso.asistencia --dry-run
    PYTHONPATH=src python -m src.congreso.asistencia --from-date 20250101
    PYTHONPATH=src python -m src.congreso.asistencia --resume
"""

import argparse
import io
import json
import os
import re
import subprocess
import time
import zipfile
from datetime import date

import psycopg2.extras
from common.db import get_pg_conn
from common.etl_runs import finish_run, is_chunk_succeeded, start_run

BASE_URL = "https://www.congreso.es"
PORTLET_URL = (
    f"{BASE_URL}/es/c/portal/render_portlet"
    "?p_l_id=696467&p_p_id=votaciones&p_p_lifecycle=0"
    "&p_t_lifecycle=0&p_p_state=normal&p_p_mode=view&targetLegislatura=XV"
)
VOTACIONES_URL = f"{BASE_URL}/es/opendata/votaciones"
OPENDATA_BASE = f"{BASE_URL}/webpublica/opendata/votaciones/Leg15"

UA = "Mozilla/5.0 (compatible; AccionHumana/1.0)"
REQUEST_DELAY = 1.5  # seconds between HTTP requests

VOTE_MAP = {
    "sí": "Sí", "si": "Sí", "no": "No",
    "abstención": "Abstención", "abstencion": "Abstención",
    "no vota": "No vota",
}


def curl_text(url: str, delay: float = REQUEST_DELAY) -> str:
    if delay:
        time.sleep(delay)
    result = subprocess.run(
        ["curl", "-sL", "-H", f"User-Agent: {UA}", url],
        capture_output=True, text=True, timeout=30,
    )
    return result.stdout


def curl_bytes(url: str, delay: float = REQUEST_DELAY) -> bytes:
    if delay:
        time.sleep(delay)
    result = subprocess.run(
        ["curl", "-sL", "-H", f"User-Agent: {UA}", url],
        capture_output=True, timeout=60,
    )
    return result.stdout


def get_voting_dates() -> list[int]:
    html = curl_text(PORTLET_URL, delay=0)
    match = re.search(r"var diasVotaciones = \[([^\]]+)\]", html)
    if not match:
        raise RuntimeError("diasVotaciones not found in Congress portlet")
    return sorted(int(d.strip()) for d in match.group(1).split(","))


def get_session_zip_url(date_int: int) -> tuple[int | None, str | None]:
    """Return (session_number, zip_url) for a given date, or (None, None)."""
    d = str(date_int)
    formatted = f"{d[6:8]}/{d[4:6]}/{d[:4]}"  # DD/MM/YYYY
    url = (
        f"{VOTACIONES_URL}?p_p_id=votaciones&p_p_lifecycle=0"
        f"&p_p_state=normal&p_p_mode=view&targetLegislatura=XV&targetDate={formatted}"
    )
    html = curl_text(url)
    match = re.search(r"Sesion(\d+)/(\d{8})/(VOT_\d+\.zip)", html)
    if not match:
        return None, None
    session_num = int(match.group(1))
    zip_url = f"{OPENDATA_BASE}/Sesion{match.group(1)}/{match.group(2)}/{match.group(3)}"
    return session_num, zip_url


def parse_zip_votaciones(zip_bytes: bytes) -> list[dict]:
    """Extract and parse all vote JSONs from a session ZIP, one per votacion.

    ZIP entries use flat names like 'sesion56votacion1.json'.
    """
    by_num: dict[int, dict] = {}
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        for name in zf.namelist():
            if not name.endswith(".json"):
                continue
            m = re.search(r"votacion(\d+)\.json$", name, re.IGNORECASE)
            if not m:
                continue
            vot_num = int(m.group(1))
            if vot_num in by_num:
                continue
            with zf.open(name) as f:
                by_num[vot_num] = json.load(f)
    return [by_num[k] for k in sorted(by_num)]


def build_politician_index(cur) -> dict:
    cur.execute("SELECT id, full_name, first_name, last_name FROM politicians")
    idx: dict[str, str] = {}
    for pid, full, first, last in cur.fetchall():
        idx[full.lower().strip()] = pid
        if first and last:
            idx[f"{first.lower().strip()} {last.lower().strip()}"] = pid
            idx[f"{last.lower().strip()}, {first.lower().strip()}"] = pid
    return idx


def get_existing_sessions(cur, leg_id) -> set:
    cur.execute(
        "SELECT DISTINCT session_number, date FROM voting_sessions WHERE legislature_id = %s",
        (leg_id,),
    )
    return {(row[0], str(row[1])) for row in cur.fetchall()}


def ingest_session(cur, leg_id, session_num, date_str, votaciones, pol_idx) -> int:
    vote_count = 0
    for vot_data in votaciones:
        info = vot_data.get("informacion", {})
        votes_data = vot_data.get("votaciones", [])
        vot_num = info.get("numeroVotacion", 0)

        title = (info.get("titulo", "") or "")
        texto = (info.get("textoExpediente", "") or "")
        title_full = (f"{title} - {texto[:200]}" if texto else title)[:500]
        exp_num = texto[:80] if texto else ""

        cur.execute(
            """
            INSERT INTO voting_sessions
                (legislature_id, session_number, date, title, initiative_number, votacion_number, raw_data)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (session_number, date, legislature_id, votacion_number) DO NOTHING
            RETURNING id
            """,
            (leg_id, session_num, date_str, title_full, exp_num, vot_num,
             psycopg2.extras.Json(info)),
        )
        row = cur.fetchone()
        if row:
            sid = row[0]
        else:
            cur.execute(
                "SELECT id FROM voting_sessions WHERE legislature_id=%s AND session_number=%s AND date=%s AND votacion_number=%s",
                (leg_id, session_num, date_str, vot_num),
            )
            fetched = cur.fetchone()
            if not fetched:
                continue
            sid = fetched[0]

        rows = []
        for v in votes_data:
            name = v.get("diputado", "").strip()
            voto_raw = v.get("voto", "").strip()
            voto = VOTE_MAP.get(voto_raw.lower(), voto_raw.capitalize())
            pol_id = pol_idx.get(name.lower().strip())
            if pol_id:
                rows.append((sid, pol_id, voto, psycopg2.extras.Json(v)))

        if rows:
            psycopg2.extras.execute_values(
                cur,
                """
                INSERT INTO votes (voting_session_id, politician_id, vote, raw_data)
                VALUES %s
                ON CONFLICT (voting_session_id, politician_id) DO UPDATE SET
                    vote = EXCLUDED.vote, raw_data = EXCLUDED.raw_data
                """,
                rows,
            )
            vote_count += len(rows)

    return vote_count


def run(dry_run: bool = False, from_date: int | None = None, resume: bool = False) -> None:
    conn = get_pg_conn()
    run_id = None
    try:
        cur = conn.cursor()

        # Compute chunk bounds for resume tracking.
        if from_date:
            d_str = str(from_date)
            window_start = date(int(d_str[:4]), int(d_str[4:6]), int(d_str[6:]))
        else:
            window_start = date(2023, 8, 17)  # approximate start of Leg XV
        window_end = date.today()
        chunk_key = str(from_date) if from_date else "all"

        # Resume: skip chunk if already marked succeeded in etl_runs.
        if resume and is_chunk_succeeded(
            cur,
            pipeline="congreso.asistencia",
            chunk_key=chunk_key,
            window_start=window_start,
            window_end=window_end,
        ):
            print(f"Skipping chunk {chunk_key}: already succeeded in etl_runs")
            cur.close()
            conn.close()
            return

        cur.execute("SELECT id FROM legislatures WHERE number = 15")
        leg_id = cur.fetchone()[0]

        print("Fetching voting dates from Congress portlet...")
        all_dates = get_voting_dates()
        if from_date:
            all_dates = [d for d in all_dates if d >= from_date]
        print(f"{len(all_dates)} dates to process")

        if not dry_run:
            run_id = start_run(
                cur,
                pipeline="congreso.asistencia",
                chunk_key=chunk_key,
                window_start=window_start,
                window_end=window_end,
            )
            conn.commit()

        existing = get_existing_sessions(cur, leg_id)
        pol_idx = build_politician_index(cur)
        print(f"DB: {len(existing)} sessions already ingested | {len(pol_idx) // 3} politicians\n")

        total_sessions = 0
        total_votes = 0

        for i, date_int in enumerate(all_dates):
            d = str(date_int)
            date_str = f"{d[:4]}-{d[4:6]}-{d[6:]}"
            print(f"[{i+1}/{len(all_dates)}] {date_str}", end="  ", flush=True)

            session_num, zip_url = get_session_zip_url(date_int)

            if session_num is None:
                print("no session data")
                continue

            if (session_num, date_str) in existing:
                print(f"session {session_num} already in DB")
                continue

            if dry_run:
                print(f"would ingest session {session_num}")
                continue

            print(f"session {session_num} → downloading ZIP...", end=" ", flush=True)
            zip_bytes = curl_bytes(zip_url)

            if not zip_bytes:
                print("ZIP download failed")
                continue

            try:
                votaciones = parse_zip_votaciones(zip_bytes)
            except Exception as e:
                print(f"ZIP parse error: {e}")
                continue

            vote_count = ingest_session(cur, leg_id, session_num, date_str, votaciones, pol_idx)
            conn.commit()
            existing.add((session_num, date_str))
            total_sessions += 1
            total_votes += vote_count
            print(f"{len(votaciones)} votaciones, {vote_count} votes")

        cur.close()
        print(f"\nDone! {total_sessions} new sessions, {total_votes} new votes ingested.")

        if run_id:
            cur = conn.cursor()
            finish_run(cur, run_id=run_id, status="succeeded",
                       rows_read=len(all_dates), rows_inserted=total_votes)
            conn.commit()
            cur.close()
    except Exception as exc:
        if run_id:
            cur = conn.cursor()
            finish_run(cur, run_id=run_id, status="failed", error_summary=str(exc)[:500])
            conn.commit()
        raise
    finally:
        conn.close()


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="discover sessions without ingesting")
    parser.add_argument("--from-date", type=int, metavar="YYYYMMDD", help="start from this date")
    parser.add_argument("--resume", action="store_true", help="skip chunk if already marked succeeded in etl_runs")
    return parser


if __name__ == "__main__":
    parser = build_arg_parser()
    args = parser.parse_args()
    run(dry_run=args.dry_run, from_date=args.from_date, resume=args.resume)
