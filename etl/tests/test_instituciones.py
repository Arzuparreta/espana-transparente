"""Smoke tests for instituciones.instituciones (offline — no network)."""

import textwrap
from datetime import date
from pathlib import Path

import pytest
import yaml

from instituciones.instituciones import load_appointments, _parse_date, VALID_INSTITUTIONS

FIXTURES = Path(__file__).parent / "fixtures"
DATA_FILE = Path(__file__).parent.parent.parent / "etl" / "data" / "instituciones_nombramientos.yml"

# Resolve relative to repo root
_REPO_ROOT = Path(__file__).parent.parent.parent
_YAML = _REPO_ROOT / "etl" / "data" / "instituciones_nombramientos.yml"


# ── _parse_date ───────────────────────────────────────────────────────────────

def test_parse_date_iso():
    assert _parse_date("2023-12-13") == date(2023, 12, 13)


def test_parse_date_slash():
    assert _parse_date("13/12/2023") == date(2023, 12, 13)


def test_parse_date_none():
    assert _parse_date(None) is None


def test_parse_date_empty():
    assert _parse_date("") is None


# ── load_appointments with inline YAML ────────────────────────────────────────

def _write_tmp_yaml(tmp_path: Path, content: str) -> Path:
    f = tmp_path / "test.yml"
    f.write_text(textwrap.dedent(content), encoding="utf-8")
    return f


def test_load_appointments_basic(tmp_path):
    f = _write_tmp_yaml(tmp_path, """
        appointments:
          - institution: TC
            position_title: Magistrado
            person: "García López, Manuel"
            party: PP
            nominating_body: Congreso
            start: 2023-12-13
            end:
            source: https://www.boe.es/test
    """)
    rows = load_appointments(f)
    assert len(rows) == 1
    r = rows[0]
    assert r["institution"] == "TC"
    assert r["person_name"] == "García López, Manuel"
    assert r["political_party"] == "PP"
    assert r["nominating_body"] == "Congreso"
    assert r["appointment_date"] == date(2023, 12, 13)
    assert r["end_date"] is None
    assert r["source_url"] == "https://www.boe.es/test"


def test_load_appointments_rejects_unknown_institution(tmp_path):
    f = _write_tmp_yaml(tmp_path, """
        appointments:
          - institution: UNKNOWN
            position_title: X
            person: "Persona X"
    """)
    with pytest.raises(ValueError, match="Unknown institution"):
        load_appointments(f)


def test_load_appointments_rejects_missing_person(tmp_path):
    f = _write_tmp_yaml(tmp_path, """
        appointments:
          - institution: TC
            position_title: Magistrado
            person: ""
    """)
    with pytest.raises(ValueError, match="Missing person"):
        load_appointments(f)


def test_load_appointments_all_institutions(tmp_path):
    entries = "\n".join(
        f"  - institution: {inst}\n    position_title: Cargo\n    person: 'Persona {inst}'"
        for inst in VALID_INSTITUTIONS
    )
    f = _write_tmp_yaml(tmp_path, f"appointments:\n{entries}")
    rows = load_appointments(f)
    assert {r["institution"] for r in rows} == VALID_INSTITUTIONS


# ── validate real YAML when it exists ─────────────────────────────────────────

@pytest.mark.skipif(not _YAML.exists(), reason="instituciones_nombramientos.yml not yet created")
def test_real_yaml_all_required_fields():
    rows = load_appointments(_YAML)
    assert len(rows) > 0, "YAML must have at least one entry"
    for r in rows:
        assert r["institution"] in VALID_INSTITUTIONS, f"Invalid institution: {r['institution']}"
        assert r["person_name"], f"Missing person_name in {r}"
        assert r["position_title"], f"Missing position_title in {r}"


@pytest.mark.skipif(not _YAML.exists(), reason="instituciones_nombramientos.yml not yet created")
def test_real_yaml_institutions_coverage():
    rows = load_appointments(_YAML)
    found = {r["institution"] for r in rows}
    assert found == VALID_INSTITUTIONS, f"Missing institutions: {VALID_INSTITUTIONS - found}"


@pytest.mark.skipif(not _YAML.exists(), reason="instituciones_nombramientos.yml not yet created")
def test_real_yaml_nominating_body_valid():
    # Valid bodies include all governmental branches and SEPI-specific appointment sources
    valid = {"Congreso", "Senado", "CGPJ", "Gobierno", "Sindical", "Autonómico", "Privado"}
    rows = load_appointments(_YAML)
    for r in rows:
        if r["nominating_body"]:
            assert r["nominating_body"] in valid, (
                f"Invalid nominating_body {r['nominating_body']!r} for {r['person_name']}"
            )
