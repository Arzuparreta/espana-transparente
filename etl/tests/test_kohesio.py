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


def _write_payload(path, items, *, fetched_at=None, age_days=None):
    import datetime as _dt

    if fetched_at is None:
        when = _dt.datetime.now(_dt.timezone.utc)
        if age_days is not None:
            when -= _dt.timedelta(days=age_days)
        fetched_at = when.isoformat()
    payload = {"list": items, "numberResults": len(items)}
    if fetched_at is not False:
        payload["fetched_at"] = fetched_at
    path.write_text(json.dumps(payload))
    return path


def test_from_file_accepts_a_fresh_payload(tmp_path):
    dest = _write_payload(tmp_path / "k.json", [{"id": "x"}], age_days=1)
    items, _ = _load_items(dest)
    assert len(items) == 1


def test_from_file_refuses_a_stale_payload(tmp_path):
    """A handed-over payload must expire, or a dead fetcher looks healthy.

    The file is copied to the VPS by whichever machine can reach Kohesio. If
    that machine stops running, re-ingesting the same months-old file would
    keep reporting successful runs over frozen data.
    """
    dest = _write_payload(tmp_path / "k.json", [{"id": "x"}], age_days=40)
    with pytest.raises(RuntimeError, match="days ago"):
        _load_items(dest)


def test_from_file_refuses_an_unstamped_payload(tmp_path):
    """Without fetched_at there is no way to tell how old the data is."""
    dest = _write_payload(tmp_path / "k.json", [{"id": "x"}], fetched_at=False)
    with pytest.raises(RuntimeError, match="no fetched_at"):
        _load_items(dest)


def test_payload_max_age_is_configurable(tmp_path):
    dest = _write_payload(tmp_path / "k.json", [{"id": "x"}], age_days=20)
    with pytest.raises(RuntimeError):
        _load_items(dest, max_age_days=14)
    assert len(_load_items(dest, max_age_days=30)[0]) == 1


def test_fetch_only_stamps_the_payload(tmp_path, monkeypatch):
    """The stamp comes from the fetcher, so copying the file cannot refresh it."""
    monkeypatch.setattr("kohesio.fondos_ue.fetch_all", lambda c, l: ([{"id": "x"}], 1))
    dest = tmp_path / "k.json"
    fetch_to_file(dest)
    assert "fetched_at" in json.loads(dest.read_text())
    assert len(_load_items(dest)[0]) == 1


def test_from_file_refuses_an_empty_payload(tmp_path):
    """An empty artifact must not be ingested over live data."""
    dest = _write_payload(tmp_path / "kohesio.json", [])
    with pytest.raises(RuntimeError, match="no beneficiaries"):
        _load_items(dest)


def test_a_failed_fetch_is_recorded_as_a_failed_run(monkeypatch):
    """A 403 must land in etl_runs, not leave the last success standing.

    fetch_all used to run before start_run, so an unreachable API produced no
    etl_runs entry at all and /estado-datos kept showing the previous week's
    success instead of the failure that had just happened.
    """
    from kohesio import fondos_ue as mod

    calls = {"start": 0, "finish": []}

    def _start(cur, **kw):
        calls["start"] += 1
        return "run-1"

    def _finish(cur, run_id, status, **kw):
        calls["finish"].append(status)

    def _boom(limit, from_file, max_age_days=None):
        raise httpx.HTTPStatusError(
            "403", request=httpx.Request("GET", mod.API_BASE), response=httpx.Response(403)
        )

    monkeypatch.setattr(mod, "get_pg_conn", lambda: _FakeKohesioConn())
    monkeypatch.setattr(mod, "start_run", _start)
    monkeypatch.setattr(mod, "finish_run", _finish)
    monkeypatch.setattr(mod, "_load_or_fetch", _boom)

    with pytest.raises(httpx.HTTPStatusError):
        mod.run()

    assert calls["start"] == 1, "the run must be opened before the fetch"
    assert calls["finish"] == ["failed"]


class _FakeKohesioCursor:
    def execute(self, *a, **kw):
        return None

    def fetchone(self):
        return None

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


class _FakeKohesioConn:
    def cursor(self, *a, **kw):
        return _FakeKohesioCursor()

    def commit(self):
        return None

    def close(self):
        return None
