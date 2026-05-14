from datetime import date
from pathlib import Path

from common.responsibility import (
    administration_level_from_bdns,
    infer_contract_administration_level,
    infer_municipal_territory,
    iter_date_chunks,
    iter_months,
    normalize_public_body,
)
from congreso.responsables import load_body_map, load_registry_positions, load_state_positions


DATA_DIR = Path(__file__).resolve().parents[1] / "data"


def test_normalize_public_body_keeps_uppercase_ascii():
    assert normalize_public_body(" Consejería de Educación, Cultura y Deporte ") == (
        "CONSEJERIA DE EDUCACION, CULTURA Y DEPORTE"
    )


def test_administration_level_from_bdns_maps_known_levels():
    assert administration_level_from_bdns("ESTADO") == "state"
    assert administration_level_from_bdns("AUTONOMICA") == "autonomic"
    assert administration_level_from_bdns("LOCAL") == "municipal"


def test_infer_contract_administration_level_detects_municipal_and_autonomic():
    assert infer_contract_administration_level("AYUNTAMIENTO DE ZARAGOZA", None) == "municipal"
    assert infer_contract_administration_level("JUNTA DE ANDALUCIA", None) == "autonomic"
    assert infer_contract_administration_level(None, "MINISTERIO DE HACIENDA") == "state"


def test_infer_municipal_territory_extracts_city():
    assert infer_municipal_territory("AYUNTAMIENTO DE MADRID") == "MADRID"


def test_iter_months_and_chunks_cover_full_interval():
    assert iter_months(start=date(2016, 1, 1), end=date(2016, 3, 1)) == [
        (2016, 1),
        (2016, 2),
        (2016, 3),
    ]
    assert iter_date_chunks(
        date(2024, 1, 1),
        date(2024, 1, 10),
        4,
    ) == [
        (date(2024, 1, 1), date(2024, 1, 4)),
        (date(2024, 1, 5), date(2024, 1, 8)),
        (date(2024, 1, 9), date(2024, 1, 10)),
    ]


def test_responsibility_loaders_include_state_autonomic_and_municipal_data():
    state_rows = load_state_positions(DATA_DIR / "gobierno_historico.yml")
    registry_rows = load_registry_positions(DATA_DIR / "responsibility_positions.yml")
    body_map = load_body_map(DATA_DIR / "public_body_responsibility_map.yml")

    assert any(row.administration_level == "state" for row in state_rows)
    assert any(row.administration_level == "autonomic" for row in registry_rows)
    assert any(row.administration_level == "municipal" for row in registry_rows)
    assert any(entry.administration_level == "state" for entry in body_map)
    assert any(entry.administration_level == "autonomic" for entry in body_map)
