"""Published ICO facility commitments, not executed transfers or final operations."""
import argparse
import hashlib
import json
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from decimal import Decimal

import httpx

VERSION = 'mrr-instruments-2026-v1'
ORIGINAL = 'BOE-A-2024-13820'
AMENDMENT = 'BOE-A-2026-977'
START = 'Segunda. Modificación estipulación decimosexta del convenio.'
END = 'Tercera. Modificación estipulación decimoséptima del convenio.'
ACCOUNTS = ['27.50.45MF.831.10', '27.50.43MF.831.01']
INSTRUMENTS = [
    'Líneas de préstamos ICO de mediación con intermediarios financieros.',
    'Financiación directa de ICO.',
    'Adquisición de bonos y otros títulos de deuda emitidos en mercados organizados.',
    'Inversiones en capital y cuasi-capital.',
]


def text(element):
    return ' '.join(' '.join(element.itertext()).split())


def xml_url(identifier):
    return f'https://www.boe.es/diario_boe/xml.php?id={identifier}'


def document(data, identifier, published):
    if len(data) > 1_000_000 or re.search(br'<!DOCTYPE|<!ENTITY', data, re.I):
        raise ValueError('Unbounded or unsafe source XML')
    root = ET.fromstring(data)
    if root.tag != 'documento' or root.findtext('metadatos/identificador') != identifier:
        raise ValueError('Wrong BOE document identity')
    if root.findtext('metadatos/fecha_publicacion') != published.replace('-', ''):
        raise ValueError('Wrong publication edition')
    title = root.findtext('metadatos/titulo')
    body = root.find('texto')
    if not title or body is None or 'ICO' not in title:
        raise ValueError('Missing source title or body')
    return body, dict(identifier=identifier, title=title, published=published,
                      xml_url=xml_url(identifier), sha256=hashlib.sha256(data).hexdigest())


def section(body, start, end):
    children = list(body)
    starts = [i for i, e in enumerate(children) if e.tag == 'p' and text(e) == start]
    ends = [i for i, e in enumerate(children) if e.tag == 'p' and text(e) == end]
    if len(starts) != 1 or len(ends) != 1 or starts[0] >= ends[0]:
        raise ValueError('Missing unique bounded stipulation')
    return children[starts[0]+1:ends[0]]


def cents(value):
    # Closing quotation belongs to the published blockquote, not to the amount.
    value = value.removesuffix('»')
    if not re.fullmatch(r'(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}', value):
        raise ValueError('Invalid commitment precision')
    amount = int(Decimal(value.replace('.', '').replace(',', '.')) * 100)
    if amount > 9007199254740991:
        raise ValueError('Unsafe commitment amount')
    return amount


def build_snapshot(original, amendment, retrieved_at=None):
    original_body, original_source = document(original, ORIGINAL, '2024-07-05')
    body, amendment_source = document(amendment, AMENDMENT, '2026-01-16')
    elements = section(body, START, END)
    tables = [table for e in elements for table in e.iter('table')]
    if len(tables) != 1:
        raise ValueError('Missing unique revised commitment table')
    table = tables[0]
    headers = [text(e) for e in table.findall('thead/tr/th')]
    if len(headers) != 3 or any(account not in headers[i+1] for i, account in enumerate(ACCOUNTS)):
        raise ValueError('Unexpected financing accounts or column order')
    rows = [[text(cell) for cell in row.findall('td')] for row in table.findall('tbody/tr')]
    if len(rows) != 4 or any(len(row) != 3 for row in rows):
        raise ValueError('Incomplete commitment table')
    if [row[0] for row in rows] != ['2024', '2025', '2026', 'Total.']:
        raise ValueError('Unexpected annualities or duplicate total')
    values = [[cents(value) for value in row[1:]] for row in rows]
    if any(sum(row[i] for row in values[:3]) != values[3][i] for i in range(2)):
        raise ValueError('Commitments do not reconcile')
    instrument_section = section(original_body,
        'Quinta. Instrumentos financieros para la canalización del presupuesto de la línea ICO-Verde y la línea ICO Empresas y Emprendedores.',
        'Sexta. Procedimiento de selección de los intermediarios financieros.')
    headings = [text(e) for e in instrument_section if e.tag == 'p']
    if any(not any(value.startswith(f'{i+1}. {heading}') for value in headings) for i, heading in enumerate(INSTRUMENTS)):
        raise ValueError('Changed original instrument coverage')
    full_text = text(body)
    required = ['En Madrid, a 31 de diciembre de 2025.', 'Israel Arroyo Martínez',
                'Manuel Illueca Muñoz', 'una vez inscritas en el Registro Electrónico']
    if any(fragment not in full_text for fragment in required):
        raise ValueError('Missing signature or effectiveness evidence')
    return dict(version=VERSION, scope='ico-2026', signed='2025-12-31',
        retrieved_at=retrieved_at or datetime.now(timezone.utc).isoformat(),
        sources=dict(original=original_source, amendment=amendment_source),
        stage='commitments-to-ico', effectiveness='registration-not-verified',
        instruments=INSTRUMENTS,
        signatories=[dict(name='Israel Arroyo Martínez', role='Secretario de Estado de Economía y Apoyo a la Empresa'),
                     dict(name='Manuel Illueca Muñoz', role='Representante de ICO y AXIS')],
        facilities=[dict(id=key, label=label, account=ACCOUNTS[i],
            annualities=[dict(year=int(rows[j][0]), cents=values[j][i]) for j in range(3)],
            total_cents=values[3][i]) for i, (key, label) in enumerate([
                ('ico-verde', 'ICO Verde'), ('ico-empresas', 'ICO Empresas y Emprendedores')])])


def fetch_snapshot():
    documents = []
    with httpx.Client(timeout=60, follow_redirects=True) as client:
        for identifier in [ORIGINAL, AMENDMENT]:
            chunks, size = [], 0
            with client.stream('GET', xml_url(identifier)) as response:
                response.raise_for_status()
                for chunk in response.iter_bytes():
                    size += len(chunk)
                    if size > 1_000_000:
                        raise ValueError('Oversized source XML')
                    chunks.append(chunk)
            documents.append(b''.join(chunks))
    return build_snapshot(*documents)


def persist(cur, snapshot):
    cur.execute("INSERT INTO mrr_instrument_snapshot(scope,metadata) VALUES ('ico-2026',%s::jsonb) ON CONFLICT(scope) DO UPDATE SET metadata=EXCLUDED.metadata", (json.dumps(snapshot, ensure_ascii=False),))


def run(dry_run=False):
    if dry_run:
        snapshot = fetch_snapshot()
        print('Reconciled published commitments:', [(f['id'], f['total_cents']) for f in snapshot['facilities']])
        return
    from common.db import get_pg_conn
    from common.etl_runs import start_run, finish_run
    conn, run_id = get_pg_conn(), None
    try:
        with conn.cursor() as cur:
            run_id = start_run(cur, pipeline='prtr.instruments')
        conn.commit()
        snapshot = fetch_snapshot()
        with conn.cursor() as cur:
            persist(cur, snapshot)
            finish_run(cur, run_id=run_id, status='succeeded', rows_read=6)
        conn.commit()
    except Exception as exc:
        conn.rollback()
        if run_id:
            with conn.cursor() as cur:
                finish_run(cur, run_id=run_id, status='failed', error_summary=str(exc)[:500])
            conn.commit()
        raise
    finally:
        conn.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dry-run', action='store_true')
    run(parser.parse_args().dry_run)
