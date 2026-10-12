"""ISTAC 2024 municipal liquidation pilot, preserving unavailable published totals."""
import argparse
import hashlib
import json
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

import httpx

VERSION = 'istac-municipal-liquidation-2024-v1'
SOURCE = 'https://datos.canarias.es/api/estadisticas/statistical-resources/v1.0/datasets/ISTAC/E31025B_000018/1.0.json'
PAGE = 'https://datos.canarias.es/catalogos/general/dataset/liquidacion-del-presupuesto-consolidado-de-ingresos-y-gastos-de-las-entidades-locales-segu-20241'
CATALOG = json.loads(Path(__file__).with_name('local_catalog.json').read_text())
DIMENSIONS = ['TIME_PERIOD','TERRITORIO','PRESUPUESTO_ESTADO','MEDIDAS','PRESUPUESTO_PARTIDA']
PHASES = {'initial':'PRESUPUESTO_INICIAL','credit':'PRESUPUESTO_DEFINITIVO','obligations':'PRESUPUESTO_EJECUTADO','payments':'INGRESOS_GASTOS_LIQUIDOS_CORRIENTE'}
PARTS = {str(i):'G_'+str(i) for i in range(1,10)} | {'NF':'GASTOS_OPERACIONES_NO_FINANCIERAS','FIN':'GASTOS_OPERACIONES_FINANCIERAS','TOTAL':'GASTOS'}
MUNICIPALITIES = {r['code']:r['label'] for r in CATALOG['TERRITORIO'] if r['granularity']=='MUNICIPALITIES'}


def label(v):
    return next(n['value'] for n in v['name']['text'] if n['lang']=='es')


def parse_snapshot(payload, checked_at=None):
    if len(payload)>10_000_000:raise ValueError('Local source exceeds bounds')
    s=json.loads(payload);m=s['metadata'];data=s['data']
    if s['id']!='E31025B_000018' or m['version']!='1.0' or m['formatExtentObservations']!=218880 or m['formatExtentDimensions']!=5:
        raise ValueError('Local dataset identity/version/coverage changed')
    md=m['dimensions']['dimension']
    if len(md)!=5 or {d['id'] for d in md}!=set(DIMENSIONS):raise ValueError('Local metadata dimensions changed')
    for d in md:
        values=d['dimensionValues']['value']
        actual=[dict(code=v['id'],label=label(v),**({'granularity':v['geographicGranularity']['id']} if d['id']=='TERRITORIO' else {})) for v in values]
        if sorted(actual,key=lambda r:r['code'])!=sorted(CATALOG[d['id']],key=lambda r:r['code']):raise ValueError('Local scope or labels changed')
        if d['id']=='MEDIDAS':
            measure=next(v for v in values if v['id']=='IMPORTE_PRESUPUESTARIO')['measureQuantity']
            if measure['unitCode']['id']!='EUR' or measure['unitMultiplier']['id']!='0':raise ValueError('Local amount unit changed')
    dims=data['dimensions']['dimension']
    if [d['dimensionId'] for d in dims]!=DIMENSIONS:raise ValueError('Local observation dimension order changed')
    indices={};sizes=[]
    for d in dims:
        reps=d['representations']['representation'];size=d['representations']['total']
        if len(reps)!=size or {r['code'] for r in reps}!={r['code'] for r in CATALOG[d['dimensionId']]} or {r['index'] for r in reps}!=set(range(size)):
            raise ValueError('Local code/index coverage changed')
        sizes.append(size);indices[d['dimensionId']]={r['code']:r['index'] for r in reps}
    attrs=data['attributes']['attribute']
    if len(attrs)!=1 or attrs[0]['id']!='ESTADO_OBSERVACION':raise ValueError('Local observation attributes changed; review flags')
    values=[v.strip() for v in data['observations'].split('|')];flags=[v.strip() for v in attrs[0]['value'].split('|')]
    if len(values)!=218880 or len(flags)!=218880 or set(flags)-{'','O'}:raise ValueError('Local observation coverage/status changed')
    def at(territory,phase,part):
        coords=[0,indices['TERRITORIO'][territory],indices['PRESUPUESTO_ESTADO'][phase],indices['MEDIDAS']['IMPORTE_PRESUPUESTARIO'],indices['PRESUPUESTO_PARTIDA'][part]]
        i=0
        for coordinate,size in zip(coords,sizes):i=i*size+coordinate
        if flags[i]=='O':return None
        if not values[i]:raise ValueError('Missing local value without source status')
        n=Decimal(values[i])
        if not n.is_finite() or n<0 or n>Decimal('100000000000'):raise ValueError('Invalid local amount')
        return n
    records=[];missing=0;reconciled=0
    for code,name in MUNICIPALITIES.items():
        rows={p:[at(code,phase,source_part) for phase in PHASES.values()] for p,source_part in PARTS.items()}
        missing+=sum(v is None for nums in rows.values() for v in nums)
        checks=0
        for i in range(4):
            for total,parts in [('NF',list('1234567')),('FIN',list('89')),('TOTAL',['NF','FIN'])]:
                nums=[rows[p][i] for p in parts];known=rows[total][i]
                if known is not None and all(n is not None for n in nums):
                    if abs(sum(nums)-known)>Decimal('0.10'):raise ValueError('Local chapter reconciliation failed')
                    checks+=1
        reconciled+=checks
        records.append(dict(territory=code,name=name,rows={p:[None if n is None else float(n) for n in nums] for p,nums in rows.items()},reconciled_checks=checks))
    return dict(version=VERSION,year=2024,unit='EUR',source_url=SOURCE,page_url=PAGE,source_version='1.0',source_updated_at=m['lastUpdate'],source_sha256=hashlib.sha256(payload).hexdigest(),retrieved_at=checked_at or datetime.now(timezone.utc).isoformat(),universe=218880,selected_cells=4224,missing_cells=missing,reconciled_checks=reconciled,complete_comparisons=sum(all(n is not None for n in r['rows']['NF']) for r in records),records=records)


