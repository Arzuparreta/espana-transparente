"""Hacienda definitive consolidated expenditure liquidations, bounded 2024 pilot."""
import argparse
import hashlib
import html
import json
import re
from datetime import datetime, timezone
from decimal import Decimal
from io import BytesIO

import httpx
import openpyxl
from presupuestos.ejecucion import norm, CODES, amount

YEAR = 2024
BASE = 'https://serviciostelematicosext.hacienda.gob.es/SGCIEF/PublicacionLiquidaciones/aspx/'
PAGE = BASE + 'menuInicio.aspx'
# Hacienda codes differ from INE codes; these keys match the portal catalog.
TERRITORIES = {
 '01': ('ANDALUCIA', 'Andalucía', 'Junta de Andalucía'),
 '02': ('ARAGON', 'Aragón', 'Comunidad Autónoma de Aragón'),
 '03': ('ASTURIAS', 'Asturias', 'Principado de Asturias'),
 '04': ('ILLES_BALEARS', 'Illes Balears', 'Comunidad Autónoma de Las Illes Balears'),
 '05': ('CANARIAS', 'Canarias', 'Comunidad Autónoma de Canarias'),
 '06': ('CANTABRIA', 'Cantabria', 'Gobierno de Cantabria'),
 '07': ('CASTILLA_Y_LEON', 'Castilla y León', 'Comunidad Autónoma de Castilla y León'),
 '08': ('CASTILLA_LA_MANCHA', 'Castilla-La Mancha', 'Comunidad Autónoma de Castilla-La Mancha'),
 '09': ('CATALUNYA', 'Cataluña', 'Generalitat'),
 '10': ('EXTREMADURA', 'Extremadura', 'Administración General'),
 '11': ('GALICIA', 'Galicia', 'Comunidad Autónoma de Galicia'),
 '12': ('MADRID', 'Madrid', 'Comunidad Autónoma de Madrid'),
 '13': ('MURCIA', 'Murcia', 'Administración General de la Comunidad Autónoma de la Región de Murcia'),
 '14': ('NAVARRA', 'Navarra', 'Gobierno de Navarra'),
 '15': ('PAIS_VASCO', 'País Vasco', 'Administración General'),
 '16': ('LA_RIOJA', 'La Rioja', 'Comunidad Autónoma de La Rioja'),
 '17': ('COMUNITAT_VALENCIANA', 'Comunitat Valenciana', 'Comunidad Autónoma Valenciana'),
}
FIELDS = ['initial', 'credit', 'obligations', 'payments']


def source_url(code):
    return BASE + f'DescargaEconomicaDC.aspx?cdcdad={code}&ano={YEAR}'


