"""Spain/FEDER 2014-2020 programme phases. Cumulative periods are never summed."""
import argparse
import hashlib
import json
import re
from collections import defaultdict
from datetime import datetime, timezone
from decimal import Decimal

import httpx

BASE='https://cohesiondata.ec.europa.eu'
DATASETS=('99js-gm52','gayr-92qh')
VERSION='cohesion-es-erdf-2014-v1'
REGIONS={'Less developed','More developed','Outermost or Northern Sparsely Populated','REACT-EU','Transition'}
IMPLEMENTATION={'eu_cents':'eu_amount','national_cents':'national_amount','planned_cents':'total_amount','selected_cents':'total_eligible_cost','declared_cents':'total_eligible_expenditure'}
PAYMENTS={'eu_planned_cents':'net_planned_eu_amount','pre_financing_cents':'net_pre_financing','interim_cents':'net_interim_payments','net_payments_cents':'total_net_payments'}


def cents(value, signed=False):
    if value is None:return None
    if not isinstance(value,str) or not re.fullmatch(r'-?\d+(?:\.\d{1,2})?',value):raise ValueError('Invalid source euro precision')
    result=int(Decimal(value)*100)
    if abs(result)>9007199254740991 or (result<0 and not signed):raise ValueError('Invalid source euro range')
    return result


def identity(row, source):
    if row.get('ms')!='ES' or row.get('fund')!='ERDF' or not re.fullmatch(r'2014ES16RF(?:OP|SM)\d{3}',row.get('cci','')) or not row.get('title'):
        raise ValueError('Unexpected programme/fund/country')
    year=row.get('year','')
    if not re.fullmatch(r'20\d{2}',year) or not 2014<=int(year)<=datetime.now(timezone.utc).year:raise ValueError('Invalid cumulative reference year')
    if row.get('category_of_region') not in REGIONS:raise ValueError('Unexpected region category or overlapping total')
    if source==DATASETS[0] and int(year)>2023:raise ValueError('Unexpected implementation reference year for 2014-2020 cycle')
    dims=['cci','fund','category_of_region','year']
    if source==DATASETS[0]:dims+=['priority','to']
    if any(not isinstance(row.get(k),str) or not row[k] or row[k].upper()=='TOTAL' for k in dims):raise ValueError('Incomplete programme key')
    return tuple(row[k] for k in dims)


def aggregate(rows, source):
    seen=set();groups=defaultdict(list)
    mapping=IMPLEMENTATION if source==DATASETS[0] else PAYMENTS
    for row in rows:
        key=identity(row,source)
        if key in seen:raise ValueError('Duplicate programme priority/region/year; no double counting')
        seen.add(key);groups[row['cci'],int(row['year'])].append(row)
        values={field:cents(row.get(column),signed=source==DATASETS[1]) for field,column in mapping.items()}
        fields=['eu_cents','national_cents','planned_cents'] if source==DATASETS[0] else ['pre_financing_cents','interim_cents','net_payments_cents']
        if all(values[k] is not None for k in fields) and values[fields[0]]+values[fields[1]]!=values[fields[2]]:
            raise ValueError('Allocation or net-transfer reconciliation failed')
    periods=defaultdict(list)
    for (cci,year),group in sorted(groups.items()):
        if len({r['title'] for r in group})!=1:raise ValueError('Mixed programme title versions')
        known={};missing={}
        for field,column in mapping.items():
            values=[cents(r.get(column),signed=source==DATASETS[1]) for r in group]
            known[field]=sum(v for v in values if v is not None);missing[field]=sum(v is None for v in values)
            if abs(known[field])>9007199254740991:raise ValueError('Unsafe cumulative aggregate')
        p=dict(year=year,title=group[0]['title'],source_rows=len(group),known=known,missing=missing)
        if source==DATASETS[0]:
            for field in ['ver','ir_last_version','reference_date']:
                values={r.get(field) for r in group}
                if len(values)!=1:raise ValueError('Mixed report/decision periods in one programme')
                p[field]=values.pop()
            if p['reference_date']:
                datetime.fromisoformat(p['reference_date'])
            if not p['ver']:raise ValueError('Programme version missing')
        periods[cci].append(p)
    return periods