def fetch_snapshot():
    with httpx.Client(timeout=60,follow_redirects=True) as c:
        with c.stream('GET',SOURCE) as r:
            r.raise_for_status();chunks=[];size=0
            for chunk in r.iter_bytes():
                size+=len(chunk)
                if size>10_000_000:raise ValueError('Local response exceeds bounds')
                chunks.append(chunk)
    return parse_snapshot(b''.join(chunks))


def save(cur,s):
    if s.get('version')!=VERSION or len(s.get('records',[]))!=88 or {r['territory'] for r in s['records']}!=set(MUNICIPALITIES):raise ValueError('Incomplete local snapshot')
    cur.execute("INSERT INTO local_liquidation_snapshot(scope,metadata) VALUES('canarias-2024',%s) ON CONFLICT(scope) DO UPDATE SET metadata=EXCLUDED.metadata",(json.dumps(s,ensure_ascii=False),))


def run(dry_run=False):
    if dry_run:
        s=fetch_snapshot();print(f"Verified {len(s['records'])} municipalities, {s['missing_cells']} missing cells; no writes");return
    from common.db import get_pg_conn
    from common.etl_runs import start_run,finish_run
    conn,run_id=get_pg_conn(),None
    try:
        with conn.cursor() as cur:run_id=start_run(cur,pipeline='presupuestos.local')
        conn.commit();s=fetch_snapshot()
        with conn.cursor() as cur:
            save(cur,s);finish_run(cur,run_id=run_id,status='succeeded',rows_read=4224,rows_inserted=1)
        conn.commit()
    except Exception as e:
        conn.rollback()
        if run_id:
            with conn.cursor() as cur:finish_run(cur,run_id=run_id,status='failed',error_summary=str(e)[:500])
            conn.commit()
        raise
    finally:conn.close()


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--dry-run',action='store_true');run(p.parse_args().dry_run)
