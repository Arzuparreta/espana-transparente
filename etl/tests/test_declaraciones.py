"""Smoke test for the declarations HTML parser.

Locks in the URL pattern the Congress publishes today
(/docbienes/leg15/... and /docacteco/leg15/...). If Congress changes
either path, dates in filename, or the regex pattern, this fails and
points us at the parser before the daily run silently degrades.
"""

from pathlib import Path

from congreso.declaraciones import cod_from_photo_url, parse_declarations

FIXTURES = Path(__file__).parent / "fixtures"


def _load(name: str) -> str:
    return (FIXTURES / name).read_text(encoding="utf-8")


def test_cod_extracted_from_photo_url():
    assert cod_from_photo_url("https://www.congreso.es/img/diputados/126.jpg") == "126"
    assert cod_from_photo_url("https://www.congreso.es/img/diputados/000007.jpg") == "000007"
    assert cod_from_photo_url(None) is None
    assert cod_from_photo_url("https://example.com/no-match.png") is None


def test_palencia_ficha_yields_one_bienes_and_one_intereses():
    decls = parse_declarations(_load("ficha_palencia.html"))

    assert len(decls) == 2
    kinds = sorted(d["kind"] for d in decls)
    assert kinds == ["bienes_rentas", "intereses_economicos"]

    for d in decls:
        assert d["declaration_date"] == "2023-07-31"
        assert d["source_url"].startswith("https://www.congreso.es/")
        assert d["source_url"].endswith(".pdf")
        assert d["internal_cod"] == "000002"


def test_salazar_ficha_yields_two_bienes_updates():
    decls = parse_declarations(_load("ficha_salazar.html"))

    bienes = [d for d in decls if d["kind"] == "bienes_rentas"]
    intereses = [d for d in decls if d["kind"] == "intereses_economicos"]

    assert len(bienes) == 2, "expected initial declaration plus one update"
    assert len(intereses) == 1
    assert {b["declaration_date"] for b in bienes} == {"2023-08-07", "2023-11-29"}
    assert intereses[0]["declaration_date"] == "2023-08-07"


def test_empty_html_yields_no_declarations():
    assert parse_declarations("<html><body>nada que ver</body></html>") == []
