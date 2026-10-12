import json
import os
from pathlib import Path
from unittest.mock import Mock
import pytest
from senado.actividad import catalog,decode,parse_date,replace_records


def test_dates_catalog_and_documented_roles():
    payload='<listaInterpelaciones><iniciativa><tipoExpediente>670</tipoExpediente><numeroExpediente>000001</numeroExpediente><titulo>Interpelación sobre vivienda</titulo><urlPagina>/web/actividadparlamentaria/iniciativas/detalleiniciativa/index.html?legis=15&amp;id1=670&amp;id2=000001</urlPagina><fichero><fichUrl>/web/ficopendataservlet?legis=15&amp;tipoFich=3&amp;tipoEx=670&amp;numEx=000001</fichUrl></fichero></iniciativa></listaInterpelaciones>'
    entries,total=catalog(payload,'interpellation');assert total==1
    xml='<fichaExpediente><datosCabecera><titulo>Interpelación sobre vivienda</titulo><tipo>Interpelación</tipo><fechaPresentacion>22-MAY-2024</fechaPresentacion><legislatura>15</legislatura><numero>670/000001</numero><autores><autor><autorTratam>Persona autora</autorTratam></autor></autores></datosCabecera><intervenciones><intervencion><intNombre>Otra persona</intNombre><intCodAutor>10</intCodAutor><intTotal>1</intTotal></intervencion></intervenciones></fichaExpediente>'
    row=decode(xml,entries[0]);data=json.loads(row[6])
    assert row[4]=='2024-05-22';assert data['authors']==['Persona autora'];assert data['actors'][0]['name']=='Otra persona'
    assert data['actors'][0]['role'] is None and data['documents']==[]
    assert parse_date('29-FEB-2024')=='2024-02-29'
    with pytest.raises(ValueError):parse_date('29-FEB-2023')
    with pytest.raises(ValueError):decode(xml.replace('<legislatura>15','<legislatura>14'),entries[0])


def test_catalog_rejects_external_scope_and_partial_write():
    cur=Mock()
    with pytest.raises(ValueError):catalog('<!DOCTYPE x><listaMociones/>','motion')
    with pytest.raises(ValueError):replace_records(cur,[],{'selected':1})
    cur.execute.assert_not_called()


@pytest.mark.skipif(not os.getenv('TEST_COFOG_DB_URL'),reason='isolated PostgreSQL only')
def test_official_seed_replacement_rollback_and_permissions():
    import psycopg2
    conn=psycopg2.connect(os.environ['TEST_COFOG_DB_URL']);conn.set_client_encoding('UTF8')
    root=Path(__file__).resolve().parents[2]/'supabase/migrations'
    try:
        with conn.cursor() as c:
            for role in ['anon','authenticated','service_role']:
                c.execute('SELECT 1 FROM pg_roles WHERE rolname=%s',(role,))
                if not c.fetchone():c.execute(f'CREATE ROLE {role}')
            base=(root/'20260514180000_multilevel_responsibility.sql').read_text().split('CREATE TABLE IF NOT EXISTS etl_runs (',1)[1].split(');',1)[0]
            c.execute('CREATE TABLE IF NOT EXISTS etl_runs ('+base+');')
            c.execute('DROP TABLE IF EXISTS senate_control_initiatives,senate_control_coverage')
            c.execute((root/'20261012050000_senate_control_activity.sql').read_text())
            c.execute('SELECT kind,count(*) FROM senate_control_initiatives GROUP BY kind ORDER BY kind');assert c.fetchall()==[('interpellation',9),('motion',96)]
            c.execute('SELECT metadata FROM senate_control_coverage');meta=c.fetchone()[0]
            c.execute('SELECT id,legislature,number,kind,presentation_date,title,evidence FROM senate_control_initiatives')
            rows=[(*r[:6],json.dumps(r[6],ensure_ascii=False)) for r in c.fetchall()]
            replace_records(c,rows,meta);replace_records(c,rows,meta)
        conn.commit()
        bad=list(rows[50]);bad[3]='law'
        with pytest.raises(psycopg2.Error):
            with conn.cursor() as c:replace_records(c,[*rows[:50],bad,*rows[51:]],meta)
        conn.rollback()
        with conn.cursor() as c:
            c.execute('SET LOCAL ROLE anon');c.execute('SELECT count(*) FROM senate_control_initiatives');assert c.fetchone()[0]==105
        with pytest.raises(psycopg2.Error):
            with conn.cursor() as c:c.execute('DELETE FROM senate_control_initiatives')
        conn.rollback()
    finally:conn.close()