def build_snapshot(implementation,payments,metadata,retrieved_at=None,raw_hashes=None):
    a,b=aggregate(implementation,DATASETS[0]),aggregate(payments,DATASETS[1])
    if not a or not b:raise ValueError('Empty financial source; previous edition retained')
    sources={}
    for code in DATASETS:
        meta=metadata[code]
        if meta.get('id')!=code or not isinstance(meta.get('rowsUpdatedAt'),int):raise ValueError('Invalid dataset identity/update')
        sources[code]=dict(url=f'{BASE}/resource/{code}.json?ms=ES&fund=ERDF&%24limit=5000',metadata_url=f'{BASE}/api/views/{code}.json',updated_at=datetime.fromtimestamp(meta['rowsUpdatedAt'],timezone.utc).isoformat(),sha256=(raw_hashes or {}).get(code) or hashlib.sha256(json.dumps(implementation if code==DATASETS[0] else payments,sort_keys=True).encode()).hexdigest())
    return dict(version=VERSION,scope='ES_ERDF_2014_2020',retrieved_at=retrieved_at or datetime.now(timezone.utc).isoformat(),sources=sources,source_rows={DATASETS[0]:len(implementation),DATASETS[1]:len(payments)},programmes=[dict(cci=cci,implementation=a.get(cci,[]),payments=b.get(cci,[])) for cci in sorted(set(a)|set(b))])


def fetch_snapshot():
    rows={};metadata={};hashes={}
    with httpx.Client(timeout=60,follow_redirects=True) as client:
        for code in DATASETS:
            url=f'{BASE}/resource/{code}.json'
            params=dict(ms='ES',fund='ERDF')
            count=client.get(url,params={**params,'$select':'count(*)'});count.raise_for_status()
            expected=int(count.json()[0]['count'])
            minimum=1000 if code==DATASETS[0] else 400
            if not minimum<=expected<5000:raise ValueError('Source scope exceeds contract or is incomplete')
            response=client.get(url,params={**params,'$limit':5000});response.raise_for_status()
            if len(response.content)>5_000_000:raise ValueError('Oversized source')
            rows[code]=response.json()
            if not isinstance(rows[code],list) or len(rows[code])!=expected:raise ValueError('Truncated source response')
            hashes[code]=hashlib.sha256(response.content).hexdigest()
            response=client.get(f'{BASE}/api/views/{code}.json');response.raise_for_status();metadata[code]=response.json()
    return build_snapshot(rows[DATASETS[0]],rows[DATASETS[1]],metadata,raw_hashes=hashes)


def persist(cur,snapshot):
    cur.execute("INSERT INTO cohesion_program_snapshot(scope,metadata) VALUES ('ES_ERDF_2014_2020',%s::jsonb) ON CONFLICT(scope) DO UPDATE SET metadata=EXCLUDED.metadata",(json.dumps(snapshot,ensure_ascii=False),))


def run(dry_run=False):
    if dry_run:
        snapshot=fetch_snapshot();print('Validated FEDER',len(snapshot['programmes']),'programmes',snapshot['source_rows'],'no writes');return
    from common.db import get_pg_conn
    from common.etl_runs import start_run,finish_run
    conn,run_id=get_pg_conn(),None
    try:
        with conn.cursor() as cur:run_id=start_run(cur,pipeline='cohesion.feder')
        conn.commit();snapshot=fetch_snapshot()
        with conn.cursor() as cur:
            persist(cur,snapshot);finish_run(cur,run_id=run_id,status='succeeded',rows_read=sum(snapshot['source_rows'].values()))
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
