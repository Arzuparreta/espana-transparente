"""Consolidated PAC payments for FEGA financial exercise 2025; no identities."""
import argparse
import hashlib
import json
import re
import subprocess
import tempfile
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

import httpx

PAGE='https://www.fega.gob.es/datos-abiertos/informes/informe-cierre-ejercicio-2025-datos-consolidados'
PDF='https://www.fega.gob.es/sites/default/files/files/document/PAGOS_FEAGA_FEADER-OCTUBRE-2025_DATOS-CONSOLIDADOS-CIERRE.pdf'
VERSION='pac-payments-2025-v1'
MONEY=re.compile(r'-?(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}')
TERRITORIES={'ANDALUCÍA':'01','ARAGÓN':'02','ASTURIAS':'03','BALEARES':'04','CANARIAS':'05','CANTABRIA':'06','CASTILLA Y LEÓN':'07','CASTILLA-LA MANCHA':'08','CATALUÑA':'09','C. VALENCIANA':'10','EXTREMADURA':'11','GALICIA':'12','MADRID':'13','MURCIA':'14','NAVARRA':'15','PAÍS VASCO':'16','LA RIOJA':'17','F.E.G.A.':'FEGA'}
TABLES=[('feaga','categories','.01','DISTRIBUCIÓN DE LOS PAGOS TOTALES POR TIPOS DE AYUDA.',18,1),('feaga','territories','.02','PAGOS TOTALES POR COMUNIDADES AUTÓNOMAS.',18,1),('feader-2014-2022','categories','.12','DISTRIBUCIÓN DE PAGOS POR MEDIDAS. TOTAL NACIONAL',21,2),('feader-2014-2022','territories','.13','DISTRIBUCIÓN GASTO PÚBLICO POR CC.AA.',18,1),('feader-2023-2027','categories','.32','DISTRIBUCIÓN DE PAGOS POR INTERVENCIÓN. TOTAL NACIONAL.',8,2),('feader-2023-2027','territories','.33','DISTRIBUCIÓN GASTO PÚBLICO POR CC.AA.',18,1)]


def cents(value):
    if not MONEY.fullmatch(value):raise ValueError('Invalid precision in published euro amount')
    result=int(Decimal(value.replace('.','').replace(',','.'))*100)
    if abs(result)>9007199254740991:raise ValueError('Unsafe published euro range')
    return result


def parse_table(text, marker, heading, expected_rows, columns, territories=False):
    pages=[(i+1,p) for i,p in enumerate(text.split('\f')) if heading in p and re.search(rf'{re.escape(marker)}\s*$',p,re.M)]
    if len(pages)!=1:raise ValueError(f'Missing unique PAC table {marker}')
    page,content=pages[0]
    header=next((line for line in content.splitlines() if 'Nº BENEFICIARIOS' in line and ('ACUM' in line)),None)
    if not header:raise ValueError(f'Missing measure header {marker}')
    body=content[content.index(header)+len(header):]
    rows=[];total=None;pending_label=""
    for line in body.splitlines():
        found=list(MONEY.finditer(line))
        if not found:
            continuation=line.strip()
            if re.match(r"^\d+ - ",continuation):
                if pending_label:raise ValueError('Unresolved wrapped label')
                pending_label=continuation
            elif rows and continuation and continuation not in {"cierre’","cierre","25"}:
                if not re.match(r"^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]",continuation):raise ValueError("Unexpected incomplete table row")
                rows[-1]["label"] += " " + continuation
            continue
        if len(found)<columns:raise ValueError(f'Incomplete published row {marker}')
        prefix=line[:found[0].start()].strip()
        label=re.sub(r'(?:^|\s+)\d[\d.]*$','',prefix).strip()
        if not label and pending_label:label,pending_label=pending_label,''
        elif pending_label:raise ValueError('Wrapped category lost its amounts')
        if not label:raise ValueError('Unidentified payment row')
        values=[cents(m.group()) for m in found[:columns]]
        if label=='TOTAL':total=values;break
        code=TERRITORIES.get(label) if territories else (re.match(r'^(\d+) - ',label).group(1) if re.match(r'^(\d+) - ',label) else None)
        if territories and code is None:raise ValueError(f'Unexpected paying body {label}')
        if marker in {'.12','.32'} and code is None:raise ValueError('Missing official measure/intervention code')
        rows.append(dict(label=label,code=code,amounts_cents=values))
    if len(rows)!=expected_rows or total is None:raise ValueError(f'Unexpected complete row coverage {marker}: {len(rows)}')
    if len({r['label'] for r in rows})!=len(rows):raise ValueError('Duplicate payment category')
    if any(sum(r['amounts_cents'][i] for r in rows)!=total[i] for i in range(columns)):raise ValueError(f'Payments do not reconcile {marker}')
    return dict(page=page,rows=rows,total_cents=total)


