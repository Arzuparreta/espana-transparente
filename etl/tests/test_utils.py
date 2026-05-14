from common.organizations import normalize_organization_name
from common.utils import extract_ministry_from_body, normalize_ministry


def test_normalize_ministry_removes_accents_and_collapses_spaces():
    assert normalize_ministry("  Ministerio de Economía,   Comercio y Empresa ") == (
        "MINISTERIO DE ECONOMIA, COMERCIO Y EMPRESA"
    )


def test_extract_ministry_from_body_finds_ministry_fragment():
    body = "Subdirección General. Ministerio de Hacienda. Secretaría de Estado"
    assert extract_ministry_from_body(body) == "MINISTERIO DE HACIENDA"


def test_normalize_organization_name_strips_legal_suffixes():
    assert normalize_organization_name("Telefónica, S.A.") == "telefonica"
