from pathlib import Path

from judicial.cgpj import (
    cases_from_dataframe,
    map_status,
    read_cases_from_bytes,
)

FIXTURES = Path(__file__).parent / "fixtures"


def test_map_status_uses_fixed_vocabulary():
    assert map_status("Apertura de juicio oral") == "procesamiento_o_juicio_oral"
    assert map_status("Sentencia condenatoria firme") == "condena_firme"
    assert map_status("Sentencia condenatoria") == "condena_no_firme"
    assert map_status("Auto de sobreseimiento") == "sobreseido"
    assert map_status("Absolución") == "absuelto"
    assert map_status("Dato estadístico") == "desconocido"


def test_parse_cgpj_csv_fixture_builds_cases():
    content = (FIXTURES / "cgpj_corruption_sample.csv").read_bytes()
    cases = read_cases_from_bytes(content, "https://example.test/cgpj.csv")

    assert len(cases) == 3
    assert cases[0].source_type == "cgpj"
    assert cases[0].procedural_status == "procesamiento_o_juicio_oral"
    assert cases[0].territory == "Andalucía"
    assert cases[0].court_body == "Audiencia Provincial"
    assert cases[0].source_url == "https://example.test/cgpj.csv"


def test_dataframe_parser_skips_no_publication_gate_decisions():
    import pandas as pd

    df = pd.DataFrame([
        {
            "Territorio": "Madrid",
            "Estado": "Condena no firme",
            "Órgano judicial": "Audiencia Nacional",
        }
    ])
    cases = cases_from_dataframe(df, "https://example.test/file.xlsx")

    assert len(cases) == 1
    assert cases[0].procedural_status == "condena_no_firme"
    assert cases[0].external_id
