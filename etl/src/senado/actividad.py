"""Senate housing control-initiative pilot: filing, roles, process and sources."""
import argparse
import hashlib
import json
import re
import xml.etree.ElementTree as ET
from datetime import date,datetime,timezone
from urllib.parse import urljoin,urlparse,parse_qs
from congreso.actividad import SIGNAL,VERSION
from senado.votaciones import curl_text

BASE='https://www.senado.es'
PAGE=BASE+'/web/relacionesciudadanos/datosabiertos/catalogodatos/index.html?lang=es_ES'
SOURCES={'interpellation':BASE+'/web/ficopendataservlet?legis=15&tipoFich=15','motion':BASE+'/web/ficopendataservlet?legis=15&tipoFich=16'}
MONTHS={'ENE':1,'FEB':2,'MAR':3,'ABR':4,'MAY':5,'JUN':6,'JUL':7,'AGO':8,'SEP':9,'OCT':10,'NOV':11,'DIC':12}


def xml(text):
    if len(text)>5_000_000 or re.search(r'<!DOCTYPE|<!ENTITY',text,re.I):raise ValueError('Unexpected Senate XML')
    return ET.fromstring(text)


def text(node,key):
    value=node.findtext(key)
    return (re.sub(r'\s+',' ',value).strip() or None) if value else None


def parse_date(value):
    if not value:return None
    match=re.fullmatch(r'(\d{2})-([A-Z]{3})-(\d{4})',value)
    if not match or match[2] not in MONTHS:raise ValueError('Senate date format changed')
    return date(int(match[3]),MONTHS[match[2]],int(match[1])).isoformat()


def official_url(value):
    url=urljoin(BASE,value or '')
    u=urlparse(url)
    if u.scheme not in ('http','https') or u.hostname not in ('www.senado.es','www.congreso.es','www.boe.es') or u.username or u.password or u.port:
        raise ValueError('Senate evidence host changed')
    return u._replace(scheme='https').geturl()


def catalog(payload,kind):
    root=xml(payload)
    if root.tag!={'motion':'listaMociones','interpellation':'listaInterpelaciones'}[kind]:raise ValueError('Senate catalog changed')
    entries=[];seen=set();universe=root.findall('iniciativa')
    for r in universe:
        title=text(r,'titulo') or '';hit=SIGNAL.search(title)
        if not hit:continue
        number=f"{text(r,'tipoExpediente')}/{text(r,'numeroExpediente')}"
        if not re.fullmatch(r'\d{3}/\d{6}',number) or number in seen:raise ValueError('Senate catalog identity changed')
        seen.add(number);source=official_url(text(r,'fichero/fichUrl'));params=parse_qs(urlparse(source).query)
        if params!={'legis':['15'],'tipoFich':['3'],'tipoEx':[number.split('/')[0]],'numEx':[number.split('/')[1]]}:raise ValueError('Senate detail scope changed')
        entries.append(dict(number=number,kind=kind,source_url=source,page_url=official_url(text(r,'urlPagina')),title_signal=hit.group(0)))
    if not entries or len(entries)>150:raise ValueError('Review Senate housing scope before expansion')
    return entries,len(universe)


