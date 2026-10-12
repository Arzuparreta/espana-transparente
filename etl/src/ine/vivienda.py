"""INE IPV base 2025: comparable purchase price evolution, not price levels."""
from __future__ import annotations
import argparse,hashlib,json,math
from pathlib import Path
from datetime import datetime,timezone
from ine.client import fetch_json
SOURCE='https://servicios.ine.es/wstempus/js/ES/DATOS_TABLA/79563?nult=100'
VERSION='ipv-2025-v1'
TERRITORIES=['Nacional','Andalucía','Aragón','Asturias, Principado de','Balears, Illes','Canarias','Cantabria','Castilla y León','Castilla - La Mancha','Cataluña','Comunitat Valenciana','Extremadura','Galicia','Madrid, Comunidad de','Murcia, Región de','Navarra, Comunidad Foral de','País Vasco','Rioja, La','Ceuta','Melilla']
TYPES={'general':'General','new':'Vivienda nueva','used':'Vivienda segunda mano'}
MEASURES={'index':('Índice',133),'annual':('Variación anual',135),'quarterly':('Variación trimestral',135)}
EXPECTED=json.loads(Path(__file__).with_name('ipv_series.json').read_text())

def decode(payload):
    if not isinstance(payload,list) or len(payload)!=240:raise ValueError('IPV catalogue changed')
    indexed={s['Nombre'].strip():s for s in payload}
    if len(indexed)!=240 or {k:s['COD'] for k,s in indexed.items()}!=EXPECTED:raise ValueError('IPV dimensions or codes changed')
    parsed={};missing=[];common=None
    for n,territory in enumerate(TERRITORIES):
        code='00' if n==0 else f'{n:02d}'
        for kind,label in TYPES.items():
            series={};empty=territory in ['Ceuta','Melilla'] and kind!='general'
            for key,(measure,unit) in MEASURES.items():
                s=indexed[f'{territory}. {label}. {measure}.']
                if s.get('FK_Unidad')!=unit or s.get('FK_Escala')!=1:raise ValueError('IPV unit changed')
                points={}
                for p in s.get('Data',[]):
                    year,quarter,value=p.get('Anyo'),p.get('FK_Periodo'),p.get('Valor')
                    if not isinstance(year,int) or isinstance(year,bool) or not isinstance(quarter,int) or not 19<=quarter<=22:raise ValueError('Invalid IPV quarter')
                    ordinal=year*4+quarter-19
                    if year>datetime.now(timezone.utc).year or ordinal in points or p.get('FK_TipoDato')!=1 or p.get('Secreto') is not False or isinstance(value,bool) or not isinstance(value,(int,float)) or not math.isfinite(value) or (key=='index' and value<=0):raise ValueError('Invalid IPV observation')
                    points[ordinal]=value
                if empty and points:raise ValueError('IPV city breakdown now available: review scope')
                if not empty and not points:raise ValueError('IPV series unexpectedly empty')
                series[key]=points
            if empty:missing.append(dict(territory=code,kind=kind));continue
            periods=set(series['index'])
            if any(set(p)!=periods for p in series.values()):raise ValueError('IPV editions have different periods')
            base=[series['index'].get(2025*4+q) for q in range(4)]
            if any(v is None for v in base) or abs(sum(base)/4-100)>.002:raise ValueError('IPV base is not 2025')
            selected={p for p in periods if p>=2020*4}
            if not selected or len(selected)>100 or sorted(selected)!=list(range(min(selected),max(selected)+1)):raise ValueError('Incomplete IPV timeline')
            if common is None:common=selected
            elif selected!=common:raise ValueError('IPV territory periods disagree')
            for ordinal in selected:
                for key,offset in [('annual',4),('quarterly',1)]:
                    previous=series['index'].get(ordinal-offset)
                    if previous is None or abs((series['index'][ordinal]/previous-1)*100-series[key][ordinal])>.065:raise ValueError('IPV rate does not reconcile with indices')
            parsed[(code,kind)]=series
    rows=[]
    for period in sorted(common):
        for (code,kind),s in parsed.items():rows.append(dict(period=f'{period//4}-Q{period%4+1}',territory=code,kind=kind,**{k:v[period] for k,v in s.items()}))
    return dict(version=VERSION,base=2025,source_url=SOURCE,source_sha256=hashlib.sha256(json.dumps(payload,ensure_ascii=False,sort_keys=True).encode()).hexdigest(),
                retrieved_at=datetime.now(timezone.utc).isoformat(),territories={('00' if n==0 else f'{n:02d}'):name for n,name in enumerate(TERRITORIES)},missing=missing,rows=rows)

def save(cur,s):
    if s.get('version')!=VERSION or not s.get('rows'):raise ValueError('Invalid IPV snapshot')
    cur.execute("INSERT INTO housing_price_snapshot(scope,metadata) VALUES ('ipv-national-regions',%s) ON CONFLICT(scope) DO UPDATE SET metadata=EXCLUDED.metadata",(json.dumps(s,ensure_ascii=False),))

def run(dry_run=False):
    if dry_run:
        s=decode(fetch_json(SOURCE));print(f"Validated {len(s['rows'])} IPV records; {len(s['missing'])} unavailable breakdowns; no writes");return
    from common.db import get_pg_conn
    from common.etl_runs import start_run,finish_run
    conn,run_id=get_pg_conn(),None
    try:
        with conn.cursor() as cur:run_id=start_run(cur,pipeline='ine.vivienda')
        conn.commit();s=decode(fetch_json(SOURCE))
        with conn.cursor() as cur:
            save(cur,s);finish_run(cur,run_id=run_id,status='succeeded',rows_read=len(s['rows']),rows_inserted=1)
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
