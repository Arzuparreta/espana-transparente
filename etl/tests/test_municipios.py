from territorio.municipios import (
    municipio_key,
    name_variants,
    normalize_name,
    parse_municipios,
    resolve_body_to_municipality,
)


def test_parse_municipios_explicit_code():
    payload = [
        {"Codigo": "28079", "Nombre": "Madrid"},
        {"Codigo": "08019", "Nombre": "Barcelona"},
    ]
    out = parse_municipios(payload)
    assert {m.ine_code for m in out} == {"28079", "08019"}
    madrid = next(m for m in out if m.ine_code == "28079")
    assert madrid.province_key == "MADRID_PROVINCE"
    assert madrid.territory_key == "MUNI_28079"


def test_parse_municipios_code_prefixed_name():
    # INE sometimes embeds the code in the Nombre field.
    out = parse_municipios([{"Nombre": "15030 Coruña, A"}])
    assert len(out) == 1
    assert out[0].ine_code == "15030"
    assert out[0].province_key == "A_CORUNA"


def test_parse_municipios_skips_unknown_province_and_dupes():
    payload = [
        {"Codigo": "99001", "Nombre": "Nowhere"},   # province 99 not mapped
        {"Codigo": "28079", "Nombre": "Madrid"},
        {"Codigo": "28079", "Nombre": "Madrid (dup)"},
    ]
    out = parse_municipios(payload)
    assert [m.ine_code for m in out] == ["28079"]


def test_normalize_name_deinverts_articles():
    # INE inverts trailing articles; a town name in normal order must still match.
    assert normalize_name("Coruña, A") == normalize_name("A Coruña") == "A CORUNA"
    assert normalize_name("Palmas de Gran Canaria, Las") == "LAS PALMAS DE GRAN CANARIA"
    assert normalize_name("Madrid") == "MADRID"


def test_municipio_key():
    assert municipio_key("28079") == "MUNI_28079"


def test_name_variants_splits_bilingual():
    # INE bilingual labels index both sides so either form resolves.
    assert name_variants("Oronz/Orontze") == {"ORONZ ORONTZE", "ORONZ", "ORONTZE"}
    assert name_variants("Madrid") == {"MADRID"}


def test_resolve_body_unique_match():
    index = {"SALAMANCA": ["MUNI_37274"]}
    assert resolve_body_to_municipality("AYUNTAMIENTO DE SALAMANCA", index) == "MUNI_37274"


def test_resolve_body_ambiguous_returns_none():
    # Two municipios share the normalized name -> never guess.
    index = {"VILLANUEVA": ["MUNI_06154", "MUNI_14062"]}
    assert resolve_body_to_municipality("AYUNTAMIENTO DE VILLANUEVA", index) is None


def test_resolve_body_no_town_returns_none():
    index = {"SALAMANCA": ["MUNI_37274"]}
    assert resolve_body_to_municipality("MINISTERIO DE HACIENDA", index) is None
    assert resolve_body_to_municipality(None, index) is None
