import json

from congreso.directory import discover_active_csv_url, fetch_active_directory, normalize_name


def test_discover_active_csv_url_parses_current_asset(monkeypatch):
    html = """
    <a class="btn" href="/webpublica/opendata/diputados/DiputadosActivos__20260514050004.csv">
      CSV
    </a>
    """
    monkeypatch.setattr("congreso.directory._curl", lambda url, data=None: html)
    assert (
        discover_active_csv_url()
        == "https://www.congreso.es/webpublica/opendata/diputados/DiputadosActivos__20260514050004.csv"
    )


def test_fetch_active_directory_returns_cod_parlamentario(monkeypatch):
    payload = {
        "data": [
            {
                "apellidosNombre": "Abades Martínez, Cristina",
                "nombreCircunscripcion": "Lugo",
                "nombre": "Cristina",
                "apellidos": "Abades Martínez",
                "formacion": "PP",
                "grupo": "Grupo Parlamentario Popular en el Congreso",
                "idLegislatura": 15,
                "codParlamentario": 160,
            }
        ]
    }
    monkeypatch.setattr("congreso.directory._curl", lambda url, data=None: json.dumps(payload))

    rows = fetch_active_directory()
    assert len(rows) == 1
    assert rows[0].full_name == "Abades Martínez, Cristina"
    assert rows[0].cod_parlamentario == "160"
    assert rows[0].legislature_number == 15


def test_normalize_name_strips_accents_and_collapses_spaces():
    assert normalize_name("  Álvarez   González, Alicia ") == "alvarez gonzalez, alicia"
