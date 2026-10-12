from pathlib import Path
import os
import pytest
from presupuestos import scraper_sepg as s
from presupuestos.sources import get_source
from presupuestos.presupuestos import build_carried_forward_records, parse_sepg_records, upsert

FIXTURES = Path(__file__).parent / "fixtures" / "pge"

@pytest.mark.parametrize("year,folder", [(2024,"PGE2023Prorroga"),(2025,"PGE2024Prorroga"),(2026,"PGE2025Prorroga")])
def test_source_edition_is_not_the_folder_year(year, folder):
    assert s.PRORROGA_FOLDERS[year] == folder
    assert f"/{folder}/" in get_source(year).gastos_url
    assert get_source(year).in_force_year == 2023


def test_wrong_exercise_rejected_before_csv_read(monkeypatch):
    monkeypatch.setattr(s, "_curl_get", lambda url: b'<h2>Presupuesto prorrogado para 2026</h2><a href="N_25P_E_R_31_101_1_1_1.htm">a</a>')
    with pytest.raises(RuntimeError, match="exercise 2025"):
        s.get_gastos_page_names("PGE2025Prorroga", expected_year=2025)


def test_complete_summary_preferred_and_internal_transfers_retained(monkeypatch):
    monkeypatch.setattr(s, "_curl_get", lambda url: b'<a href="doc/CSV/a_2.CSV"></a><a href="doc/CSV/a_3.CSV"></a><a href="doc/CSV/b_T_1.CSV"></a><a href="doc/CSV/b_T_2.CSV"></a>')
    monkeypatch.setattr(s.time, "sleep", lambda delay: None)
    assert s.get_csv_names_from_gastos_page("folder", "page") == ["a_3.CSV", "b_T_2.CSV"]

@pytest.mark.parametrize("name,total", [("cortes-detail.csv",268007170), ("cooperacion-summary.csv",998051190), ("internal-summary.csv",249750)])
def test_official_layouts_reconcile_in_euros(name, total):
    rows = s.parse_sepg_csv((FIXTURES/name).read_bytes())
    assert sum(r.credit_initial for r in rows) == pytest.approx(total)
    if name == "cortes-detail.csv":
        assert next(r for r in rows if r.economic_chapter == 6).credit_initial == pytest.approx(6113160)
    if name == "cooperacion-summary.csv":
        assert next(r for r in rows if r.economic_chapter == 1).credit_initial == pytest.approx(53702120)


def test_partial_detail_does_not_replace_a_complete_budget():
    with pytest.raises(RuntimeError, match="reconcile"):
        s.parse_sepg_csv((FIXTURES/"cooperacion-partial.csv").read_bytes())


def test_source_identity_unit_and_total_are_required():
    data = (FIXTURES/"internal-summary.csv").read_bytes()
    for modified in (data.replace(b"(Miles de euros)", b"euros"), data.replace(b";TOTAL;", b";PARTIAL;")):
        with pytest.raises(RuntimeError): s.parse_sepg_csv(modified)

@pytest.mark.parametrize("invalid", [b"NaN",b"Infinity",b"missing"])
def test_non_numeric_program_totals_are_not_zero(invalid):
    data=(FIXTURES/"internal-summary.csv").read_bytes()
    lines=data.splitlines()
    for i,line in enumerate(lines):
        if b';TOTAL;' in line:
            cells=line.split(b';'); cells[4]=invalid; lines[i]=b';'.join(cells)
    with pytest.raises(RuntimeError):s.parse_sepg_csv(b'\n'.join(lines))


def test_program_origin_and_reference_origin_are_preserved():
    row = s.parse_sepg_csv((FIXTURES/"internal-summary.csv").read_bytes())[0]
    row.source_url = "https://www.sepg.pap.hacienda.gob.es/official.CSV"
    row.source_sha256 = "a"*64
    record = parse_sepg_records([row], get_source(2024))[0]
    assert record["source_url"] == row.source_url
    assert record["raw_data"].adapted["verified_exercise"] == 2024
    assert record["raw_data"].adapted["source_sha256"] == row.source_sha256
    reference = build_carried_forward_records([{"section_code":"60", "source_url":"https://original/2023.csv", "raw_data":{"source":"2023"}}],get_source(2026), section_codes={"60"})[0]
    assert reference["source_url"] == "https://original/2023.csv"
    assert reference["raw_data"].adapted["source"] == "2023"
    assert reference["raw_data"].adapted["reference_context_url"] == get_source(2026).gastos_url


