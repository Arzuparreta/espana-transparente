"""Smoke tests for senado.senadores (offline — no network)."""

import pytest
from senado.senadores import (
    senate_id_from_name,
    parse_name,
    acronym_from_party,
    _get_meta,
    scrape_ficha,
)

# ── senate_id_from_name ──────────────────────────────────────────────────────

def test_senate_id_prefix():
    cid = senate_id_from_name("ARENAS BOCANEGRA, FRANCISCO JAVIER")
    assert cid.startswith("sen-")


def test_senate_id_stable():
    a = senate_id_from_name("PÉREZ GARCÍA, JOSÉ")
    b = senate_id_from_name("PÉREZ GARCÍA, JOSÉ")
    assert a == b


def test_senate_id_unique():
    a = senate_id_from_name("GARCÍA LÓPEZ, ANA")
    b = senate_id_from_name("FERNÁNDEZ RUIZ, ANTONIO")
    assert a != b


def test_senate_id_no_special_chars():
    cid = senate_id_from_name("ÍÑIGUEZ MOLINA, ÓSCAR")
    assert all(c not in cid for c in "áéíóúñü")


# ── parse_name ───────────────────────────────────────────────────────────────

def test_parse_name_comma_format():
    first, last = parse_name("ARENAS BOCANEGRA, FRANCISCO JAVIER")
    assert first == "Francisco Javier"
    assert last == "Arenas Bocanegra"


def test_parse_name_single_surname():
    first, last = parse_name("RUIZ, ANA")
    assert first == "Ana"
    assert last == "Ruiz"


def test_parse_name_no_comma():
    first, last = parse_name("JUAN CARLOS PÉREZ")
    assert len(first) > 0
    assert len(last) > 0


def test_parse_name_strips_whitespace():
    first, last = parse_name("  ROMERO PÉREZ, MARTA  ")
    assert first == "Marta"
    assert last == "Romero Pérez"


# ── acronym_from_party ───────────────────────────────────────────────────────

def test_acronym_pp():
    assert acronym_from_party("PARTIDO POPULAR", "GRUPO PARLAMENTARIO POPULAR EN EL SENADO") == "PP"


def test_acronym_psoe():
    assert acronym_from_party("PARTIDO SOCIALISTA OBRERO ESPAÑOL", "GRUPO PARLAMENTARIO SOCIALISTA") == "PSOE"


def test_acronym_eajpnv():
    assert acronym_from_party("EAJ-PNV", "GRUPO PARLAMENTARIO VASCO") == "EAJ-PNV"


def test_acronym_unknown_fallback():
    acr = acronym_from_party("PARTIDO DESCONOCIDO", "GRUPO MIXTO")
    assert len(acr) > 0


# ── _get_meta ────────────────────────────────────────────────────────────────

SAMPLE_HTML = """
<html>
<head>
<meta name="Nombre" content="FRANCISCO JAVIER ARENAS BOCANEGRA"/>
<meta name="Partido politico" content="PARTIDO POPULAR"/>
<meta name="Grupo Parlamentario" content="GRUPO PARLAMENTARIO POPULAR EN EL SENADO"/>
<meta name="Tipo Procedencia" content="DESIGNADO"/>
<meta name="Procedencia" content="ANDALUCÍA"/>
<meta name="Legislatura" content="15"/>
<meta name="Sexo" content="V"/>
</head>
<body></body>
</html>
"""


def test_get_meta_nombre():
    assert _get_meta(SAMPLE_HTML, "Nombre") == "FRANCISCO JAVIER ARENAS BOCANEGRA"


def test_get_meta_partido():
    assert _get_meta(SAMPLE_HTML, "Partido politico") == "PARTIDO POPULAR"


def test_get_meta_missing():
    assert _get_meta(SAMPLE_HTML, "NoExiste") == ""


def test_get_meta_procedencia():
    assert _get_meta(SAMPLE_HTML, "Procedencia") == "ANDALUCÍA"


def test_get_meta_legislatura():
    assert _get_meta(SAMPLE_HTML, "Legislatura") == "15"


# ── scrape_ficha (offline, mocked HTML) ─────────────────────────────────────

def test_scrape_ficha_offline(monkeypatch):
    """scrape_ficha parses meta tags correctly when given a pre-built HTML."""
    import senado.senadores as mod

    def fake_fetch(url):
        return SAMPLE_HTML + '<img src="https://www.senado.es/legis15/senadores/fotos/S15001.jpg"/>'

    monkeypatch.setattr(mod, "_fetch", fake_fetch)
    monkeypatch.setattr(mod, "time", type("T", (), {"sleep": staticmethod(lambda x: None)})())

    result = mod.scrape_ficha("/web/fichasenador/index.html?id1=99999&legis=15")
    assert result["nombre"] == "FRANCISCO JAVIER ARENAS BOCANEGRA"
    assert result["partido"] == "PARTIDO POPULAR"
    assert result["tipo_procedencia"] == "DESIGNADO"
    assert result["procedencia"] == "ANDALUCÍA"
    assert result["photo_url"] == "https://www.senado.es/legis15/senadores/fotos/S15001.jpg"


# ── request headers (regression: senado.es 403 from datacenter IPs) ──────────

def test_curl_header_args_carries_sec_fetch():
    """senado.es only serves content when the request looks like a navigation.

    Plain curl (any User-Agent) gets a 403 "Access Denied" from Akamai when the
    caller is a datacenter IP; adding the Sec-Fetch-* set is what unblocks it.
    """
    from common.http_headers import curl_header_args

    args = curl_header_args()
    rendered = dict(
        arg.split(": ", 1) for flag, arg in zip(args[::2], args[1::2]) if flag == "-H"
    )
    assert rendered["Sec-Fetch-Mode"] == "navigate"
    assert rendered["Sec-Fetch-Dest"] == "document"
    assert rendered["Sec-Fetch-Site"] == "none"
    assert "Chrome" in rendered["User-Agent"]


