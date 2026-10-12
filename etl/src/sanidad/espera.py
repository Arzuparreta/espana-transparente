"""Bounded SISLE surgical waiting snapshot; no individual patient records."""
import argparse
import hashlib
import json
import re
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup

BASE = 'https://www.sanidad.gob.es/estadEstudios/estadisticas/inforRecopilaciones/'
INDEX = BASE + 'listaEspera.htm'
REPORT = BASE + 'docs/LISTAS_PUBLICACION_Dic_2025_rectificado.pdf'
NOTE = BASE + 'docs/Nota_Aclaratoria_Rectificacion_Dic_2025.pdf'
VERSION = 'sisle-surgery-2025-v1'
TERRITORIES = [
 ('01','ANDALUCÍA','Andalucía'), ('02','ARAGON','Aragón'),
 ('03','PDO DE ASTURIAS','Asturias'), ('04','BALEARES','Illes Balears'),
 ('05','CANARIAS','Canarias'), ('06','CANTABRIA','Cantabria'),
 ('07','CASTILLA Y LEON','Castilla y León'), ('08','CASTILLA-LA MANCHA','Castilla-La Mancha'),
 ('09','CATALUÑA','Cataluña'), ('10','COMUNIDAD VALENCIANA','Comunitat Valenciana'),
 ('11','EXTREMADURA','Extremadura'), ('12','GALICIA','Galicia'),
 ('13','MADRID','Comunidad de Madrid'), ('14','MURCIA','Región de Murcia'),
 ('15','C. FORAL DE NAVARRA','Navarra'), ('16','PAÍS VASCO','País Vasco'),
 ('17','RIOJA','La Rioja'), ('18','CEUTA','Ceuta'), ('19','MELILLA','Melilla'),
 ('ES','TOTAL','SNS · España'),
]


def extract_pdf(content):
    if not content.startswith(b'%PDF-') or len(content) > 10_000_000:
        raise ValueError('Invalid or oversized SISLE PDF')
    with tempfile.TemporaryDirectory() as directory:
        path = Path(directory) / 'source.pdf'
        path.write_bytes(content)
        return subprocess.run(['pdftotext','-layout',str(path),'-'],capture_output=True,check=True,timeout=30).stdout.decode('utf-8')


def revision_date(html):
    soup = BeautifulSoup(html, 'html.parser')
    links = {urljoin(INDEX, a['href']) for a in soup.select('a[href]')}
    if REPORT not in links or NOTE not in links:
        raise ValueError('Pilot edition/correction no longer linked; review required')
    text = soup.get_text(' ',strip=True)
    match = re.search(r'Actualización de información a (\d{1,2}) de septiembre de (\d{4})', text)
    if not match or 'Castilla-La Mancha' not in text:
        raise ValueError('Unrecognised revision announcement')
    return datetime(int(match[2]),9,int(match[1])).date().isoformat()


def parse_report(text):
    pages = text.split('\f')
    if len(pages) < 20:
        raise ValueError('Incomplete SISLE report')
    page = pages[7]
    if 'DATOS A 31 DE DICIEMBRE DE 2025' not in page or 'QUIRÚRGICA' not in page or 'Distribución por comunidades autónomas' not in page:
        raise ValueError('Unexpected period or surgical table')
    rows = []
    for code, official, label in TERRITORIES:
        matches = re.findall(r'^\s*'+re.escape(official)+r'[ \t]+([\d.]+)[ \t]+(\d+,\d+)[ \t]+([\d.]+)[ \t]+(\d+,\d+)[ \t]+(\d+)(?:[ \t]{3,}[^\d\n].*)?[ \t]*$',page,re.M)
        if len(matches) != 1:
            raise ValueError(f'Missing, duplicated or unknown values for {official}')
        count, rate, long_count, share, days = matches[0]
        row = dict(code=code,label=label,patients=int(count.replace('.','')),rate=float(rate.replace(',','.')),over_six_months=int(long_count.replace('.','')),over_six_share=float(share.replace(',','.')),mean_days=int(days))
        if (row['patients'] == 0 and row['over_six_share'] != 0) or row['over_six_months'] > row['patients'] or not 0 <= row['over_six_share'] <= 100 or (row['patients'] and abs(100*row['over_six_months']/row['patients']-row['over_six_share']) > .051):
            raise ValueError('Inconsistent waiting count/percentage')
        rows.append(row)
    for key in ('patients','over_six_months'):
        if sum(row[key] for row in rows[:-1]) != rows[-1][key]:
            raise ValueError(f'SNS reconciliation failed: {key}')
    total = rows[-1]
    if total['patients'] and abs(sum(r['patients']*r['mean_days'] for r in rows[:-1])/total['patients']-total['mean_days']) > 1:
        raise ValueError('SNS weighted waiting mean inconsistent beyond rounding')
    return rows


def build_snapshot(html, pdf, note, retrieved_at=None):
    revision = revision_date(html)
    if revision < '2026-09-24':
        raise ValueError('Obsolete correction announcement')
    note_text = extract_pdf(note)
    if not all(v in note_text for v in ('DICIEMBRE 2025','Castilla-La Mancha','853.740','122')):
        raise ValueError('Unexpected correction note')
    return dict(version=VERSION,cut='2025-12-31',revision_date=revision,source_url=REPORT,index_url=INDEX,correction_url=NOTE,source_page=8,denominator='health-card-population',retrieved_at=retrieved_at or datetime.now(timezone.utc).isoformat(),sha256={name:hashlib.sha256(value).hexdigest() for name,value in [('index',html.encode()),('report',pdf),('correction',note)]},rows=parse_report(extract_pdf(pdf)))


def fetch_snapshot():
    with httpx.Client(timeout=60, follow_redirects=True) as client:
        responses = [client.get(url) for url in (INDEX,REPORT,NOTE)]
        for response in responses:
            response.raise_for_status()
        return build_snapshot(responses[0].text,responses[1].content,responses[2].content)


def persist(cur, snapshot):
    cur.execute("INSERT INTO service_waiting_snapshot(scope,metadata) VALUES ('sisle-surgery',%s::jsonb) ON CONFLICT(scope) DO UPDATE SET metadata=EXCLUDED.metadata",(json.dumps(snapshot,ensure_ascii=False),))


def run(dry_run=False):
    if dry_run:
        snapshot = fetch_snapshot()
        print(f"Validated {len(snapshot['rows'])} surgical rows; cut {snapshot['cut']}; no writes")
        return
    from common.db import get_pg_conn
    from common.etl_runs import start_run, finish_run
    conn, run_id = get_pg_conn(), None
    try:
        with conn.cursor() as cur:
            run_id = start_run(cur,pipeline='sanidad.espera',chunk_key='sisle-surgery-2025')
        conn.commit()
        snapshot = fetch_snapshot()
        with conn.cursor() as cur:
            persist(cur,snapshot)
            finish_run(cur,run_id=run_id,status='succeeded',rows_read=len(snapshot['rows']))
        conn.commit()
    except Exception as exc:
        conn.rollback()
        if run_id:
            with conn.cursor() as cur:
                finish_run(cur,run_id=run_id,status='failed',error_summary=str(exc)[:500])
            conn.commit()
        raise
    finally:
        conn.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dry-run',action='store_true')
    run(parser.parse_args().dry_run)
