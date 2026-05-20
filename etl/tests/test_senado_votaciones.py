from src.senado.votaciones import (
    parse_initiative_vote_index,
    parse_senate_date_label,
    parse_session_catalog,
)

SAMPLE_SESSION_CATALOG = """<?xml version="1.0" encoding="UTF-8" ?>
<listaSesionesPlenarias>
<sesionPlenaria>
<sesionNumero><![CDATA[60]]></sesionNumero>
<sesionFechaInicio><![CDATA[7 de octubre de 2025]]></sesionFechaInicio>
<sesionTitulo><![CDATA[Sesión plenaria número 60]]></sesionTitulo>
<fichUrlVotaciones><![CDATA[/legis15/votaciones/ses_60.xml]]></fichUrlVotaciones>
</sesionPlenaria>
</listaSesionesPlenarias>
"""

SAMPLE_INITIATIVE_VOTES = """<?xml version="1.0" encoding="UTF-8" ?>
<iniciativaVotaciones>
<tipoExpediente><![CDATA[600]]></tipoExpediente>
<numeroExpediente><![CDATA[000001]]></numeroExpediente>
<votaciones>
<votacion>
<fichGenVotacion>
<fichUrlVotacion><![CDATA[https://www.senado.es/legis15/votaciones/ses_10_52.xml]]></fichUrlVotacion>
</fichGenVotacion>
</votacion>
</votaciones>
</iniciativaVotaciones>
"""


def test_parse_session_catalog():
    sessions = parse_session_catalog(SAMPLE_SESSION_CATALOG)
    assert len(sessions) == 1
    assert sessions[0].session_number == 60
    assert sessions[0].vote_xml_path == "/legis15/votaciones/ses_60.xml"


def test_parse_senate_date_label():
    assert parse_senate_date_label("7 de octubre de 2025") == "2025-10-07"
    assert parse_senate_date_label(None) is None


def test_parse_initiative_vote_index():
    votes = parse_initiative_vote_index(SAMPLE_INITIATIVE_VOTES)
    assert votes == [("600", "000001", "https://www.senado.es/legis15/votaciones/ses_10_52.xml")]
