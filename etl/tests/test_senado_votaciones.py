from src.senado.votaciones import (
    normalize_vote,
    parse_open_data_catalog_links,
    parse_initiative_vote_index,
    parse_senate_date_label,
    parse_senate_session_vote_xml,
    parse_senate_vote_date,
    parse_session_catalog,
    senate_name_keys,
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

SAMPLE_SESSION_VOTES = """<?xml version="1.0" encoding="ISO-8859-1" standalone="yes"?>
<main>
  <sesion>
    <num_sesion>60</num_sesion>
    <fecha_sesion>07/10/2025</fecha_sesion>
    <votacion>
      <num_vot>1</num_vot>
      <CodVotacion>10850</CodVotacion>
      <num_exp>671/000085</num_exp>
      <tit_vot>Moción relativa a la financiación local.</tit_vot>
      <tit_sec>Texto de la votación</tit_sec>
      <fecha_v>08-OCT-2025</fecha_v>
      <hora_vot>15:07</hora_vot>
      <tot_presentes>2</tot_presentes>
      <tot_afirmativos>1</tot_afirmativos>
      <tot_negativos>1</tot_negativos>
      <tot_abstenciones>0</tot_abstenciones>
      <tot_novotan>0</tot_novotan>
      <tot_nulos>0</tot_nulos>
      <tot_ausentes>1</tot_ausentes>
      <resultado>
        <VotoSenador>
          <escano>118</escano>
          <grupo>GRUPO PARLAMENTARIO POPULAR EN EL SENADO</grupo>
          <nombre>MARÍA DEL CARMEN LEYTE COELLO</nombre>
          <voto>SÍ</voto>
        </VotoSenador>
        <VotoSenador>
          <escano>132</escano>
          <grupo>GRUPO PARLAMENTARIO SOCIALISTA</grupo>
          <nombre>JOSÉ ANTONIO VALBUENA ALONSO</nombre>
          <voto>NO</voto>
        </VotoSenador>
      </resultado>
      <ausentes>
        <ausencia>
          <escano>268</escano>
          <grupo>GRUPO PARLAMENTARIO POPULAR EN EL SENADO</grupo>
          <nombre>JOSÉ MANUEL ARANDA LASSA</nombre>
        </ausencia>
      </ausentes>
    </votacion>
  </sesion>
</main>
"""


def test_parse_session_catalog():
    sessions = parse_session_catalog(SAMPLE_SESSION_CATALOG)
    assert len(sessions) == 1
    assert sessions[0].session_number == 60
    assert sessions[0].vote_xml_path == "/legis15/votaciones/ses_60.xml"


def test_parse_senate_date_label():
    assert parse_senate_date_label("7 de octubre de 2025") == "2025-10-07"
    assert parse_senate_date_label(None) is None


def test_parse_senate_vote_date():
    assert parse_senate_vote_date("08-OCT-2025") == "2025-10-08"
    assert parse_senate_vote_date("07/10/2025") == "2025-10-07"


def test_parse_initiative_vote_index():
    votes = parse_initiative_vote_index(SAMPLE_INITIATIVE_VOTES)
    assert votes == [("600", "000001", "https://www.senado.es/legis15/votaciones/ses_10_52.xml")]


def test_parse_open_data_catalog_links():
    html = """
    <a href="/legis15/votaciones/ses_60.xml">XML</a>
    <a href="https://www.senado.es/legis15/votaciones/ses_10.xml">XML</a>
    <a href="/legis15/votaciones/ses_60.xml">duplicado</a>
    """
    assert parse_open_data_catalog_links(html) == [
        "https://www.senado.es/legis15/votaciones/ses_10.xml",
        "https://www.senado.es/legis15/votaciones/ses_60.xml",
    ]


def test_normalize_vote():
    assert normalize_vote("SÍ") == "Sí"
    assert normalize_vote("ABSTENCIÓN") == "Abstención"
    assert normalize_vote("NO") == "No"


def test_senate_name_keys_include_particleless_alias():
    assert senate_name_keys("MARÍA DEL CARMEN LEYTE COELLO") == {
        "maria del carmen leyte coello",
        "maria carmen leyte coello",
    }


def test_parse_senate_session_vote_xml():
    votations = parse_senate_session_vote_xml(
        SAMPLE_SESSION_VOTES,
        source_url="https://www.senado.es/legis15/votaciones/ses_60.xml",
    )
    assert len(votations) == 1
    votation = votations[0]
    assert votation.session_number == 60
    assert votation.session_date == "2025-10-07"
    assert votation.votation_number == 1
    assert votation.code == "10850"
    assert votation.initiative_number == "671/000085"
    assert votation.vote_date == "2025-10-08"
    assert votation.totals["afirmativos"] == 1
    assert [row.vote for row in votation.votes] == ["Sí", "No", "No vota"]
    assert votation.votes[-1].absent is True
