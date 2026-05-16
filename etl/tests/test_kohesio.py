"""Offline tests for kohesio.fondos_ue parser and retry behaviour."""

from decimal import Decimal
from unittest.mock import MagicMock

import httpx
import pytest

from kohesio.fondos_ue import _to_decimal, fetch_all


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

    with pytest.raises(httpx.HTTPStatusError):
        fetch_all(client, limit=10)
    assert client.get.call_count == 4
