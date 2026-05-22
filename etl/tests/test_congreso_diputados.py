from congreso.diputados import canonical_party_name, extract_acronym


def test_podemos_deputy_in_mixed_group_is_not_normalized_to_sumar():
    formacion = "SUMAR"
    grupo = "Grupo Parlamentario Mixto"
    full_name = "Belarra Urteaga, Ione"

    assert extract_acronym(formacion, grupo, full_name) == "Podemos"
    assert canonical_party_name(formacion, grupo, full_name) == "Podemos"


def test_sumar_deputy_keeps_sumar_when_no_person_override():
    formacion = "SUMAR"
    grupo = "Grupo Parlamentario Plurinacional SUMAR"

    assert extract_acronym(formacion, grupo, "Díaz Pérez, Yolanda") == "SUMAR"
    assert canonical_party_name(formacion, grupo, "Díaz Pérez, Yolanda") == "SUMAR"