def parse_workbook(payload, territory_code, checked_at=None):
    if territory_code not in TERRITORIES or len(payload) > 5_000_000:
        raise ValueError('Out-of-scope liquidation')
    wb = openpyxl.load_workbook(BytesIO(payload), read_only=True, data_only=True)
    try:
        if wb.sheetnames != ['DescargaEconomicaDC']: raise ValueError('Liquidation sheet changed')
        values = list(wb.active.values)
        if len(values) != 48 or any(len(r)>6 for r in values): raise ValueError('Liquidation layout changed')
        if norm(values[7][0]) != norm('Ingresos y Gastos por capítulos. Datos consolidados') or norm(values[8][0]) != norm(f'Liquidación de Presupuestos de las Comunidades Autónomas. Ejercicio {YEAR}'):
            raise ValueError('Liquidation year or consolidation changed')
        if norm(values[9][0]) != norm(TERRITORIES[territory_code][2]) or norm(values[11][4]) != 'MILESDEEUROS':
            raise ValueError('Liquidation territory or unit changed')
        if [norm(v) for v in values[32][:5]] != [norm(v) for v in ['Capítulos de gastos','Presupuesto Inicial','Presupuesto Definitivo','Obligaciones Reconocidas Netas','Pagos Líquidos']]:
            raise ValueError('Liquidation expenditure columns changed')
        rows = {}
        for row in values[34:]:
            label = norm(row[0]);c = None
            if re.match(r'^[1-9][A-Z]',label):c=label[0]
            if label == 'OPERACIONESNOFINANCIERAS':c='NF'
            if label == 'OPERACIONESFINANCIERAS':c='FIN'
            if label == 'TOTALGASTOS':c='TOTAL'
            if c:
                if c in rows:raise ValueError('Duplicate liquidation chapter')
                rows[c] = [None if v is None else amount(v) for v in row[1:5]]
        if set(rows)!=set(CODES):raise ValueError('Missing liquidation chapter')
        for total,parts in [('NF',list('1234567')),('FIN',list('89')),('TOTAL',['NF','FIN'])]:
            for i in range(4):
                if rows[total][i] is None or abs(sum((rows[p][i] or Decimal(0) for p in parts),Decimal(0))-rows[total][i]) > Decimal('0.05'):
                    raise ValueError('Liquidation reconciliation failed')
        meta=dict(source='Hacienda',source_url=source_url(territory_code),page_url=PAGE,year=YEAR,hacienda_code=territory_code,
            perimeter='consolidated_budget',status='definitive',unit='MILES_EUR',mapping_version='hacienda-liquidation-v1',
            retrieved_at=checked_at or datetime.now(timezone.utc).isoformat(),workbook_sha256=hashlib.sha256(payload).hexdigest())
        return [(TERRITORIES[territory_code][0],YEAR,c,*rows[c],'MILES_EUR',json.dumps(meta)) for c in CODES]
    finally:wb.close()


def fetch_records():
    records=[]
    # The official download needs its ASP session, year and territory selection.
    # Connection: close avoids this server's broken persistent connections.
    with httpx.Client(timeout=45,follow_redirects=True,headers={'Connection':'close'}) as client:
        client.get(PAGE).raise_for_status()
        for code in TERRITORIES:
            response=client.get(BASE+'SelDescargaDC.aspx');response.raise_for_status()
            fields={html.unescape(n):html.unescape(v) for n,v in re.findall(r'<input[^>]*name="([^"]+)"[^>]*value="([^"]*)"',response.text)}
            if '__VIEWSTATE' not in fields or '__EVENTVALIDATION' not in fields:raise ValueError('Download form changed')
            fields.update({'ctl00$MainContent$ano':str(YEAR),'ctl00$MainContent$autonomia':code,
                'ctl00$MainContent$tipoConsulta':'../aspx/DescargaEconomicaDC.aspx?cdcdad=',
                'ctl00$MainContent$botonAceptar.x':'10','ctl00$MainContent$botonAceptar.y':'10'})
            response=client.post(BASE+'SelDescargaDC.aspx',data=fields);response.raise_for_status()
            if str(response.url)!=source_url(code):raise ValueError('Download scope changed')
            records.extend(parse_workbook(response.content,code))
    return records


def replace_records(cur, records):
    expected={(t[0],YEAR,c) for t in TERRITORIES.values() for c in CODES}
    if len(records)!=len(expected) or {(r[0],r[1],r[2]) for r in records}!=expected:
        raise ValueError('Refusing incomplete liquidation replacement')
    cur.execute('DELETE FROM autonomic_liquidation WHERE year=%s',(YEAR,))
    cur.executemany('INSERT INTO autonomic_liquidation (territory,year,chapter,initial,credit,obligations,payments,unit,raw_data) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)',records)


def run(dry_run=False):
    if dry_run:
        print(f'Validated {len(fetch_records())} definitive liquidation rows; no database writes');return
    from common.db import get_pg_conn
    from common.etl_runs import start_run, finish_run
    conn,run_id=get_pg_conn(),None
    try:
        with conn.cursor() as cur:run_id=start_run(cur,pipeline='presupuestos.autonomico')
        conn.commit();records=fetch_records()
        with conn.cursor() as cur:
            replace_records(cur,records)
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
