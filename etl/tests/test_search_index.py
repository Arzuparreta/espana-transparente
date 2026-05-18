from common.search_index import build_search_document, chunk_text, content_hash, normalize_alias
from common.utils import search_display_name


def test_normalize_alias_removes_accents_punctuation_and_case():
    assert normalize_alias("  Mº de Sanidad / Consumo  ") == "mo de sanidad consumo"
    assert normalize_alias("Cruz Roja Española") == "cruz roja espanola"


def test_chunk_text_is_stable_and_overlapping():
    text = "Primera frase. " + "Segunda frase con datos. " * 80
    chunks = chunk_text(text, max_chars=180, overlap=30)

    assert len(chunks) > 1
    assert chunks[0].startswith("Primera frase.")
    assert all(len(chunk) <= 180 for chunk in chunks)


def test_content_hash_ignores_spacing_and_accents():
    assert content_hash("Presupuesto de Defensa") == content_hash(" presupuesto   de defensa ")
    assert content_hash("Sanidad") == content_hash("Sánidad")


def test_search_display_name_inverts_spanish_official_format():
    assert search_display_name("Sánchez Pérez-Castejón, Pedro") == "Pedro Sánchez Pérez-Castejón"
    assert search_display_name("Nombre Apellido") == "Nombre Apellido"


def test_build_search_document_skips_empty_titles_and_keeps_public_route():
    assert build_search_document(entity_type="initiative", entity_id="1", title="  ") is None

    doc = build_search_document(
        entity_type="subsidy",
        entity_id="abc",
        title="Cruz Roja Española",
        subtitle="Ministerio de Sanidad",
        body_parts=["Convocatoria sanitaria", None, "BDNS 123"],
        key_fact="120.000 EUR",
        route="/subvenciones/abc",
    )

    assert doc is not None
    assert doc.body == "Convocatoria sanitaria BDNS 123"
    assert doc.route == "/subvenciones/abc"
