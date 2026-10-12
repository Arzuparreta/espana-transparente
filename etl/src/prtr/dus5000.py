"""DUS5000 programme allocations and published favourable resolution amounts.

No payments, no individual NIFs, no inferred project completion.
"""
import argparse
import hashlib
import json
import re
from datetime import datetime, timezone
from decimal import Decimal
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup

PROGRAM_URL = 'https://sede.idae.gob.es/node/82'
LIST_URL = 'https://tramitador.idae.gob.es/egovOV-web/app/listadoFavorable-flow?codProcedimiento=D5000'
VERSION = 'idae-dus5000-v1'
HEADERS = ['Número de expediente','NIF','Nombre del beneficiario','Proyecto','Municipio','Provincia','CC.AA.','Fecha última resolución','Ayuda directa concedida(€)']
TERRITORIES = ['ANDALUCÍA','ARAGÓN','PRINCIPADO DE ASTURIAS','ILLES BALEARS','CANARIAS','CANTABRIA','CASTILLA Y LEÓN','CASTILLA-LA MANCHA','CATALUÑA','COMUNITAT VALENCIANA','EXTREMADURA','GALICIA','COMUNIDAD DE MADRID','REGIÓN DE MURCIA','COMUNIDAD FORAL DE NAVARRA','PAÍS VASCO','LA RIOJA']


def text(node):
    return node.get_text(' ',strip=True)


def amount_cents(value, nullable=False):
    if nullable and value in ('','—','-'):
        return None
    if not re.fullmatch(r'(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?',value):
        raise ValueError('Unexpected euro amount')
    cents=int(Decimal(value.replace('.','').replace(',','.'))*100)
    if cents>9007199254740991:raise ValueError('Unsafe euro precision')
    return cents


def parse_program(html):
    soup=BeautifulSoup(html,'html.parser')
    content=text(soup)
    if LIST_URL not in {urljoin(PROGRAM_URL,a['href']) for a in soup.select('a[href]')} or not all(term in content for term in ('DUS 5000','Mecanismo Europeo de Recuperación y Resiliencia','concesión directa')):
        raise ValueError('Unverified programme instrument/list identity')
    tables=[t for t in soup.select('table') if 'PRESUPUESTO FINAL Y DEFINITIVO' in text(t)]
    if len(tables)!=1:raise ValueError('Missing/ambiguous programme budget')
    allocations={};total=None
    for tr in tables[0].select('tr'):
        cells=[text(c) for c in tr.find_all(['td','th'],recursive=False)]
        if len(cells)==2 and re.match(r'^\d{2} ',cells[0]):
            code=cells[0][:2]
            if code in allocations or not 1<=int(code)<=17:raise ValueError('Duplicate/unknown budget territory')
            allocations[code]=amount_cents(cells[1])
        elif cells and cells[0]=='TOTAL':
            if total is not None:raise ValueError('Duplicate programme total')
            total=amount_cents(cells[-1])
    if set(allocations)!={f'{i:02}' for i in range(1,18)} or total!=67500000000 or sum(allocations.values())!=total:
        raise ValueError('Programme allocation reconciliation failed')
    return allocations,total


def parse_projects(html, retrieved_at, minimum_rows=1000):
    soup=BeautifulSoup(html,'html.parser')
    if 'Listado de expedientes favorables D5000' not in text(soup):
        raise ValueError('Wrong programme/phase')
    tables=[t for t in soup.select('table') if [text(c) for c in t.select('th')]==HEADERS]
    if len(tables)!=1:raise ValueError('Missing/ambiguous favourable resolutions table')
    trs=tables[0].select('tbody tr')
    if not minimum_rows<=len(trs)<=5000:raise ValueError('Incomplete/oversized programme list')
    rows=[];seen=set()
    for tr in trs:
        cells=[text(c) for c in tr.find_all('td',recursive=False)]
        if len(cells)!=9:raise ValueError('Unexpected project fields')
        identifier,nif,beneficiary,project,municipality,province,territory,resolved,amount=cells
        if not re.fullmatch(r'PR-D5000-20(?:21|22)-\d{6}[A-Z]?',identifier) or identifier in seen or not beneficiary or territory not in TERRITORIES:
            raise ValueError('Duplicate/unknown project identity or scope')
        resolved_at=datetime.strptime(resolved,'%d-%m-%Y').date().isoformat()
        if not '2021-01-01'<=resolved_at<=retrieved_at[:10]:raise ValueError('Invalid resolution period')
        seen.add(identifier)
        rows.append(dict(id=identifier,beneficiary=beneficiary,project=project or None,municipality=municipality or None,province=province or None,territory=f'{TERRITORIES.index(territory)+1:02}',last_resolution=resolved_at,grant_cents=amount_cents(amount,nullable=True)))
    return sorted(rows,key=lambda r:r['id'])


def build_snapshot(program_html,list_html,retrieved_at=None):
    retrieved_at=retrieved_at or datetime.now(timezone.utc).isoformat()
    allocations,total=parse_program(program_html)
    rows=parse_projects(list_html,retrieved_at)
    known=[r['grant_cents'] for r in rows if r['grant_cents'] is not None]
    if sum(known)>9007199254740991:raise ValueError('Unsafe aggregate precision')
    return dict(version=VERSION,instrument='MRR/PRTR',financing='grant',phase='last-published-grant',program='DUS5000',program_url=PROGRAM_URL,list_url=LIST_URL,retrieved_at=retrieved_at,sha256={'programme':hashlib.sha256(program_html.encode()).hexdigest(),'list':hashlib.sha256(list_html.encode()).hexdigest()},budget_cents=total,territories=[dict(code=f'{i+1:02}',label=label,budget_cents=allocations[f'{i+1:02}']) for i,label in enumerate(TERRITORIES)],summary=dict(records=len(rows),known_grant_cents=sum(known),unknown_amounts=len(rows)-len(known),zero_amounts=sum(v==0 for v in known),unknown_projects=sum(r['project'] is None for r in rows)),rows=rows)


def fetch_snapshot():
    with httpx.Client(timeout=60,follow_redirects=True) as client:
        responses=[client.get(u) for u in (PROGRAM_URL,LIST_URL)]
        for response in responses:
            response.raise_for_status()
            if len(response.content)>10_000_000:raise ValueError('Oversized source')
        return build_snapshot(*(r.text for r in responses))


def persist(cur,snapshot):
    cur.execute("INSERT INTO prtr_program_snapshot(program,metadata) VALUES ('DUS5000',%s::jsonb) ON CONFLICT(program) DO UPDATE SET metadata=EXCLUDED.metadata",(json.dumps(snapshot,ensure_ascii=False),))


def run(dry_run=False):
    if dry_run:
        snapshot=fetch_snapshot();print('Validated DUS5000:',snapshot['summary'],'no writes');return
    from common.db import get_pg_conn
    from common.etl_runs import start_run,finish_run
    conn,run_id=get_pg_conn(),None
    try:
        with conn.cursor() as cur:run_id=start_run(cur,pipeline='prtr.dus5000')
        conn.commit()
        snapshot=fetch_snapshot()
        with conn.cursor() as cur:
            persist(cur,snapshot)
            finish_run(cur,run_id=run_id,status='succeeded',rows_read=len(snapshot['rows']))
        conn.commit()
    except Exception as exc:
        conn.rollback()
        if run_id:
            with conn.cursor() as cur:finish_run(cur,run_id=run_id,status='failed',error_summary=str(exc)[:500])
            conn.commit()
        raise
    finally:conn.close()


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--dry-run',action='store_true')
    run(parser.parse_args().dry_run)
