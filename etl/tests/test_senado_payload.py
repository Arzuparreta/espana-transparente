from datetime import datetime, timezone, timedelta
import json

import pytest
from src.senado import payload, votaciones


XML = """<main><sesion><num_sesion>{number}</num_sesion>
<fecha_sesion>20/10/2026</fecha_sesion><votacion><num_vot>1</num_vot>
<tit_vot>Votación</tit_vot><resultado><VotoSenador>
<nombre>Senadora</nombre><voto>SÍ</voto>
</VotoSenador></resultado></votacion></sesion></main>"""


@pytest.fixture
def exported(tmp_path, monkeypatch):
    # The catalog omits session 1; the export must still retrieve it.
    monkeypatch.setattr(votaciones, "discover_session_vote_urls", lambda: [
        votaciones.BASE + "/legis15/votaciones/ses_2.xml"])
    fetched = []
    def fetch(url):
        fetched.append(url)
        return XML.format(number=votaciones._session_number(url))
    monkeypatch.setattr(votaciones, "curl_text", fetch)
    payload.export_payload(tmp_path)
    assert len(fetched) == 2
    return tmp_path


def test_payload_round_trip_uses_no_http_or_database(exported, monkeypatch):
    def forbidden(*args, **kwargs):
        pytest.fail("offline payload ingestion attempted HTTP or database access")
    monkeypatch.setattr(votaciones, "curl_text", forbidden)
    monkeypatch.setattr(votaciones, "curl_status", forbidden)
    monkeypatch.setattr(votaciones, "get_pg_conn", forbidden)
    loaded = payload.load_payload(exported)
    assert [rows[0].session_number for rows in loaded.values()] == [1, 2]
    assert sum(len(rows[0].votes) for rows in loaded.values()) == 2
    votaciones.run(from_directory=str(exported), dry_run=True)


def test_payload_rejects_modified_xml(exported):
    (exported / "ses_2.xml").write_text(XML.format(number=99))
    with pytest.raises(ValueError, match="checksum"):
        payload.load_payload(exported)


@pytest.mark.parametrize("change", ["stale", "gap", "foreign_source", "empty"])
def test_payload_rejects_incomplete_or_stale_manifest(exported, change):
    manifest_path = exported / "manifest.json"
    manifest = json.loads(manifest_path.read_text())
    if change == "stale":
        manifest["fetched_at"] = (datetime.now(timezone.utc) - timedelta(days=3)).isoformat()
    elif change == "gap":
        manifest["sessions"].pop(0)
    elif change == "foreign_source":
        manifest["sessions"][0]["url"] = "https://example.test/ses_1.xml"
    else:
        manifest["sessions"] = []
    manifest_path.write_text(json.dumps(manifest))
    with pytest.raises(ValueError):
        payload.load_payload(exported)


def test_export_does_not_publish_manifest_after_a_block(tmp_path, monkeypatch):
    monkeypatch.setattr(votaciones, "discover_session_vote_urls", lambda: [
        votaciones.BASE + "/legis15/votaciones/ses_1.xml"])
    monkeypatch.setattr(votaciones, "curl_text", lambda url: "<html>Access Denied</html>")
    with pytest.raises((ValueError, RuntimeError)):
        payload.export_payload(tmp_path)
    assert not (tmp_path / "manifest.json").exists()


def test_official_xml_can_have_whitespace_before_declaration():
    xml = "\ufeff\n<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" + XML.format(number=61)
    parsed = votaciones.parse_senate_session_vote_xml(
        xml, votaciones.BASE + "/legis15/votaciones/ses_61.xml")
    assert parsed[0].session_number == 61
    assert len(parsed[0].votes) == 1
