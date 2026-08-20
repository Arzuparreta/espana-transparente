"""Offline tests for kohesio.fondos_ue parser and retry behaviour."""

import json
from decimal import Decimal
from unittest.mock import MagicMock

import httpx
import pytest

from kohesio.fondos_ue import (
    TransientHTTPError,
    _load_items,
    _to_decimal,
    fetch_all,
    fetch_to_file,
)


def test_to_decimal_handles_strings():
    assert _to_decimal("1234.56") == Decimal("1234.56")


def test_to_decimal_handles_numbers():
    assert _to_decimal(1234.56) == Decimal("1234.56")


def test_to_decimal_handles_none():
    assert _to_decimal(None) is None


def test_to_decimal_handles_invalid():
    assert _to_decimal("not-a-number") is None


def _mock_response(payload: dict, status_code: int = 200) -> httpx.Response:
    request = httpx.Request("GET", "https://kohesio.ec.europa.eu/api/beneficiaries")
    return httpx.Response(status_code=status_code, json=payload, request=request)


def test_fetch_all_returns_items_and_total():
    payload = {
        "list": [
            {"id": "e1", "label": "Beneficiario A", "euBudget": 1000.5, "numberProjects": 3},
            {"id": "e2", "label": "Beneficiario B", "euBudget": 2000.0, "numberProjects": 5},
        ],
        "numberResults": 72344,
    }
    client = MagicMock(spec=httpx.Client)
    client.get.return_value = _mock_response(payload)

    items, total = fetch_all(client, limit=2)
    assert len(items) == 2
    assert total == 72344
    assert items[0]["id"] == "e1"


def test_fetch_all_retries_on_503_then_succeeds(monkeypatch):
    monkeypatch.setattr("tenacity.nap.time.sleep", lambda _: None)
    payload = {"list": [], "numberResults": 0}
    request = httpx.Request("GET", "https://kohesio.ec.europa.eu/api/beneficiaries")
    err_resp = httpx.Response(status_code=503, request=request)

    client = MagicMock(spec=httpx.Client)
    client.get.side_effect = [err_resp, err_resp, _mock_response(payload)]

    items, total = fetch_all(client, limit=10)
    assert items == []
    assert total == 0
    assert client.get.call_count == 3


def test_fetch_all_gives_up_after_max_attempts(monkeypatch):
    monkeypatch.setattr("tenacity.nap.time.sleep", lambda _: None)
    request = httpx.Request("GET", "https://kohesio.ec.europa.eu/api/beneficiaries")
    err_resp = httpx.Response(status_code=503, request=request)

    client = MagicMock(spec=httpx.Client)
    client.get.return_value = err_resp

    with pytest.raises(TransientHTTPError):
        fetch_all(client, limit=10)
    assert client.get.call_count == 4


def test_fetch_all_does_not_retry_a_standing_block(monkeypatch):
    """A 403 is an edge-level block, not a blip — retrying it helps nobody.

    The EC load balancer 403s the VPS runner's IP outright; the four-attempt
    retry just delayed the failure by ~40s each weekly run.
    """
    monkeypatch.setattr("tenacity.nap.time.sleep", lambda _: None)
    request = httpx.Request("GET", "https://kohesio.ec.europa.eu/api/beneficiaries")
    client = MagicMock(spec=httpx.Client)
    client.get.return_value = httpx.Response(status_code=403, request=request)

    with pytest.raises(httpx.HTTPStatusError):
        fetch_all(client, limit=10)
    assert client.get.call_count == 1


def test_fetch_only_then_from_file_round_trip(tmp_path, monkeypatch):
    """The hosted runner fetches to a file; the self-hosted runner ingests it."""
    payload = {
        "list": [
            {
                "id": "https://linkedopendata.eu/entity/Q1",
                "label": "Government of Andalusia",
                "euBudget": "4194876197.95",
                "budget": "4971289747.55",
                "cofinancingRate": "84.38",
                "numberProjects": 2178,
                "countryCode": "ES",
            }
        ],
        "numberResults": 80610,
    }
    monkeypatch.setattr(
        "kohesio.fondos_ue.fetch_all",
        lambda client, limit: (payload["list"], payload["numberResults"]),
    )

    dest = tmp_path / "nested" / "kohesio.json"
    assert fetch_to_file(dest) == 1

    items, total = _load_items(dest)
    assert total == 80610
    assert items[0]["label"] == "Government of Andalusia"


def test_from_file_refuses_an_empty_payload(tmp_path):
    """An empty artifact must not be ingested over live data."""
    dest = tmp_path / "kohesio.json"
    dest.write_text(json.dumps({"list": [], "numberResults": 0}))
    with pytest.raises(RuntimeError, match="no beneficiaries"):
        _load_items(dest)
