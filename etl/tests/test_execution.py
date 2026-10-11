import os
from io import BytesIO
from pathlib import Path

import openpyxl
import pytest
from presupuestos.ejecucion import CODES, parse_workbook, replace_snapshot


def workbook(change=None):
    wb = openpyxl.Workbook(); wb.remove(wb.active)
    facts = {c: [10,8,6,4] for c in list('123456789')}
    facts['5'] = [10,'-','-','-']
    for group,parts in [('NF','1234567'),('FIN','89'),('TOTAL',['NF','FIN'])]:
        facts[group] = [sum(facts[c][i] if facts[c][i] != '-' else 0 for c in parts) for i in range(4)]
    for name in ['GTOS 004','GTOS 013']:
        s=wb.create_sheet(name);s.append([None]*5+['Miles de euros'])
        s.append(['PRESUPUESTO DE GASTOS\n'+('ESTADO DE EJECUCIÓN. CAPÍTULOS' if name=='GTOS 004' else 'PAGOS APLICADOS A PRESUPUESTOS. CAPÍTULOS')+'\nHASTA EL 31 DE DICIEMBRE','2025'])
        headers=['CRÉDITOS DEFINITIVOS (1)','GASTOS COMPROMETIDOS (2)','OBLIGACIONES RECONOCIDAS NETAS (3)','PAGOS REALIZADOS (4)'] if name=='GTOS 004' else ['PRESUPUESTO CORRIENTE (1)','PRESUPUESTOS CERRADOS (2)','TOTAL (3)']
        s.append([None,*headers])
        for code in CODES:
            label = f'{code}. CAPÍTULO' if code.isdigit() else {'NF':'TOTAL OPERACIONES NO FINANCIERAS','FIN':'TOTAL OPERACIONES FINANCIERAS','TOTAL':'TOTALES'}[code]
            data = facts[code] if name=='GTOS 004' else [facts[code][3],2,(facts[code][3] if facts[code][3]!='-' else 0)+2]
            s.append([label,*data])
    if change: change(wb)
    out=BytesIO();wb.save(out);return out.getvalue()


def test_totals_unit_hash_and_current_payments_preserve_dashes():
    rows=parse_workbook(workbook(),checked_at='2026-10-12T00:00:00Z')
    assert len(rows)==12
    assert next(r for r in rows if r[2]=='5')[4:7] == (None,None,None)
    assert next(r for r in rows if r[2]=='NF')[3:7] == (70,48,36,24)
    assert rows[0][7]=='MILES_EUR'
    assert 'current_budget' in rows[0][8]


@pytest.mark.parametrize('issue',['unit','year','cut','headers','missing','duplicate','negative','nan','formula','sum','payments'])
def test_source_changes_retain_previous_snapshot(issue):
    def mutate(wb):
        s=wb['GTOS 004']
        if issue=='unit':s['F1']='Euros'
        if issue=='year':s['B2']='2024'
        if issue=='cut':s['A2']='ESTADO DE EJECUCIÓN. CAPÍTULOS HASTA EL 30 DE NOVIEMBRE'
        if issue=='headers':s['B3']='PAGOS REALIZADOS (4)'
        if issue=='missing':s['A4']='Detalle no reconocido'
        if issue=='duplicate':s['A5']='1. CAPÍTULO'
        if issue=='negative':s['B4']=-1
        if issue=='nan':s['B4']='NaN'
        if issue=='formula':s['B4']='=1+1'
        if issue=='sum':s['B15']=900
        if issue=='payments':wb['GTOS 013']['B4']=3
    with pytest.raises(ValueError):parse_workbook(workbook(mutate))


@pytest.mark.skipif(not os.getenv('TEST_COFOG_DB_URL'),reason='disposable PostgreSQL integration only')
def test_sql_migration_seed_idempotence_rollback_and_permissions():
    import psycopg2
    conn=psycopg2.connect(os.environ['TEST_COFOG_DB_URL']);conn.set_client_encoding('UTF8')
    migrations=Path(__file__).resolve().parents[2]/'supabase/migrations'
    try:
        with conn.cursor() as cur:
            for role in ('anon','authenticated','service_role'):
                cur.execute('SELECT 1 FROM pg_roles WHERE rolname=%s',(role,))
                if not cur.fetchone():cur.execute(f'CREATE ROLE {role}')
            base=(migrations/'20260514180000_multilevel_responsibility.sql').read_text().split('CREATE TABLE IF NOT EXISTS etl_runs (',1)[1].split(');',1)[0]
            cur.execute('CREATE TABLE IF NOT EXISTS etl_runs ('+base+');')
            cur.execute('DROP TABLE IF EXISTS budget_execution')
            cur.execute((migrations/'20261012000000_budget_execution.sql').read_text())
            cur.execute("SELECT credit,obligations,payments FROM budget_execution WHERE chapter='NF'")
            assert cur.fetchone()==(272465015,263369367,256999714)
            records=parse_workbook(workbook())
            other=list(records[0]);other[1]='2024-12'
            cur.execute('INSERT INTO budget_execution VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)',other)
            replace_snapshot(cur,records);replace_snapshot(cur,records)
            cur.execute("SELECT count(*) FROM budget_execution WHERE period='2025-12'");assert cur.fetchone()[0]==12
            cur.execute("SELECT count(*) FROM budget_execution WHERE period='2024-12'");assert cur.fetchone()[0]==1
        conn.commit()
        bad=list(records[0]);bad[3]=-1
        with pytest.raises(psycopg2.Error):
            with conn.cursor() as cur:replace_snapshot(cur,[bad,*records[1:]])
        conn.rollback()
        with conn.cursor() as cur:
            cur.execute('SET LOCAL ROLE anon')
            cur.execute('SELECT count(*) FROM budget_execution');assert cur.fetchone()[0]==13
        with pytest.raises(psycopg2.Error):
            with conn.cursor() as cur:cur.execute('DELETE FROM budget_execution')
        conn.rollback()
    finally:conn.close()
