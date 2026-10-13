"""Link approved XV bills to publications via their official PDFs and BOE CVE."""
from __future__ import annotations
import argparse,hashlib,json,re,subprocess,tempfile,time
import xml.etree.ElementTree as ET
from datetime import datetime,timezone
from urllib.parse import urlencode,urljoin,urlparse
from bs4 import BeautifulSoup
from congreso.iniciativas import UA,REQUEST_DELAY,discover_current_sources,curl_text
VERSION='congress-xv-publications-v1'

def sha(payload):return hashlib.sha256(payload).hexdigest()
def date(raw):
    if not raw:return None
    if not isinstance(raw,str) or not re.fullmatch(r'\d{8}',raw):raise ValueError('Invalid BOE date')
    return datetime.strptime(raw,'%Y%m%d').date().isoformat()

def approved(payload):
    records=json.loads(payload)
    if not isinstance(records,list) or not records or len(records)>250:raise ValueError('Bill catalogue outside pilot bounds')
    out=[];seen=set()
    for r in records:
        if not isinstance(r,dict) or r.get('LEGISLATURA')!='Leg.15':raise ValueError('Bill catalogue legislature changed')
        if 'Aprobado' not in r.get('RESULTADOTRAMITACION',''):continue
        number=r.get('NUMEXPEDIENTE','').removesuffix('/0000')
        if not re.fullmatch(r'121/\d{6}',number) or number in seen or not r.get('OBJETO'):raise ValueError('Invalid approved bill identity')
        seen.add(number);out.append((number,r['OBJETO']))
    if not out or len(out)>150:raise ValueError('Approved bill selection outside bounds')
    return out,len(records)

def fiche_url(number):
    return 'https://www.congreso.es/es/busqueda-de-iniciativas?'+urlencode({'_iniciativas_id':number,'_iniciativas_legislatura':'XV','_iniciativas_mode':'mostrarDetalle','p_p_id':'iniciativas','p_p_lifecycle':'0','p_p_mode':'view','p_p_state':'normal'})

def fiche(payload,number):
    if len(payload)>2_000_000:raise ValueError('Bill fiche too large')
    soup=BeautifulSoup(payload,'html.parser')
    heads=[n.get_text(' ',strip=True) for n in soup.select('h2.titular-seccion')]
    intro=soup.select_one('.entradilla-iniciativa')
    if 'XV Legislatura' not in heads or not intro or not intro.get_text(' ',strip=True).endswith(f'({number})'):raise ValueError('Bill fiche identity mismatch')
    docs=[]
    for li in soup.select('ul.boes > li'):
        links=li.find_all('a',href=True)
        if len(links)!=1:raise ValueError('Publication link coverage changed')
        url=urljoin('https://www.congreso.es',links[0]['href'])
        if not re.fullmatch(r'https://www\.congreso\.es/constitucion/ficheros/leyes_espa/[a-zA-Z0-9_]+\.pdf',url):raise ValueError('Untrusted publication PDF')
        citation=li.get_text(' ',strip=True)
        m=re.search(r'BOE Núm:\s*(\d+) de (\d{2})/(\d{2})/(\d{4})',citation)
        if not m:raise ValueError('Publication date missing')
        docs.append(dict(citation=citation,pdf_url=url,publication_date=date(m[4]+m[3]+m[2]),diary_number=m[1]))
    if not docs or len(docs)>5 or len({d['pdf_url'] for d in docs})!=len(docs):raise ValueError('Approved bill has incomplete publication evidence')
    return docs

def cve(text):
    ids=set(re.findall(r'cve:\s*(BOE-A-\d{4}-\d+)',text,re.I))
    if len(ids)!=1:raise ValueError('Publication PDF has ambiguous or missing CVE')
    return next(iter(ids)).upper()

def boe(payload,bid,document):
    if len(payload)>5_000_000 or b'<!DOCTYPE' in payload.upper() or b'<!ENTITY' in payload.upper():raise ValueError('Unsafe BOE XML')
    root=ET.fromstring(payload);md=root.find('metadatos')
    if md is None:raise ValueError('BOE metadata missing')
    fields={n.tag:''.join(n.itertext()).strip() for n in md}
    if fields.get('identificador')!=bid or date(fields.get('fecha_publicacion'))!=document['publication_date'] or fields.get('diario_numero')!=document['diary_number']:raise ValueError('BOE publication identity/date mismatch')
    title=fields.get('titulo','');correction=title.casefold().startswith('corrección de errores')
    if not title or (not correction and fields.get('rango') not in ('Ley','Ley Orgánica')):raise ValueError('Unexpected publication kind')
    pdf=fields.get('url_pdf','')
    if not re.fullmatch(r'https://www\.boe\.es/boe/dias/\d{4}/\d{2}/\d{2}/pdfs/'+re.escape(bid)+r'\.pdf',pdf):raise ValueError('BOE PDF identity mismatch')
    # Keep the source date literally; statutory dates may precede publication.
    return dict(boe_id=bid,title=title,kind='correction' if correction else 'law',
        commencement_date=None if correction else date(fields.get('fecha_vigencia')),official_pdf_url=pdf,
        boe_url=f'https://www.boe.es/diario_boe/txt.php?id={bid}',xml_url=f'https://www.boe.es/diario_boe/xml.php?id={bid}',
        xml_sha256=sha(payload),boe_updated_at=root.get('fecha_actualizacion'),
        status={k:fields.get(k) or None for k in ('estatus_derogacion','judicialmente_anulada','vigencia_agotada')},
        **document)

