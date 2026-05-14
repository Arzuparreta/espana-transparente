from pathlib import Path

from congreso.gobierno import load_positions


def test_load_positions_reads_yaml_fixture():
    path = Path(__file__).resolve().parents[1] / "data" / "gobierno_historico.yml"
    rows = load_positions(path)

    assert rows
    assert any(row["government"] == "Sánchez III" for row in rows)
    assert any(row["organization_name"] == "MINISTERIO DE HACIENDA" for row in rows)