def decode(payload,entry,checked_at=None):
    root=xml(payload)
    if root.tag!='fichaExpediente' or text(root,'datosCabecera/legislatura')!='15' or text(root,'datosCabecera/numero')!=entry['number']:
        raise ValueError('Senate detail identity changed')
    title=text(root,'datosCabecera/titulo');kind_label=text(root,'datosCabecera/tipo');hit=SIGNAL.search(title or '')
    if not title or not kind_label or not hit:raise ValueError('Senate title signal changed between catalog and detail')
    presentation=parse_date(text(root,'datosCabecera/fechaPresentacion'))
    actors=[dict(name=text(n,'intNombre'),source_id=text(n,'intCodAutor'),role=text(n,'intCargo'),registered_total=text(n,'intTotal')) for n in root.findall('intervenciones/intervencion')]
    stages=[dict(date=parse_date(text(n,'tramFecha')),description=text(n,'tramDescripcion')) for n in root.findall('tramitaciones/tramitacion')]
    sessions=[dict(date=parse_date(text(n,'sesFecha')),body=text(n,'sesNombreOrgano'),source_id=text(n,'sesCodOrgano'),number=text(n,'sesNumero'),convocation=text(n,'sesNumeroConv'),state=text(n,'sesEstado')) for n in root.findall('sesiones/sesion')]
    docs=[]
    for path,prefix,kind in [('publicaciones/boletines/boletin','bol','bulletin'),('publicaciones/diariosSesiones/diarioSesiones','ds','diary'),('publicaciones/boes/boe','boe','boe')]:
        for n in root.findall(path):
            value=text(n,prefix+'URL')
            if value:docs.append(dict(url=official_url(value),original_url=value,kind=kind,date=parse_date(text(n,prefix+'Fecha')),label=text(n,prefix+'Descripcion')))
    data=dict(title=title,official_type=kind_label,status=text(root,'datosCabecera/situacion'),presentation=presentation,
        qualification=parse_date(text(root,'datosCabecera/fechaCalificacion')),authors=[text(n,'autorTratam') for n in root.findall('datosCabecera/autores/autor')],
        official_topics=[n.text.strip() for n in root.findall('datosCabecera/areasTematicas/areaTematica') if n.text],
        committees=[n.text.strip() for n in root.findall('datosCabecera/organosCompetentes/organoCompetente') if n.text],
        actors=actors,stages=stages,sessions=sessions,documents=docs,source_url=entry['source_url'],page_url=entry['page_url'],
        title_signal=hit.group(0),mapping_version=VERSION,legislature=15,number=entry['number'],kind=entry['kind'],
        xml_sha256=hashlib.sha256(payload.encode()).hexdigest(),retrieved_at=checked_at or datetime.now(timezone.utc).isoformat())
    return ('15/'+entry['number'],15,entry['number'],entry['kind'],presentation,title,json.dumps(data,ensure_ascii=False))


def fetch_records():
    records=[];metadata=dict(source='Senado',page_url=PAGE,legislature=15,mapping_version=VERSION,topic='housing',catalogs={},years={},undated=0)
    for kind,url in SOURCES.items():
        payload=curl_text(url);entries,universe=catalog(payload,kind)
        metadata['catalogs'][kind]=dict(url=url,universe=universe,selected=len(entries),sha256=hashlib.sha256(payload.encode()).hexdigest())
        for entry in entries:
            row=decode(curl_text(entry['source_url']),entry);records.append(row)
            if row[4]:metadata['years'][row[4][:4]]=metadata['years'].get(row[4][:4],0)+1
            else:metadata['undated']+=1
    metadata['selected']=len(records);metadata['retrieved_at']=datetime.now(timezone.utc).isoformat()
    return records,metadata


def replace_records(cur,records,metadata):
    if len(records)!=metadata['selected'] or len({r[0] for r in records})!=len(records) or not records or any(r[1]!=15 for r in records):
        raise ValueError('Incomplete Senate snapshot')
    cur.execute('DELETE FROM senate_control_initiatives WHERE legislature=15')
    cur.executemany('INSERT INTO senate_control_initiatives(id,legislature,number,kind,presentation_date,title,evidence) VALUES (%s,%s,%s,%s,%s,%s,%s)',records)
    cur.execute("INSERT INTO senate_control_coverage(scope,metadata) VALUES ('senate-15-housing',%s) ON CONFLICT(scope) DO UPDATE SET metadata=EXCLUDED.metadata",(json.dumps(metadata),))


def run(dry_run=False):
    if dry_run:
        records,metadata=fetch_records();print(f"Validated {len(records)} Senate initiatives; no writes");return
    from common.db import get_pg_conn
    from common.etl_runs import start_run,finish_run
    conn,run_id=get_pg_conn(),None
    try:
        with conn.cursor() as cur:run_id=start_run(cur,pipeline='senado.actividad')
        conn.commit();records,metadata=fetch_records()
        with conn.cursor() as cur:
            replace_records(cur,records,metadata)
            finish_run(cur,run_id=run_id,status='succeeded',rows_read=len(records),rows_inserted=len(records))
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