def fetch_bytes(url,limit=50_000_000):
    r=subprocess.run(['curl','-fsSL','--connect-timeout','10','--max-time','45','--max-filesize',str(limit),'-H',f'User-Agent: {UA}',url],capture_output=True,check=True,timeout=50)
    if len(r.stdout)>limit:raise ValueError('Publication response exceeds bounds')
    time.sleep(REQUEST_DELAY);return r.stdout

def pdf_text(payload):
    if not payload.startswith(b'%PDF-') or len(payload)>50_000_000:raise ValueError('Invalid publication PDF')
    with tempfile.TemporaryDirectory(prefix='et-publication-') as temp:
        from pathlib import Path
        path=Path(temp)/'document.pdf';path.write_bytes(payload)
        return subprocess.run(['pdftotext','-layout',str(path),'-'],capture_output=True,check=True,timeout=30).stdout.decode('utf-8')

def fetch_fiche(url,number,attempts=3,sleep=time.sleep):
    # congreso.es intermittently answers the detail URL with the generic search page
    # (same title, no record intro). Retry before treating it as a real mismatch.
    for attempt in range(attempts):
        sleep(REQUEST_DELAY+20*attempt)
        html=fetch_bytes(url,2_000_000).decode('utf-8')
        try:return html,fiche(html,number)
        except ValueError as exc:
            if str(exc)!='Bill fiche identity mismatch' or attempt==attempts-1:raise

def fetch_snapshot():
    sources=[s for s in discover_current_sources() if s['dataset']=='ProyectosDeLey']
    if len(sources)!=1:raise ValueError('Bill source discovery changed')
    source=sources[0]['url'];payload=curl_text(source);selection,universe=approved(payload);records=[];bytes_read=0
    for number,title in selection:
        url=fiche_url(number);html,documents=fetch_fiche(url,number);docs=[]
        for d in documents:
            time.sleep(REQUEST_DELAY)  # congreso.es rate limit: never burst fiche/PDF requests
            pdf=fetch_bytes(d['pdf_url']);bytes_read+=len(pdf)
            if bytes_read>200_000_000:raise ValueError('Publication PDF batch exceeds maintenance budget')
            bid=cve(pdf_text(pdf));xml=fetch_bytes(f'https://www.boe.es/diario_boe/xml.php?id={bid}',5_000_000)
            docs.append(boe(xml,bid,d)|dict(pdf_sha256=sha(pdf)))
        records.append(dict(number=number,title=title,source_url=url,fiche_sha256=sha(html.encode()),documents=docs))
    return dict(version=VERSION,legislature=15,dataset_url=source,dataset_sha256=sha(payload.encode()),universe=universe,selected=len(records),
        documents=sum(len(r['documents']) for r in records),retrieved_at=datetime.now(timezone.utc).isoformat(),records=records)

def save(cur,s):
    if s.get('version')!=VERSION or not s.get('records') or len(s['records'])!=s['selected'] or sum(len(r['documents']) for r in s['records'])!=s['documents']:raise ValueError('Incomplete publication snapshot')
    cur.execute("INSERT INTO law_publication_snapshot(scope,metadata) VALUES ('congress-xv-bills',%s) ON CONFLICT(scope) DO UPDATE SET metadata=EXCLUDED.metadata",(json.dumps(s,ensure_ascii=False),))

def run(dry_run=False):
    if dry_run:
        s=fetch_snapshot();print(f"Verified {s['selected']} approved bills and {s['documents']} publications; no writes");return
    from common.db import get_pg_conn
    from common.etl_runs import start_run,finish_run
    conn,run_id=get_pg_conn(),None
    try:
        with conn.cursor() as cur:run_id=start_run(cur,pipeline='congreso.publicacion')
        conn.commit();s=fetch_snapshot()
        with conn.cursor() as cur:
            save(cur,s);finish_run(cur,run_id=run_id,status='succeeded',rows_read=s['documents'],rows_inserted=1)
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
