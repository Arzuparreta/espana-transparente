import os
from pathlib import Path
import pytest


@pytest.mark.skipif(not os.getenv('TEST_COFOG_DB_URL'),reason='isolated PostgreSQL only')
def test_real_view_chain_dates_ambiguity_identity_and_currency():
    import psycopg2
    from psycopg2 import sql
    from uuid import uuid4
    conn=psycopg2.connect(os.environ['TEST_COFOG_DB_URL']);conn.set_client_encoding('UTF8')
    root=Path(__file__).resolve().parents[2]/'supabase/migrations'
    schema='mandate_'+uuid4().hex
    old=(root/'20260514180000_multilevel_responsibility.sql').read_text()
    propagated=(root/'20260709010000_official_id_view_propagation.sql').read_text()
    def view(text,name):return text.split('CREATE OR REPLACE VIEW '+name,1)[1].split(';',1)[0]
    try:
        with conn.cursor() as c:
            for role in ('anon','authenticated'):
                c.execute('SELECT 1 FROM pg_roles WHERE rolname=%s',(role,))
                if not c.fetchone():c.execute(sql.SQL('CREATE ROLE {}').format(sql.Identifier(role)))
            c.execute(sql.SQL('CREATE SCHEMA {}').format(sql.Identifier(schema)))
            c.execute(sql.SQL('SET search_path TO {},public').format(sql.Identifier(schema)))
            c.execute("CREATE FUNCTION normalize_money_text(text) RETURNS text LANGUAGE sql IMMUTABLE AS 'SELECT upper($1)'")
            c.execute('CREATE TABLE politicians (id uuid PRIMARY KEY)')
            for name in ['responsibility_positions','public_body_responsibility_map']:
                body=old.split('CREATE TABLE IF NOT EXISTS '+name+' (',1)[1].split(');',1)[0]
                c.execute('CREATE TABLE '+name+' ('+body+');')
            c.execute('ALTER TABLE responsibility_positions ADD COLUMN official_id uuid')
            c.execute('CREATE TABLE parties(acronym text,color text)')
            c.execute('''CREATE TABLE contracts(id uuid PRIMARY KEY, date date, award_date date,title text,source_url text,
                awarding_body text,awarding_body_normalized text,ministry_normalized text,administration_level text,
                amount numeric,currency text,contractor text,contractor_nif text,contractor_is_sme bool,contractor_is_ute bool,
                award_amount numeric,award_amount_with_taxes numeric,contract_number text,received_tender_quantity integer)''')
            c.execute('''CREATE TABLE subsidies(id uuid PRIMARY KEY, fecha_concesion date, beneficiario text,source_url text,
                nivel3 text,nivel2 text,granting_body_normalized text,ministry_normalized text,administration_level text)''')
            for name in ['v_contract_resolution_base','v_subsidy_resolution_base']:
                c.execute('CREATE OR REPLACE VIEW '+name+view(old,name)+';')
            c.execute(propagated)
            c.execute((root/'20260515220000_v_gobierno_actual.sql').read_text())
            c.execute((root/'20261012030000_mandate_evidence.sql').read_text())
            ids=[str(uuid4()) for _ in range(3)];official=str(uuid4())
            for i,(start,end) in enumerate([('2019-01-01','2020-12-31'),('2021-01-01',None),('2021-01-01',None)]):
                c.execute('''INSERT INTO responsibility_positions (id,administration_level,position_type,organization_name,person_name,start_date,end_date,source_url,government,official_id)
                    VALUES (%s,'state','ministro','MINISTERIO TEST',%s,%s,%s,'https://www.boe.es/test','G',%s)''',(ids[i],f'Persona {i}',start,end,official))
            records=[str(uuid4()) for _ in range(4)]
            # Publication after turnover, award before turnover -> old mandate.
            for rid,published,awarded,amount,currency in [(records[0],'2022-01-01','2020-12-31',100,'EUR'),(records[1],'2022-01-01',None,200,'EUR'),(records[2],'2022-01-01',None,300,'USD'),(records[3],None,None,400,'EUR')]:
                c.execute('''INSERT INTO contracts(id,date,award_date,ministry_normalized,amount,currency) VALUES (%s,%s,%s,'MINISTERIO TEST',%s,%s)''',(rid,published,awarded,amount,currency))
            c.execute('SELECT position_id,date_basis,official_id,candidate_count FROM v_contract_mandate_context WHERE contract_id=%s',(records[0],))
            assert c.fetchone()==(ids[0],'award_date',official,1)
            c.execute('SELECT date_basis,candidate_count FROM v_contract_mandate_context WHERE contract_id=%s',(records[1],));assert c.fetchone()==('publication_date',2)
            c.execute('SELECT count(*) FROM v_contract_mandate_context WHERE contract_id=%s',(records[3],));assert c.fetchone()[0]==0
            c.execute('SELECT contract_count,total_amount_eur,excluded_amount_count FROM v_gobierno_actual ORDER BY id')
            assert c.fetchall()==[(2,200,1),(2,200,1)]
            c.execute('INSERT INTO subsidies(id,fecha_concesion,ministry_normalized) VALUES (%s,\'2020-12-31\',\'MINISTERIO TEST\')',(str(uuid4()),))
            c.execute('SELECT position_id,date_basis FROM v_subsidy_mandate_context');assert c.fetchone()==(ids[0],'grant_date')
            c.execute(sql.SQL('GRANT USAGE ON SCHEMA {} TO anon').format(sql.Identifier(schema)))
            c.execute('GRANT SELECT ON ALL TABLES IN SCHEMA '+schema+' TO anon')
            c.execute('SET LOCAL ROLE anon');c.execute('SELECT count(*) FROM v_contract_mandate_context');assert c.fetchone()[0]==3
        conn.rollback()
    finally:
        conn.rollback();conn.close()