def test_complete_replacement_preserves_keys_and_prunes_stale_rows_in_one_commit():
    operations=[]
    class Cursor:
        def execute(self, query, params): operations.append((query,params))
        def close(self): pass
    class Connection:
        def cursor(self): return Cursor()
        def commit(self): operations.append(("COMMIT",None))
    records=[{"year":2024,"budget_type":"prorroga"}]
    assert upsert(Connection(), records, replace_year=2024) == 1
    assert "INSERT INTO" in operations[0][0]
    assert "DELETE FROM budget_lines" in operations[1][0]
    assert operations[1][1][0] == 2024
    assert operations[-1][0] == "COMMIT"
    with pytest.raises(ValueError):upsert(Connection(), records, replace_year=2025)


@pytest.mark.skipif(not os.getenv("TEST_COFOG_DB_URL"),reason="disposable PostgreSQL integration only")
def test_audited_seed_preserves_ids_references_and_transaction_rollback():
    import psycopg2
    conn=psycopg2.connect(os.environ["TEST_COFOG_DB_URL"]);conn.set_client_encoding("UTF8")
    migrations=Path(__file__).resolve().parents[2]/"supabase/migrations"
    try:
        with conn.cursor() as cur:
            for role in ('anon','authenticated'):
                cur.execute('SELECT 1 FROM pg_roles WHERE rolname=%s',(role,))
                if not cur.fetchone():cur.execute(f'CREATE ROLE {role}')
            cur.execute("DROP SCHEMA IF EXISTS pge_audit CASCADE; CREATE SCHEMA pge_audit; SET search_path=pge_audit,public")
            cur.execute((migrations/"20260520000000_budget_lines.sql").read_text().split("CREATE VIEW")[0])
            cur.execute("ALTER TABLE budget_lines ADD COLUMN budget_type text NOT NULL DEFAULT 'ley', ADD COLUMN source_kind text NOT NULL DEFAULT 'published', ADD COLUMN source_year integer, ADD COLUMN in_force_year integer")
            cur.execute("ALTER TABLE budget_lines DROP CONSTRAINT uq_budget_lines;ALTER TABLE budget_lines ADD UNIQUE(year,budget_type,section_code,program_code,economic_chapter)")
            cur.execute("CREATE TABLE etl_runs(pipeline text,chunk_key text,status text,rows_read integer,rows_updated integer,finished_at timestamptz)")
            cur.execute("INSERT INTO budget_lines(year,budget_type,source_kind,section_code,program_code,economic_chapter,credit_initial,source_url) VALUES(2024,'prorroga','published_prorroga','01','911M',4,1,'old'),(2024,'prorroga','published_prorroga','99','old',1,999,'old'),(2023,'ley','published','60','211A',1,500,'https://original/2023.csv'),(2024,'prorroga','carried_forward','60','211A',1,500,'wrong')")
            cur.execute("SELECT id FROM budget_lines WHERE section_code='01'");original_id=cur.fetchone()[0]
            cur.execute((migrations/"20261012110000_audited_pge_editions.sql").read_text())
            cur.execute("SELECT year,count(*),sum(credit_initial) FROM budget_lines WHERE source_kind='published_prorroga' GROUP BY year ORDER BY year")
            assert cur.fetchall()==[(2024,1332,435492762910),(2025,1332,435807762910),(2026,1337,435804734100)]
            cur.execute("SELECT id FROM budget_lines WHERE section_code='01' AND year=2024");assert cur.fetchone()[0]==original_id
            cur.execute("SELECT count(*) FROM budget_lines WHERE section_code='99'");assert cur.fetchone()[0]==0
            cur.execute("SELECT source_url FROM budget_lines WHERE source_kind='carried_forward'");assert cur.fetchone()[0]=='https://original/2023.csv'
        conn.commit()
        records=parse_sepg_records(s.parse_sepg_csv((FIXTURES/'internal-summary.csv').read_bytes()),get_source(2024))
        upsert(conn,records,replace_year=2024,commit=False)
        conn.rollback()
        with conn.cursor() as cur:
            cur.execute("SELECT count(*) FROM budget_lines WHERE year=2024");assert cur.fetchone()[0]==1333
        bad=dict(records[0]);bad['credit_initial']='bad numeric'
        with pytest.raises(psycopg2.Error):upsert(conn,[bad],replace_year=2024,commit=False)
        conn.rollback()
        with conn.cursor() as cur:
            cur.execute("SELECT count(*) FROM budget_lines WHERE year=2024");assert cur.fetchone()[0]==1333
    finally:
        conn.rollback()
        with conn.cursor() as cur:cur.execute("DROP SCHEMA IF EXISTS pge_audit CASCADE")
        conn.commit();conn.close()
