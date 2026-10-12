"""Bounded 2024 financing settlement: balances, never annual funding or payments."""
import argparse
import hashlib
import json
from datetime import datetime, timezone
from decimal import Decimal
from io import BytesIO

import httpx
import openpyxl

VERSION = 'territorial-financing-2024-v1'
PAGE = 'https://www.hacienda.gob.es/es-ES/CDI/Paginas/SistemasFinanciacionDeuda/InformacionCCAAs/Informes%20financiacion%20comunidades%20autonomas2.aspx'
BASE = 'https://www.hacienda.gob.es/cdi/sist%20financiacion%20y%20deuda/informaci%C3%B3nccaa/'
SOURCE = BASE + 'cuadros-liquidacion-2024.xlsx'
METHOD = BASE + 'liquidacion-de-los-recursos-sfa-2024.pdf'
TERRITORIES = {
 'Cataluña': '09', 'Galicia': '11', 'Andalucía': '01', 'Principado de Asturias': '03',
 'Cantabria': '06', 'La Rioja': '16', 'Región de Murcia': '13', 'C. Valenciana': '17',
 'Aragón': '02', 'Castilla-La Mancha': '08', 'Canarias': '05', 'Extremadura': '10',
 'Illes Balears': '04', 'Comunidad de Madrid': '12', 'Castilla y León': '07',
 'Ceuta': '18', 'Melilla': '19',
}
COMPONENTS = ['irpf', 'iva', 'special', 'guarantee', 'sufficiency', 'resources', 'competitiveness', 'cooperation', 'total']
TOTALS = ['Total CC.AA.', 'Total Ciudades', 'Total General']
DETAILS = {
 'irpf': ('1.1.2. IRPF', 4, [1, 2, 3], ['Rendimiento definitivo', 'Entregas a cuenta', 'Liquidación 2024']),
 'iva': ('1.2. IVA', 6, [2, 3, 4], ['Valor definitivo', 'Entregas a cuenta', 'Liquidación 2024']),
 'guarantee': ('1.9.4 Liq TFG ', 4, [4, 5, 6], ['Transferencia del Fondo', 'Entregas a cuenta', 'Liquidación']),
 'sufficiency': ('1.10 Fondo de Suficiencia', 4, [5, 6, 7], ['Fondo de Suficiencia Global 2024', 'Entregas a cuenta', 'Liquidación 2024']),
}
TOLERANCE = Decimal('0.05')  # thousands EUR; source formula/rounding differences


def text(value):
    return ' '.join(str(value or '').split())


def value(raw):
    if isinstance(raw, bool) or not isinstance(raw, (int, float)):
        raise ValueError('Missing/non-numeric financing amount')
    n = Decimal(str(raw))
    if not n.is_finite() or abs(n) > Decimal('1000000000'):
        raise ValueError('Financing amount outside bounds')
    return n


def close(a, b):
    if abs(a - b) > TOLERANCE:
        raise ValueError('Financing reconciliation failed')


