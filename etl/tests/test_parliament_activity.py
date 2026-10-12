import json
import os
from pathlib import Path
from unittest.mock import Mock
import pytest
from congreso.actividad import decode,replace_records,match_people,VERSION
URL='https://www.congreso.es/webpublica/opendata/intervenciones/IntervencionesIniciativa__20261011050103.json'


def record(**changes):
    return dict(LEGISLATURA='Leg.15',SESION='01/01/2024',OBJETOINICIATIVA='Sobre vivienda y alquiler',NUMEXPEDIENTE='180/000001/0000',TIPOINICIATIVA='Pregunta oral',TIPOINTERVENCION='Intervención',ORADOR='Persona Apellido, Nombre (GP)',ORGANO='Pleno',ENLACEDIFERIDO='https://app.congreso.es/evento1',ENLACEPDF='https://www.congreso.es/public_oficiales/L15/CONG/DS/PL/1.PDF#page=2')|changes


def test_reconciles_title_selection_and_preserves_event_kind_and_provenance():
    rows,meta=decode(json.dumps([record(),record(TIPOINTERVENCION='Votación',ORADOR=None,ENLACEDIFERIDO='evento2'),record(OBJETOINICIATIVA='Problemas que está viviendo la ciudadanía')]),URL)
    assert len(rows)==2 and meta['universe']==3 and meta['without_title_signal']==1
    assert meta['years']['2024']==dict(universe=3,selected=2,interventions=1,voting_records=1)
    assert rows[1][7]=='voting_record' and rows[1][10] is None
    assert rows[0][15]==VERSION and rows[0][16]==meta['dataset_sha256']


@pytest.mark.parametrize('change',[{'LEGISLATURA':'Leg.14'},{'ENLACEPDF':'https://evil.test/document'},{'SESION':'invalid'},{'NUMEXPEDIENTE':None},{'TIPOINTERVENCION':'unknown'}])
def test_invalid_selected_record_rejects_whole_snapshot(change):
    with pytest.raises(ValueError):decode(json.dumps([record(**change)]),URL)


def test_duplicate_identity_and_partial_write_fail_closed():
    with pytest.raises(ValueError):decode(json.dumps([record(),record()]),URL)
    rows,meta=decode(json.dumps([record()]),URL);cur=Mock()
    with pytest.raises(ValueError):replace_records(cur,[],meta)
    cur.execute.assert_not_called()


def test_person_link_requires_one_exact_candidate_not_a_guess():
    cur=Mock();cur.fetchall.side_effect=[[('one','Nombre Persona Apellido'),('two','Nombre Persona Apellido')],[]]
    rows,_=decode(json.dumps([record()]),URL)
    assert match_people(cur,rows)[0][-2:]==(None,None)
    cur=Mock();cur.fetchall.side_effect=[[('one','Nombre Persona Apellido')],[]]
    assert match_people(cur,rows)[0][-2:]==('one',None)


@pytest.mark.skipif(not os.getenv('TEST_COFOG_DB_URL'),reason='isolated PostgreSQL only')
def test_real_seed_atomic_refresh_and_read_permissions():
    import psycopg2
    conn=psycopg2.connect(os.environ['TEST_COFOG_DB_URL']);conn.set_client_encoding('UTF8')
    root=Path(__file__).resolve().parents[2]/'supabase/migrations'
    try:
        with conn.cursor() as cur:
            for role in ['anon','authenticated','service_role']:
                cur.execute('SELECT 1 FROM pg_roles WHERE rolname=%s',(role,))
                if not cur.fetchone():cur.execute(f'CREATE ROLE {role}')
            cur.execute('CREATE TABLE IF NOT EXISTS politicians(id uuid PRIMARY KEY,full_name text)')
            cur.execute('CREATE TABLE IF NOT EXISTS public_officials(id uuid PRIMARY KEY,full_name text)')
            base=(root/'20260514180000_multilevel_responsibility.sql').read_text().split('CREATE TABLE IF NOT EXISTS etl_runs (',1)[1].split(');',1)[0]
            cur.execute('CREATE TABLE IF NOT EXISTS etl_runs ('+base+');')
            cur.execute('DROP TABLE IF EXISTS parliament_activity,parliament_activity_coverage')
            cur.execute((root/'20261012040000_parliament_activity.sql').read_text())
            cur.execute("SELECT kind,count(*) FROM parliament_activity GROUP BY kind ORDER BY kind")
            assert cur.fetchall()==[('intervention',1362),('voting_record',67)]
            cur.execute('SELECT metadata FROM parliament_activity_coverage');meta=cur.fetchone()[0]
            cur.execute('SELECT id,legislature,topic,event_date,initiative_number,title,initiative_type,kind,body,phase,speaker,speaker_role,proposer_label,documents,title_signal,mapping_version,dataset_sha256,politician_id,official_id FROM parliament_activity')
            rows=[(*r[:13],json.dumps(r[13]),*r[14:]) for r in cur.fetchall()]
            replace_records(cur,rows,meta);replace_records(cur,rows,meta)
            cur.execute('SELECT count(*) FROM parliament_activity');assert cur.fetchone()[0]==1429
        conn.commit()
        bad=list(rows[700]);bad[7]='invented'
        with pytest.raises(psycopg2.Error):
            with conn.cursor() as cur:replace_records(cur,[*rows[:700],bad,*rows[701:]],meta)
        conn.rollback()
        with conn.cursor() as cur:
            cur.execute('SET LOCAL ROLE anon');cur.execute('SELECT count(*) FROM parliament_activity');assert cur.fetchone()[0]==1429
            cur.execute('SELECT metadata FROM parliament_activity_coverage');assert cur.fetchone()[0]['universe']==42448
        with pytest.raises(psycopg2.Error):
            with conn.cursor() as cur:cur.execute('DELETE FROM parliament_activity')
        conn.rollback()
    finally:conn.close()