def build_snapshot(text, sha256, retrieved_at=None):
    if not all(s in text for s in ['Ejercicio 2025 (16/10/24 a 15/10/25)','cierre','FEADER (PERIODO 2014-2022)','FEADER. PEPAC (PERIODO 2023-2027)','Aviso Legal']):raise ValueError('Wrong PAC consolidated edition or financial exercise')
    programmes={key:{} for key in ['feaga','feader-2014-2022','feader-2023-2027']}
    for key,kind,marker,heading,count,columns in TABLES:
        programmes[key][kind]=parse_table(text,marker,heading,count,columns,kind=='territories')
    for key,p in programmes.items():
        if p['categories']['total_cents'][-1]!=p['territories']['total_cents'][0]:raise ValueError('National and paying-body totals disagree')
    return dict(version=VERSION,scope='financial-2025',exercise=2025,period_start='2024-10-16',period_end='2025-10-15',retrieved_at=retrieved_at or datetime.now(timezone.utc).isoformat(),source=dict(page_url=PAGE,pdf_url=PDF,sha256=sha256),programmes=programmes)


def fetch_snapshot():
    with httpx.Client(timeout=60,follow_redirects=True) as client:
        page=client.get(PAGE);page.raise_for_status()
        if PDF.replace('https://www.fega.gob.es','') not in page.text:raise ValueError('Consolidated source document changed')
        chunks=[];size=0
        with client.stream('GET',PDF) as response:
            response.raise_for_status()
            for chunk in response.iter_bytes():
                size+=len(chunk)
                if size>10_000_000:raise ValueError('Oversized source PDF')
                chunks.append(chunk)
    data=b''.join(chunks)
    if not data.startswith(b'%PDF-'):raise ValueError('Invalid source document')
    with tempfile.TemporaryDirectory(prefix='et-pac-') as tmp:
        path=Path(tmp)/'source.pdf';path.write_bytes(data)
        result=subprocess.run(['pdftotext','-layout',str(path),'-'],capture_output=True,check=True,timeout=60)
    return build_snapshot(result.stdout.decode('utf-8'),hashlib.sha256(data).hexdigest())


def persist(cur,snapshot):
    cur.execute("INSERT INTO pac_payment_snapshot(scope,metadata) VALUES ('financial-2025',%s::jsonb) ON CONFLICT(scope) DO UPDATE SET metadata=EXCLUDED.metadata",(json.dumps(snapshot,ensure_ascii=False),))


def run(dry_run=False):
    if dry_run:
        s=fetch_snapshot();print('Reconciled PAC',[(key,len(p['categories']['rows']),len(p['territories']['rows'])) for key,p in s['programmes'].items()]);return
    from common.db import get_pg_conn
    from common.etl_runs import start_run,finish_run
    conn,run_id=get_pg_conn(),None
    try:
        with conn.cursor() as cur:run_id=start_run(cur,pipeline='pac.pagos')
        conn.commit();s=fetch_snapshot()
        with conn.cursor() as cur:
            persist(cur,s);finish_run(cur,run_id=run_id,status='succeeded',rows_read=sum(len(t['rows']) for p in s['programmes'].values() for t in p.values()))
        conn.commit()
    except Exception as exc:
        conn.rollback()
        if run_id:
            with conn.cursor() as cur:finish_run(cur,run_id=run_id,status='failed',error_summary=str(exc)[:500])
            conn.commit()
        raise
    finally:conn.close()

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--dry-run',action='store_true');run(parser.parse_args().dry_run)