def parse_workbook(payload, checked_at=None):
    if len(payload) > 10_000_000:
        raise ValueError('Financing workbook too large')
    wb = openpyxl.load_workbook(BytesIO(payload), read_only=True, data_only=True)
    try:
        s = wb['3. Liquidación definitiva']
        if s.max_row != 26 or not 10 <= s.max_column <= 20:
            raise ValueError('Settlement layout changed')
        rows = list(s.iter_rows(max_col=10, values_only=True))
        if '2024' not in text(rows[1][0]) or text(rows[2][0]) != '(Miles de euros)':
            raise ValueError('Settlement year/unit changed')
        headers = ['Comunidad Autónoma/Ciudad', 'Rendimiento definitivo', 'Impuesto sobre el Valor Añadido', 'Total Impuestos Especiales', 'Transferencia del Fondo', 'Fondo de Suficiencia', 'Total liquidación de recursos', 'Fondo de Competitividad', 'Fondo de Cooperación', 'Total liquidación de recursos']
        if any(not text(rows[3][i]).startswith(h) for i, h in enumerate(headers)):
            raise ValueError('Settlement columns changed')
        balances = {}
        for r in rows[4:]:
            label = text(r[0])
            if not label:
                if any(v is not None for v in r[1:]): raise ValueError('Unlabelled settlement values')
                continue
            if label not in TERRITORIES and label not in TOTALS:
                raise ValueError('Settlement territory changed')
            if label in balances:
                raise ValueError('Duplicate settlement territory')
            nums = [value(v) for v in r[1:10]]
            close(sum(nums[:5]), nums[5]); close(nums[5] + nums[6] + nums[7], nums[8])
            balances[label] = dict(zip(COMPONENTS, nums))
        if set(balances) != set(TERRITORIES) | set(TOTALS):
            raise ValueError('Settlement coverage incomplete')
        for total, parts in [('Total CC.AA.', list(TERRITORIES)[:15]), ('Total Ciudades', ['Ceuta', 'Melilla']), ('Total General', TOTALS[:2])]:
            for c in COMPONENTS:
                close(sum(balances[p][c] for p in parts), balances[total][c])
        details = {label: {} for label in TERRITORIES}
        for c, (sheet, header, indices, labels) in DETAILS.items():
            s = wb[sheet]
            if s.max_row > 100 or s.max_column > 300:
                raise ValueError('Financing detail outside bounds')
            rs = list(s.iter_rows(max_col=8, values_only=True))
            if '2024' not in text(rs[1][0]) or text(rs[2][0]) != '(Miles de euros)' or any(not text(rs[header-1][i]).startswith(h) for i, h in zip(indices, labels)):
                raise ValueError('Financing detail columns/year/unit changed')
            seen = set(); detail_total = None
            for r in rs[header:]:
                label = text(r[0])
                if label == 'Total':
                    if detail_total is not None: raise ValueError('Duplicate financing detail total')
                    detail_total = [value(r[i]) for i in indices]
                    continue
                if c == 'guarantee' and label == '2.2.4' and all(v is None for v in r[1:]):
                    continue  # Isolated cross-reference after the table in this edition.
                if label not in TERRITORIES:
                    if label and not label.startswith(('Total', '(')):
                        raise ValueError('Unexpected financing detail row')
                    continue
                if label in seen:
                    raise ValueError('Duplicate financing detail')
                seen.add(label)
                if c == 'iva' and label == 'Canarias' and all(r[i] is None for i in indices):
                    details[label][c] = None  # Source blank, distinct from zero in the summary.
                    continue
                nums = [value(r[i]) for i in indices]
                close(nums[0] - nums[1], nums[2]); close(nums[2], balances[label][c])
                details[label][c] = dict(zip(['definitive', 'advance', 'balance'], nums))
            expected = set(TERRITORIES) if c == 'sufficiency' else set(list(TERRITORIES)[:15])
            if seen != expected or detail_total is None:
                raise ValueError('Financing detail coverage changed')
            for i, field in enumerate(['definitive', 'advance', 'balance']):
                close(sum(details[label][c][field] for label in seen if details[label][c] is not None), detail_total[i])
        def floats(obj):
            return json.loads(json.dumps(obj, default=lambda n: float(n)))
        return dict(version=VERSION, year=2024, publication='2026-07', unit='MILES_EUR',
            source_url=SOURCE, page_url=PAGE, method_url=METHOD, workbook_sha256=hashlib.sha256(payload).hexdigest(),
            retrieved_at=checked_at or datetime.now(timezone.utc).isoformat(),
            records=[dict(territory=code, name=label, group='city' if code in ('18', '19') else 'common', balances=floats(balances[label]), details=floats(details[label])) for label, code in TERRITORIES.items()],
            totals=floats({label: balances[label] for label in TOTALS}))
    finally:
        wb.close()


def fetch_snapshot():
    with httpx.Client(timeout=60, follow_redirects=True) as client:
        r = client.get(SOURCE); r.raise_for_status()
    return parse_workbook(r.content)


def save(cur, s):
    if s.get('version') != VERSION or len(s.get('records', [])) != 17 or {r['territory'] for r in s['records']} != set(TERRITORIES.values()):
        raise ValueError('Incomplete financing snapshot')
    cur.execute("INSERT INTO territorial_financing_snapshot(scope,metadata) VALUES('settlement-2024',%s) ON CONFLICT(scope) DO UPDATE SET metadata=EXCLUDED.metadata", (json.dumps(s, ensure_ascii=False),))


def run(dry_run=False):
    if dry_run:
        s = fetch_snapshot(); print(f"Verified {len(s['records'])} territories; no writes"); return
    from common.db import get_pg_conn
    from common.etl_runs import start_run, finish_run
    conn, run_id = get_pg_conn(), None
    try:
        with conn.cursor() as cur: run_id = start_run(cur, pipeline='presupuestos.financiacion')
        conn.commit(); s = fetch_snapshot()
        with conn.cursor() as cur:
            save(cur, s); finish_run(cur, run_id=run_id, status='succeeded', rows_read=17, rows_inserted=1)
        conn.commit()
    except Exception as e:
        conn.rollback()
        if run_id:
            with conn.cursor() as cur: finish_run(cur, run_id=run_id, status='failed', error_summary=str(e)[:500])
            conn.commit()
        raise
    finally:
        conn.close()


if __name__ == '__main__':
    p = argparse.ArgumentParser(); p.add_argument('--dry-run', action='store_true'); run(p.parse_args().dry_run)
