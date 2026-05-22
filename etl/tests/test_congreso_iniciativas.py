from congreso.iniciativas import (
    detail_id,
    discover_sources,
    parse_record,
    parse_spanish_date,
    status_slug,
)


def test_discover_sources_filters_current_legislative_datasets():
    html = """
    <a href="/webpublica/opendata/iniciativas/IniciativasLegislativasAprobadas__20260522050020.json">JSON</a>
    <a href="/webpublica/opendata/iniciativas/ProyectosDeLey__20260522050032.json">JSON</a>
    <a href="/webpublica/opendata/iniciativas/PropuestasDeReforma__20260522050042.json">JSON</a>
    <a href="/webpublica/opendata/iniciativas/ProposicionesDeLey__20260522050159.json">JSON</a>
    """

    sources = discover_sources(html)

    assert [source["dataset"] for source in sources] == [
        "ProposicionesDeLey",
        "PropuestasDeReforma",
        "ProyectosDeLey",
    ]
    assert all(source["url"].startswith("https://www.congreso.es/") for source in sources)


def test_parse_record_maps_official_fields_to_initiative_row():
    record = {
        "LEGISLATURA": "Leg.15",
        "TIPO": "Proyecto de ley",
        "OBJETO": "  Proyecto de Ley Orgánica  de  eficiencia  del servicio público. ",
        "NUMEXPEDIENTE": "121/000001/0000",
        "FECHAPRESENTACION": "22/11/2023",
        "FECHACALIFICACION": "28/11/2023",
        "AUTOR": "Gobierno",
        "RESULTADOTRAMITACION": "Aprobado con modificaciones",
        "SITUACIONACTUAL": "Concluido",
    }

    parsed = parse_record(
        record,
        dataset="ProyectosDeLey",
        dataset_url="https://www.congreso.es/webpublica/opendata/iniciativas/ProyectosDeLey__x.json",
    )

    assert parsed is not None
    assert parsed["legislature_number"] == 15
    assert parsed["type"] == "proyecto_ley"
    assert parsed["number"] == "121/000001/0000"
    assert parsed["title"] == "Proyecto de Ley Orgánica de eficiencia del servicio público."
    assert parsed["proposer_group"] == "Gobierno"
    assert parsed["status"] == "aprobada"
    assert "_iniciativas_id=121/000001" in parsed["source_url"]
    assert parsed["raw_data"]["presentation_date"] == "2023-11-22"
    assert parsed["raw_data"]["qualification_date"] == "2023-11-28"
    assert parsed["raw_data"]["official"] == record


def test_parse_record_skips_law_publication_rows_without_numexpediente():
    assert parse_record(
        {"TIPO": "Ley Orgánica", "TITULO_LEY": "Ley publicada"},
        dataset="IniciativasLegislativasAprobadas",
        dataset_url="https://example.test/aprobadas.json",
    ) is None


def test_detail_id_drops_empty_trailing_segment():
    assert detail_id("121/000001/0000") == "121/000001"
    assert detail_id("122/000005/0001") == "122/000005/0001"


def test_status_slug_maps_common_congreso_results():
    assert status_slug("Concluido", "Aprobado") == "aprobada"
    assert status_slug("Concluido", "Rechazado") == "rechazada"
    assert status_slug("Concluido", "Retirado") == "retirada"
    assert status_slug("Cerrado", "Decaído") == "caducada"
    assert status_slug("En tramitación", "") == "en_tramitacion"


def test_parse_spanish_date_accepts_official_format():
    assert parse_spanish_date("1/2/2026") == "2026-02-01"
    assert parse_spanish_date("2026-02-01") == "2026-02-01"
    assert parse_spanish_date("") is None
