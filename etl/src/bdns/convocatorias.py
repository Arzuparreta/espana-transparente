"""Bounded enrichment of calls referenced by organizational grants already held.

Stores public call descriptors only, never beneficiaries, documents or budgets.
"""
import argparse
import re
import time
from datetime import datetime, timezone

import httpx
from common.db import get_pg_conn
from common.etl_runs import start_run, finish_run

API = "https://www.infosubvenciones.es/bdnstrans/api/convocatorias"
CAPACITY = 10_000


def parse_call(raw, code, checked_at=None):
    if not re.fullmatch(r"[0-9]{1,20}", code) or str(raw.get("codigoBDNS")) != code:
        raise ValueError("BDNS call identity mismatch")
    def text(key, maximum, required=False):
        value = raw.get(key)
        if value is None:
            if required: raise ValueError(f"Missing {key}")
            return None
        if not isinstance(value, str) or len(value) > maximum:
            raise ValueError(f"Invalid {key}")
        value = value.strip()
        if required and not value: raise ValueError(f"Empty {key}")
        return value or None
    title = text("descripcion", 2000, True)
    purpose = text("descripcionFinalidad", 512)
    kind = text("tipoConvocatoria", 256)
    return (code, title, purpose, kind,
            f"https://www.infosubvenciones.es/bdnstrans/GE/es/convocatoria/{code}",
            checked_at or datetime.now(timezone.utc).isoformat())


def fetch_call(code):
    for attempt in range(3):
        try:
            response = httpx.get(API, params={"numConv": code}, timeout=30,
                headers={"User-Agent": "EspanaTransparente/1.0 (+https://spaintransparencia.info)"})
            response.raise_for_status()
            if response.status_code == 204:
                return None  # BDNS publishes no descriptor for this code
            return parse_call(response.json(), code)
        except (httpx.TransportError, ValueError):
            if attempt == 2: raise
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code < 500 or attempt == 2: raise
        time.sleep(3 * (attempt + 1))


def pending_codes(cur, limit):
    # Refresh only call codes present in the existing organizational corpus.
    cur.execute("SELECT count(*) FROM bdns_calls")
    free = max(0, CAPACITY - cur.fetchone()[0])
    budget = min(limit, free) if free else limit
    if not free:
        print("BDNS call capacity reached; refreshing existing calls only")
    cur.execute("""SELECT s.numero_convocatoria FROM subsidies s
        LEFT JOIN bdns_calls c ON c.numero_convocatoria=s.numero_convocatoria
        WHERE s.numero_convocatoria ~ '^[0-9]{1,20}$'
          AND (c.checked_at IS NULL OR c.checked_at < now()-interval '30 days')
          AND NOT EXISTS (SELECT 1 FROM bdns_call_misses m
            WHERE m.numero_convocatoria=s.numero_convocatoria
              AND m.checked_at > now()-interval '30 days')
          AND (c.numero_convocatoria IS NOT NULL OR %s > 0)
        GROUP BY s.numero_convocatoria, c.checked_at
        ORDER BY (c.checked_at IS NULL) DESC, max(s.fecha_concesion) DESC NULLS LAST,
          s.numero_convocatoria LIMIT %s""", (free, budget))
    return [r[0] for r in cur.fetchall()]


def store_calls(cur, records):
    # Bound disk usage and make concurrent capacity checks atomic.
    cur.execute("LOCK TABLE bdns_calls IN SHARE ROW EXCLUSIVE MODE")
    cur.execute("SELECT numero_convocatoria FROM bdns_calls")
    existing = {r[0] for r in cur.fetchall()}
    if len(existing | {r[0] for r in records}) > CAPACITY:
        raise ValueError("BDNS call capacity reached; audit size before expansion")
    cur.executemany("""INSERT INTO bdns_calls
        (numero_convocatoria,title,finalidad,tipo_convocatoria,source_url,checked_at)
        VALUES (%s,%s,%s,%s,%s,%s) ON CONFLICT (numero_convocatoria) DO UPDATE SET
        title=EXCLUDED.title, finalidad=EXCLUDED.finalidad,
        tipo_convocatoria=EXCLUDED.tipo_convocatoria,
        source_url=EXCLUDED.source_url, checked_at=EXCLUDED.checked_at""", records)


def run(limit=100, codes=None, dry_run=False):
    if not 1 <= limit <= 250: raise ValueError("limit must be 1..250")
    conn = None
    run_id = None
    try:
        if not dry_run or codes is None:
            conn = get_pg_conn()
        if codes is None:
            with conn.cursor() as cur: codes = pending_codes(cur, limit)
            conn.rollback()  # no database transaction held during network access
        codes = list(dict.fromkeys(codes))
        if len(codes) > limit or any(not re.fullmatch(r"[0-9]{1,20}", c) for c in codes):
            raise ValueError("Invalid or excessive call codes")
        if not dry_run:
            with conn.cursor() as cur:
                run_id = start_run(cur, pipeline="bdns.convocatorias")
            conn.commit()
        records = []
        misses = []
        for i, code in enumerate(codes):
            if i: time.sleep(1)
            record = fetch_call(code)
            if record is None: misses.append(code)
            else: records.append(record)
        if not dry_run:
            with conn.cursor() as cur:
                store_calls(cur, records)
                if misses:
                    cur.executemany("""INSERT INTO bdns_call_misses (numero_convocatoria,checked_at)
                        VALUES (%s,now()) ON CONFLICT (numero_convocatoria)
                        DO UPDATE SET checked_at=EXCLUDED.checked_at""", [(c,) for c in misses])
                finish_run(cur, run_id=run_id, status="succeeded", rows_read=len(records), rows_inserted=len(records))
            conn.commit()
        print(f"BDNS calls: {len(records)} verified, {len(misses)} without published descriptor; dry_run={dry_run}")
    except Exception as exc:
        if conn:
            conn.rollback()
            if run_id:
                with conn.cursor() as cur:
                    finish_run(cur, run_id=run_id, status="failed", error_summary=str(exc)[:500])
                conn.commit()
        raise
    finally:
        if conn: conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=100)
    parser.add_argument("--codes", nargs="+")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    run(args.limit, args.codes, args.dry_run)
