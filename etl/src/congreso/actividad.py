"""Bounded housing activity pilot from Congreso interventions (legislature XV)."""
import argparse
import hashlib
import json
import re
import time
from datetime import datetime, timezone
from urllib.parse import urlparse

from congreso.iniciativas import curl_text, parse_spanish_date, collapse_ws, REQUEST_DELAY

PAGE='https://www.congreso.es/es/opendata/intervenciones'
VERSION='housing-title-words-v1'
SIGNAL=re.compile(r'\b(viviendas?|alquiler(?:es)?|hipotecas?|hipotecari[oa]s?)\b',re.I)


def decode(payload,source_url,checked_at=None):
    if len(payload)>90_000_000 or not re.fullmatch(r'https://www\.congreso\.es/webpublica/opendata/intervenciones/IntervencionesIniciativa__\d+\.json',source_url):
        raise ValueError('Out-of-scope activity dataset')
    raw=json.loads(payload)
    if not isinstance(raw,list) or not raw or len(raw)>100_000 or any(not isinstance(r,dict) for r in raw):
        raise ValueError('Invalid activity universe')
    source_hash=hashlib.sha256(payload.encode()).hexdigest()
    records=[];seen=set();years={};unlocated=0;signals=0
    for r in raw:
        if r.get('LEGISLATURA')!='Leg.15':raise ValueError('Activity legislature changed')
        date=parse_spanish_date(r.get('SESION'))
        title=collapse_ws(r.get('OBJETOINICIATIVA')) or ''
        hit=SIGNAL.search(title)
        if date:
            year=date[:4];years.setdefault(year,{'universe':0,'selected':0,'interventions':0,'voting_records':0})['universe']+=1
        else:unlocated+=1
        if not hit:continue
        signals+=1
        if not date or not r.get('NUMEXPEDIENTE') or not r.get('TIPOINICIATIVA') or r.get('TIPOINTERVENCION') not in ('Intervención','Votación'):
            raise ValueError('Incomplete selected activity')
        docs=[]
        for url in re.findall(r'https://[^\s<>"\']+',r.get('ENLACEPDF','')):
            u=urlparse(url)
            if u.hostname!='www.congreso.es' or not u.path.startswith('/public_oficiales/L15/') or u.username or u.password or u.port:
                raise ValueError('Activity document source changed')
            if url not in docs:docs.append(url)
        if not docs:raise ValueError('Missing selected documentary evidence')
        # The source event identity separates different speakers/turns and votes.
        identity={k:r.get(k) for k in ['LEGISLATURA','NUMEXPEDIENTE','SESION','ORGANO','TIPOINTERVENCION','ORADOR','INICIOINTERVENCION','FININTERVENCION','ENLACEDIFERIDO']}
        key=hashlib.sha256(json.dumps(identity,sort_keys=True,ensure_ascii=False).encode()).hexdigest()
        if key in seen:raise ValueError('Duplicate selected activity identity')
        seen.add(key)
        kind='intervention' if r['TIPOINTERVENCION']=='Intervención' else 'voting_record'
        years[year]['selected']+=1;years[year]['interventions' if kind=='intervention' else 'voting_records']+=1
        records.append((key,15,'housing',date,r['NUMEXPEDIENTE'],title,collapse_ws(r['TIPOINICIATIVA']),kind,
            collapse_ws(r.get('ORGANO')),collapse_ws(r.get('FASE')),collapse_ws(r.get('ORADOR')),
            collapse_ws(r.get('CARGOORADOR')),collapse_ws(r.get('AUTOR')),json.dumps(docs),hit.group(0),VERSION,source_hash))
    if not records or len(records)>5000:raise ValueError('Housing pilot size changed; review scope before expansion')
    metadata=dict(source='Congreso',page_url=PAGE,dataset_url=source_url,dataset_sha256=source_hash,
        retrieved_at=checked_at or datetime.now(timezone.utc).isoformat(),legislature=15,topic='housing',mapping_version=VERSION,
        universe=len(raw),selected=signals,without_title_signal=len(raw)-signals,unlocated_dates=unlocated,years=years)
    return records,metadata


def fetch_records():
    page=curl_text(PAGE)
    links=set(re.findall(r'/webpublica/opendata/intervenciones/IntervencionesIniciativa__\d+\.json',page))
    if len(links)!=1:raise ValueError('Activity discovery changed')
    url='https://www.congreso.es'+links.pop()
    # The download occasionally returns an HTML error body instead of JSON; retry, never parse it.
    for attempt in range(3):
        time.sleep(REQUEST_DELAY+20*attempt)
        payload=curl_text(url)
        try:json.loads(payload)
        except ValueError:
            if attempt==2:raise ValueError(f'Activity dataset was not JSON after 3 attempts: {payload[:80]!r}')
            continue
        return decode(payload,url)


def replace_records(cur,records,metadata):
    if len(records)!=metadata['selected'] or not records or metadata['mapping_version']!=VERSION or metadata['legislature']!=15 or any(tuple(r[1:3])!=(15,'housing') or r[15]!=VERSION or r[16]!=metadata['dataset_sha256'] for r in records):
        raise ValueError('Refusing incomplete activity pilot')
    cur.execute("DELETE FROM parliament_activity WHERE legislature=15 AND topic='housing'")
    cur.executemany('''INSERT INTO parliament_activity (id,legislature,topic,event_date,initiative_number,title,initiative_type,kind,body,phase,speaker,speaker_role,proposer_label,documents,title_signal,mapping_version,dataset_sha256,politician_id,official_id)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)''',records)
    cur.execute("INSERT INTO parliament_activity_coverage(scope,metadata) VALUES ('congreso-15-housing',%s) ON CONFLICT(scope) DO UPDATE SET metadata=EXCLUDED.metadata",(json.dumps(metadata),))


def match_people(cur,records):
    from common.utils import normalize_name
    indexes=[]
    for table,column in [('politicians','full_name'),('public_officials','full_name')]:
        cur.execute(f'SELECT id,{column} FROM {table}')
        index={}
        for pid,name in cur.fetchall():index.setdefault(normalize_name(name),set()).add(str(pid))
        indexes.append(index)
    matched=[]
    for row in records:
        person=re.sub(r'\s*\([^)]*\)\s*$','',row[10] or '').strip()
        variants=[person]
        if person.count(',')==1:
            surname,given=person.split(',');variants.append(f'{given.strip()} {surname.strip()}')
        ids=[]
        for index in indexes:
            candidates=set().union(*(index.get(normalize_name(v),set()) for v in variants))
            ids.append(next(iter(candidates)) if len(candidates)==1 else None)
        matched.append((*row,*ids))
    return matched


def run(dry_run=False):
    if dry_run:
        records,metadata=fetch_records();print(f"Validated {len(records)} selected activity records of {metadata['universe']}; no writes");return
    from common.db import get_pg_conn
    from common.etl_runs import start_run,finish_run
    conn,run_id=get_pg_conn(),None
    try:
        with conn.cursor() as cur:run_id=start_run(cur,pipeline='congreso.actividad')
        conn.commit();records,metadata=fetch_records()
        with conn.cursor() as cur:
            records=match_people(cur,records)
            replace_records(cur,records,metadata)
            finish_run(cur,run_id=run_id,status='succeeded',rows_read=metadata['universe'],rows_inserted=len(records))
        conn.commit()
    except Exception as exc:
        conn.rollback()
        if run_id:
            with conn.cursor() as cur:finish_run(cur,run_id=run_id,status='failed',error_summary=str(exc)[:500])
            conn.commit()
        raise
    finally:conn.close()


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--dry-run',action='store_true');run(p.parse_args().dry_run)
