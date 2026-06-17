"""Smoke tests for bdns.subvenciones parser (offline — no network)."""

import json
from pathlib import Path

import httpx
import pytest

from bdns.subvenciones import BDNS_API, _is_organization, fetch_page, parse_record, run_window

FIXTURES = Path(__file__).parent / "fixtures"


def _load_fixture() -> list[dict]:
    data = json.loads((FIXTURES / "bdns_response.json").read_text())
    return data["content"]


def test_is_organization_accepts_named_entity():
    assert _is_organization("UNIVERSIDAD COMPLUTENSE DE MADRID") is True


def test_is_organization_rejects_anonymized():
    assert _is_organization("* (datos personales protegidos)") is False


def test_is_organization_rejects_none():
    assert _is_organization(None) is False


def test_parse_record_returns_dict_for_org():
    raw = _load_fixture()[0]
    record = parse_record(raw, importe_min=0)
    assert record is not None
    assert record["bdns_id"] == 12345
    assert record["beneficiario"] == "UNIVERSIDAD COMPLUTENSE DE MADRID"
    assert record["nivel1"] == "ESTADO"
    assert record["administration_level"] == "state"
    assert record["ministry_normalized"] is not None


def test_parse_record_returns_none_for_individual():
    raw = _load_fixture()[1]
    record = parse_record(raw, importe_min=0)
    assert record is None


def test_parse_record_filters_by_importe_min():
    raw = _load_fixture()[0]
    record = parse_record(raw, importe_min=100_000)
    assert record is None


def test_parse_record_date_format():
    raw = _load_fixture()[0]
    record = parse_record(raw, importe_min=0)
    assert record["fecha_concesion"] == "15/01/2025"


def _response(content: bytes | None = None, *, status_code: int = 200, json_body: dict | None = None) -> httpx.Response:
    request = httpx.Request("GET", BDNS_API)
    if json_body is not None:
        return httpx.Response(status_code=status_code, json=json_body, request=request)
    return httpx.Response(status_code=status_code, content=content or b"", request=request)


def test_fetch_page_decodes_latin1_json(monkeypatch):
    payload = '{"content":[{"beneficiario":"DIPUTACION DE A CORUNA"}],"last":true}'.encode("latin-1")
    monkeypatch.setattr("bdns.subvenciones.httpx.get", lambda *_, **__: _response(payload))

    assert fetch_page("2025-01-01", "2025-01-01", 0)["content"][0]["beneficiario"] == "DIPUTACION DE A CORUNA"


def test_fetch_page_retries_empty_json_body(monkeypatch):
    monkeypatch.setattr("bdns.subvenciones.time.sleep", lambda _: None)
    responses = [
        _response(b""),
        _response(json_body={"content": [], "last": True}),
    ]

    def fake_get(*_, **__):
        return responses.pop(0)

    monkeypatch.setattr("bdns.subvenciones.httpx.get", fake_get)

    assert fetch_page("2025-01-01", "2025-01-01", 0) == {"content": [], "last": True}
    assert responses == []


def test_fetch_page_retries_server_errors(monkeypatch):
    monkeypatch.setattr("bdns.subvenciones.time.sleep", lambda _: None)
    responses = [
        _response(status_code=503),
        _response(json_body={"content": [], "last": True}),
    ]

    def fake_get(*_, **__):
        return responses.pop(0)

    monkeypatch.setattr("bdns.subvenciones.httpx.get", fake_get)

    assert fetch_page("2025-01-01", "2025-01-01", 0) == {"content": [], "last": True}
    assert responses == []


def test_fetch_page_does_not_retry_client_errors(monkeypatch):
    monkeypatch.setattr("bdns.subvenciones.time.sleep", lambda _: pytest.fail("4xx responses should not back off"))
    monkeypatch.setattr("bdns.subvenciones.httpx.get", lambda *_, **__: _response(status_code=400))

    with pytest.raises(httpx.HTTPStatusError):
        fetch_page("2025-01-01", "2025-01-01", 0)


def test_run_window_fails_when_max_pages_exhausted(monkeypatch):
    monkeypatch.setattr("bdns.subvenciones.time.sleep", lambda _: None)
    monkeypatch.setattr(
        "bdns.subvenciones.fetch_page",
        lambda *_: {"content": [{"beneficiario": "***123"}], "last": False, "totalElements": 999},
    )

    with pytest.raises(RuntimeError, match="exceeded max_pages=2"):
        run_window(
            from_date="2025-01-01",
            to_date="2025-01-02",
            importe_min=0,
            max_pages=2,
            dry_run=True,
            resume=False,
        )
