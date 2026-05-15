"""Smoke tests for puertas_giratorias.ingest (offline — no network)."""

from datetime import date
from pathlib import Path

from puertas_giratorias.ingest import (
    _extract_appointments,
    _normalize_for_match,
    _best_match,
    load_watchlist,
)

FIXTURES = Path(__file__).parent / "fixtures"
DATA_DIR = Path(__file__).parent.parent / "src" / "data"
WATCHLIST_PATH = Path(__file__).parent.parent.parent / "etl" / "data" / "personas_vigiladas.yml"

# Resolve watchlist relative to repo root
_REPO_ROOT = Path(__file__).parent.parent.parent
_WATCHLIST = _REPO_ROOT / "etl" / "data" / "personas_vigiladas.yml"


def _borme_text() -> str:
    return (FIXTURES / "borme_seccion_a_sample.txt").read_text()


# ── _normalize_for_match ──────────────────────────────────────────────────────

def test_normalize_strips_accents():
    assert _normalize_for_match("García López") == "garcia lopez"


def test_normalize_lowercases():
    assert _normalize_for_match("MANUEL GARCIA") == "manuel garcia"


def test_normalize_removes_punctuation():
    assert _normalize_for_match("García-López") == "garcialopez"


# ── _extract_appointments ─────────────────────────────────────────────────────

def test_extract_appointments_finds_nombramientos():
    text = _borme_text()
    entries = _extract_appointments(text)
    nombramientos = [e for e in entries if e["action"] == "Nombramientos"]
    assert len(nombramientos) >= 1


def test_extract_appointments_finds_ceses():
    text = _borme_text()
    entries = _extract_appointments(text)
    ceses = [e for e in entries if e["action"] == "Ceses/Dimisiones"]
    assert len(ceses) >= 1


def test_extract_appointments_has_role():
    text = _borme_text()
    entries = _extract_appointments(text)
    for entry in entries:
        assert entry["role"], "Every entry should have a role"
        assert entry["name"], "Every entry should have a name"


def test_extract_appointments_splits_multiple_names():
    text = _borme_text()
    entries = _extract_appointments(text)
    names = [e["name"] for e in entries if e["action"] == "Nombramientos"]
    # Fixture has two names separated by ; in the first Nombramientos entry
    assert len(names) >= 2


# ── _best_match ───────────────────────────────────────────────────────────────

def test_best_match_finds_exact_tokens():
    matched, score = _best_match("GARCIA LOPEZ MANUEL", ["Manuel García López"])
    assert matched == "Manuel García López"
    assert score >= 82


def test_best_match_returns_none_below_threshold():
    matched, score = _best_match("RANDOM PERSON XYZ", ["Manuel García López"])
    assert matched is None
    assert score == 0


def test_best_match_handles_reordered_names():
    matched, score = _best_match("RODRIGUEZ PEREZ ANA", ["Ana Rodríguez Pérez"])
    assert matched == "Ana Rodríguez Pérez"


# ── load_watchlist ────────────────────────────────────────────────────────────

def test_load_watchlist_returns_list():
    watchlist = load_watchlist(_WATCHLIST)
    assert isinstance(watchlist, list)
    assert len(watchlist) > 0


def test_load_watchlist_all_strings():
    watchlist = load_watchlist(_WATCHLIST)
    for name in watchlist:
        assert isinstance(name, str)
        assert len(name) > 3