def test_senado_scrapers_use_shared_headers():
    """All three Senate scrapers must go through the same header set."""
    import inspect

    from senado import bajas, senadores, votaciones

    for module in (senadores, bajas, votaciones):
        source = inspect.getsource(module)
        assert "curl_header_args()" in source, module.__name__
        assert 'f"User-Agent: {UA}"' not in source, module.__name__


# ── scrape_list parsing ──────────────────────────────────────────────────────

_LIST_HTML = """
<ul class="lista-alterna">
<li class="alterna three-col"><span class="col-1"><a title="ficha"
href="/web/composicionorganizacion/senadores/composicionsenado/fichasenador/index.html;jsessionid=ABC?id1=19848&legis=15"
class="text_c2">ABDESELAM AL LAL, ABDELHAKIM</a></span><span class="col-2">
<abbr title="GRUPO PARLAMENTARIO POPULAR EN EL SENADO">GPP</abbr></span>
<span class="col-3">Electo:  Ceuta</span></li>
<li class=" three-col"><span class="col-1"><a title="ficha"
href="/web/composicionorganizacion/senadores/composicionsenado/fichasenador/index.html;jsessionid=ABC?id1=20017&legis=15"
class="text_c2">ADRIAN GUTIERREZ, MIGUEL ANGEL</a></span><span class="col-2">
<abbr title="GRUPO PARLAMENTARIO SOCIALISTA">GPS</abbr></span>
<span class="col-3">Electo:  Burgos</span></li>
</ul>
"""


def _scrape_list_from(html, monkeypatch):
    from senado import senadores as mod

    monkeypatch.setattr(mod, "LETTERS", ["A"])
    monkeypatch.setattr(mod, "REQUEST_DELAY", 0)
    monkeypatch.setattr(mod, "_fetch", lambda url: html)
    return mod.scrape_list()


def test_scrape_list_extracts_ids_and_row_text(monkeypatch):
    rows = _scrape_list_from(_LIST_HTML, monkeypatch)
    assert [r["senate_id_num"] for r in rows] == ["19848", "20017"]
    # Each row must carry its OWN <li> text, not the first <li> on the page.
    assert rows[0]["li_text"].startswith("ABDESELAM AL LAL, ABDELHAKIM")
    assert rows[1]["li_text"].startswith("ADRIAN GUTIERREZ, MIGUEL ANGEL")
    # Opening-tag attributes must not leak into the text.
    assert "three-col" not in rows[0]["li_text"]


def test_scrape_list_row_text_supports_name_fallback(monkeypatch):
    """run() falls back to li_text.split("G")[0] when the ficha has no name."""
    rows = _scrape_list_from(_LIST_HTML, monkeypatch)
    assert rows[0]["li_text"].split("G")[0].strip() == "ABDESELAM AL LAL, ABDELHAKIM"


def test_run_refuses_to_succeed_on_empty_index(monkeypatch):
    """A blocked scrape must fail loudly, not report a successful no-op run.

    This is the regression that mattered most: senado.es answered 403, the
    parser found zero senators, and the pipeline still recorded 'succeeded',
    so the site showed months-old Senate data with a green status.
    """
    from senado import senadores as mod

    monkeypatch.setattr(mod, "scrape_list", lambda: [])
    monkeypatch.setattr(mod, "get_pg_conn", lambda: _FakeConn())
    with pytest.raises(RuntimeError, match="0 senators"):
        mod.run(dry_run=True)


class _FakeCursor:
    def execute(self, *args, **kwargs):
        return None

    def fetchone(self):
        return (1,)

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


class _FakeConn:
    def cursor(self, *args, **kwargs):
        return _FakeCursor()

    def close(self):
        return None


# ── block-page detection ─────────────────────────────────────────────────────

_BLOCK_PAGE = """<HTML><HEAD>
<TITLE>Access Denied</TITLE>
</HEAD><BODY>
<H1>Access Denied</H1>
You don't have permission to access "http://www.senado.es/web/" on this server.
<P>Reference&#32;&#35;18&#46;1234</P>
</BODY></HTML>"""


def test_block_page_is_recognised():
    """Distinguish "we were blocked" from "the markup changed".

    Both surface as "the parser found nothing", but only one is a code problem,
    and saying which saves the next person the investigation.
    """
    from common.http_headers import looks_like_block_page

    assert looks_like_block_page(_BLOCK_PAGE) is True


def test_real_page_is_not_mistaken_for_a_block():
    from common.http_headers import looks_like_block_page

    real = "<html><body>" + ("<li>ABDESELAM AL LAL, ABDELHAKIM</li>" * 200) + "</body></html>"
    assert looks_like_block_page(real) is False


def test_long_page_quoting_the_phrase_is_not_a_block():
    """The denial body is tiny; a real page merely quoting it must pass."""
    from common.http_headers import looks_like_block_page

    article = "<html><body>" + ("x" * 5000) + "Access Denied</body></html>"
    assert looks_like_block_page(article) is False


def test_fetch_raises_a_specific_error_when_blocked(monkeypatch):
    import subprocess as sp

    from senado import senadores as mod

    class _R:
        returncode = 0
        stdout = _BLOCK_PAGE.encode()
        stderr = b""

    monkeypatch.setattr(sp, "run", lambda *a, **kw: _R())
    with pytest.raises(RuntimeError, match="Access Denied page"):
        mod._fetch("https://www.senado.es/web/anything")
