import json
from unittest.mock import Mock
import pytest
from congreso.publicacion import approved,fiche,cve,boe,save,VERSION


def record(**changes):return dict(LEGISLATURA='Leg.15',NUMEXPEDIENTE='121/000001/0000',OBJETO='Proyecto de ley',RESULTADOTRAMITACION='Aprobado con modificaciones')|changes

def test_approved_scope_requires_explicit_legislature_and_unique_identity():
    chosen,total=approved(json.dumps([record(),record(NUMEXPEDIENTE='121/000002/0000',RESULTADOTRAMITACION='Pendiente')]))
    assert chosen==[('121/000001','Proyecto de ley')] and total==2
    for rows in [[record(LEGISLATURA='Leg.14')],[record(),record()],[record(NUMEXPEDIENTE='121/000001/0001')],[]]:
        with pytest.raises(ValueError):approved(json.dumps(rows))


def html(url='/constitucion/ficheros/leyes_espa/lo_002_2024.pdf',number='121/000001',legislature='XV'):
    return f'<h2 class="titular-seccion">{legislature} Legislatura</h2><div class="entradilla-iniciativa">Título ({number})</div><ul class="boes"><li><div>BOE Núm: 186 de 02/08/2024 Ley Orgánica 2/2024.</div><a href="{url}">(PDF)</a></li></ul>'


def test_document_link_comes_from_correct_fiche_not_name_matching():
    docs=fiche(html(),'121/000001');assert docs[0]['publication_date']=='2024-08-02'
    for payload in [html(number='121/000002'),html(legislature='XIV'),html(url='https://evil.test/law.pdf'),html().replace('02/08/2024','invalid')]:
        with pytest.raises(ValueError):fiche(payload,'121/000001')


def test_cve_extraction_uses_unique_footer_identifier_not_mentions_in_body():
    assert cve('Referencia BOE-A-2020-1\n cve: BOE-A-2024-15936\n cve: BOE-A-2024-15936')=='BOE-A-2024-15936'
    for text in ['BOE-A-2024-15936','cve: BOE-A-2024-15936\ncve: BOE-A-2024-9']:
        with pytest.raises(ValueError):cve(text)


def xml(vigencia='20240102',title='Ley Orgánica 2/2024',bid='BOE-A-2024-15936'):
    return f'<documento fecha_actualizacion="20261012000000"><metadatos><identificador>{bid}</identificador><titulo>{title}</titulo><rango>Ley Orgánica</rango><fecha_publicacion>20240802</fecha_publicacion><diario_numero>186</diario_numero><fecha_vigencia>{vigencia}</fecha_vigencia><url_pdf>https://www.boe.es/boe/dias/2024/08/02/pdfs/{bid}.pdf</url_pdf></metadatos></documento>'.encode()


def test_vigencia_is_source_date_not_computed_and_corrections_are_distinct():
    d=fiche(html(),'121/000001')[0]
    r=boe(xml(),'BOE-A-2024-15936',d);assert r['commencement_date']=='2024-01-02' and r['kind']=='law'
    r=boe(xml(title='Corrección de errores de la Ley Orgánica 2/2024'),'BOE-A-2024-15936',d)
    assert r['kind']=='correction' and r['commencement_date'] is None
    for p in [xml(bid='BOE-A-2024-9'),xml().replace(b'20240802',b'20240803'),b'<!DOCTYPE documento>'+xml(),xml(vigencia='20241301')]:
        with pytest.raises(ValueError):boe(p,'BOE-A-2024-15936',d)


def test_incomplete_snapshot_never_writes():
    cur=Mock()
    with pytest.raises(ValueError):save(cur,dict(version=VERSION,records=[],selected=1,documents=1))
    cur.execute.assert_not_called()


def test_official_seed_migration_and_atomic_upserts():
    import os,copy
    from pathlib import Path
    if not os.getenv('TEST_COFOG_DB_URL'):pytest.skip('isolated PostgreSQL only')
    import psycopg2
    conn=psycopg2.connect(os.environ['TEST_COFOG_DB_URL']);conn.set_client_encoding('UTF8')
    try:
        with conn.cursor() as c:
            c.execute('DROP TABLE IF EXISTS law_publication_snapshot')
            c.execute((Path(__file__).resolve().parents[2]/'supabase/migrations/20261012080000_law_publication.sql').read_text())
            c.execute('SELECT metadata FROM law_publication_snapshot');s=c.fetchone()[0]
            assert s['selected']==21 and s['documents']==23
            save(c,s);save(c,s)
        conn.commit()
        bad=copy.deepcopy(s);bad['selected']=22
        with pytest.raises(ValueError):
            with conn.cursor() as c:save(c,bad)
        conn.rollback()
        with conn.cursor() as c:
            c.execute('SET LOCAL ROLE anon');c.execute('SELECT metadata FROM law_publication_snapshot');assert c.fetchone()[0]['selected']==21
        with pytest.raises(psycopg2.Error):
            with conn.cursor() as c:c.execute('DELETE FROM law_publication_snapshot')
        conn.rollback()
    finally:conn.close()
