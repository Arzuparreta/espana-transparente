from common.organizations import normalize_nif
from territorio.org_geolocation import (
    cif_province_key,
    resolve_org_location,
)


def test_normalize_nif():
    assert normalize_nif(" a-58.818.501 ") == "A58818501"
    assert normalize_nif(None) is None
    assert normalize_nif("") is None


def test_cif_province_key_company():
    # A58... -> province 58? no, 58 not valid. Use a real province code.
    assert cif_province_key("A28015865") == "MADRID_PROVINCE"   # 28 = Madrid
    assert cif_province_key("B08000000") == "BARCELONA"          # 08 = Barcelona
    assert cif_province_key("Q1518001A") == "A_CORUNA"           # 15 = A Coruña


def test_cif_province_key_rejects_personal_and_invalid():
    assert cif_province_key("12345678Z") is None     # personal NIF (DNI)
    assert cif_province_key("K1234567L") is None      # personal K-type
    assert cif_province_key("A9912345J") is None      # province 99 not mapped
    assert cif_province_key(None) is None
    assert cif_province_key("not-a-nif") is None


def test_resolve_prefers_name_match_over_cif():
    name_index = {"SALAMANCA": ["MUNI_37274"]}
    province_of = {"MUNI_37274": "SALAMANCA"}
    loc = resolve_org_location("AYUNTAMIENTO DE SALAMANCA", "A28015865", name_index, province_of)
    assert loc is not None
    assert loc.municipality_key == "MUNI_37274"
    assert loc.province_key == "SALAMANCA"
    assert loc.source == "name_match"


def test_resolve_falls_back_to_cif_for_company():
    loc = resolve_org_location("CONSTRUCCIONES ACME S.A.", "A28015865", {}, {})
    assert loc is not None
    assert loc.municipality_key is None
    assert loc.province_key == "MADRID_PROVINCE"
    assert loc.source == "cif"


def test_resolve_ambiguous_name_without_cif_is_none():
    name_index = {"VILLANUEVA": ["MUNI_06154", "MUNI_14062"]}
    loc = resolve_org_location("AYUNTAMIENTO DE VILLANUEVA", None, name_index, {})
    assert loc is None


def test_resolve_unresolvable_company_without_nif():
    assert resolve_org_location("CONSULTORA GLOBAL SL", None, {}, {}) is None
