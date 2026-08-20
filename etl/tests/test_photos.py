"""Unit tests for the photos pipeline.

Covers pure logic (Jaccard matching, source priority) and Pillow-backed
validation/resize. No network or DB access.
"""

import io
from typing import Optional

import pytest
from PIL import Image

from photos.sources.base import PoliticianRow, SourceMatch
from photos.sources.congreso import CongresoOficialSource
from photos.sources.wikidata import (
    WikidataSource,
    _jaccard,
    _normalize,
    _qid_from_iri,
)
from photos.validate import (
    DownloadResult,
    MIN_BYTES,
    PhotoValidationError,
    TARGET_SIZE,
    average_hash_hex,
    build_responsive_variants,
    to_webp_square,
)


# ---- normalization / jaccard ------------------------------------------------


def test_normalize_strips_accents_and_short_tokens():
    assert _normalize("José Luis Rodríguez-Zapatero") == frozenset(
        {"jose", "luis", "rodriguez", "zapatero"}
    )


def test_normalize_ignores_single_letters_and_punctuation():
    assert _normalize("A. B. García") == frozenset({"garcia"})


def test_jaccard_identical_sets_returns_one():
    assert _jaccard(frozenset({"a", "b"}), frozenset({"a", "b"})) == 1.0


def test_jaccard_empty_returns_zero():
    assert _jaccard(frozenset(), frozenset({"a"})) == 0.0


def test_qid_extracted_from_entity_iri():
    assert _qid_from_iri("http://www.wikidata.org/entity/Q3300") == "Q3300"
    assert _qid_from_iri("nonsense") is None


# ---- WikidataSource matching ------------------------------------------------


def _make_pol(*, cod: Optional[str] = None, name: str = "Pedro Sánchez Pérez-Castejón") -> PoliticianRow:
    return PoliticianRow(
        id="00000000-0000-0000-0000-000000000001",
        congress_id=f"slug-{name.lower().replace(' ', '-')}",
        full_name=name,
        first_name=name.split()[0],
        last_name=" ".join(name.split()[1:]),
        cod_parlamentario=cod,
        wikidata_qid=None,
        party_acronym="PSOE",
        position_types=(),
    )


def _seed_wikidata_source(entries: list[dict]) -> WikidataSource:
    src = WikidataSource()
    src._index = []
    src._by_congress_id = {}
    for raw in entries:
        normalized = {
            "qid": raw["qid"],
            "label": raw["label"],
            "tokens": _normalize(raw["label"]),
            "photo": raw["photo"],
            "congress_id": raw.get("congress_id"),
        }
        src._index.append(normalized)
        if normalized["congress_id"]:
            src._by_congress_id[normalized["congress_id"]] = normalized
    return src


def test_wikidata_p1768_match_wins_over_name(monkeypatch):
    """If cod_parlamentario matches a Wikidata P1768, that wins even when a
    different name has a higher Jaccard score."""
    src = _seed_wikidata_source([
        {"qid": "Q1", "label": "Some Other Person", "photo": "p1", "congress_id": "271"},
        {"qid": "Q2", "label": "Pedro Sánchez Pérez-Castejón", "photo": "p2"},
    ])
    captured = {}

    def fake_dl(url: str, **_kwargs):
        captured["url"] = url
        return DownloadResult(
            data=b"\x89PNG\r\n\x1a\n" + b"\x00" * 4096,
            final_url="https://upload.wikimedia.org/test.webp",
        )

    def fake_norm(_raw: bytes) -> bytes:
        return b"webp-bytes"

    monkeypatch.setattr("photos.sources.wikidata.download_with_final_url", fake_dl)
    monkeypatch.setattr("photos.sources.wikidata.to_webp_square", fake_norm)

    pol = _make_pol(cod="271")
    match = src.find(pol)
    assert match is not None
    assert match.wikidata_qid == "Q1"
    assert captured["url"] == "p1"
    assert match.source_url == "https://upload.wikimedia.org/test.webp"


def test_wikidata_name_jaccard_below_threshold_returns_none(monkeypatch):
    src = _seed_wikidata_source([
        {"qid": "Q9", "label": "Mariano Rajoy Brey", "photo": "p"},
    ])

    monkeypatch.setattr("photos.sources.wikidata.download_with_final_url",
                        lambda url, **_kwargs: pytest.fail("should not download"))

    pol = _make_pol(name="Pedro Sánchez Pérez-Castejón")
    assert src.find(pol) is None


def test_wikidata_name_jaccard_above_threshold_matches(monkeypatch):
    src = _seed_wikidata_source([
        {"qid": "Q42", "label": "Pedro Sánchez Pérez-Castejón", "photo": "p"},
    ])
    monkeypatch.setattr(
        "photos.sources.wikidata.download_with_final_url",
        lambda url, **_kwargs: DownloadResult(data=b"x" * 4096, final_url="https://upload.wikimedia.org/p.webp"),
    )
    monkeypatch.setattr("photos.sources.wikidata.to_webp_square", lambda raw: b"w")

    pol = _make_pol(name="Pedro Sánchez Pérez-Castejón")
    match = src.find(pol)
    assert match is not None
    assert match.wikidata_qid == "Q42"
    assert match.source == "wikidata"
    assert match.source_url == "https://upload.wikimedia.org/p.webp"


def test_wikidata_requires_two_shared_tokens(monkeypatch):
    """One shared token isn't enough even with a high Jaccard ratio."""
    src = _seed_wikidata_source([
        {"qid": "Q1", "label": "Pedro", "photo": "p"},
    ])
    monkeypatch.setattr("photos.sources.wikidata.download_with_final_url",
                        lambda url, **_kwargs: pytest.fail("should not download"))

    pol = _make_pol(name="Pedro Sánchez Pérez-Castejón")
    assert src.find(pol) is None


# ---- validate / resize ------------------------------------------------------


def _make_png(width: int = 800, height: int = 1200, color=(20, 30, 40)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (width, height), color).save(buf, format="PNG")
    return buf.getvalue()


def test_to_webp_square_returns_target_size():
    out = to_webp_square(_make_png(800, 1200))
    img = Image.open(io.BytesIO(out))
    assert img.size == (TARGET_SIZE, TARGET_SIZE)
    assert img.format == "WEBP"


def test_to_webp_square_cover_crops_instead_of_padding():
    source = Image.new("RGB", (1000, 500), (255, 0, 0))
    for x in range(450, 550):
        for y in range(0, 500):
            source.putpixel((x, y), (0, 255, 0))
    buf = io.BytesIO()
    source.save(buf, format="PNG")
    out = to_webp_square(buf.getvalue())
    img = Image.open(io.BytesIO(out)).convert("RGB")
    # No grey padding should remain after the cover-crop normalization.
    r, g, b = img.getpixel((0, 0))
    assert not (r >= 230 and g >= 230 and b >= 230), f"unexpected padding-like corner: {(r, g, b)}"
    assert img.size == (TARGET_SIZE, TARGET_SIZE)


def test_to_webp_square_rejects_non_image():
    with pytest.raises(PhotoValidationError):
        to_webp_square(b"not an image at all" * 50)


def test_build_responsive_variants_returns_expected_sizes():
    variants = build_responsive_variants(_make_png(800, 1200))
    assert sorted(variants) == [64, 128, 256, 512]
    for size, payload in variants.items():
        img = Image.open(io.BytesIO(payload))
        assert img.size == (size, size)
        assert img.format == "WEBP"


def test_average_hash_is_stable_for_identical_input():
    payload = _make_png(640, 640, color=(120, 40, 90))
    assert average_hash_hex(payload) == average_hash_hex(payload)


def test_min_bytes_constant_is_reasonable():
    """Sanity check: tiny error pages (a few bytes of HTML) are filtered."""
    assert MIN_BYTES >= 512


# ---- source priority --------------------------------------------------------


def test_source_priorities_are_strict_order():
    from photos.sources import ALL_SOURCES
    priorities = [s.priority for s in ALL_SOURCES]
    assert priorities == sorted(priorities)
    assert len(set(priorities)) == len(priorities), "priorities must be unique"


def test_politician_key_normalizes_to_ascii():
    from photos.storage import politician_key
    assert politician_key("agüera-gago-cristina-576494ca") == "politicians/aguera-gago-cristina-576494ca.webp"
    assert politician_key("alonso-cantorne-fèlix-d0c0f7f7") == "politicians/alonso-cantorne-felix-d0c0f7f7.webp"


def test_alcaldes_source_skips_non_mayors():
    """The mayor-specific source must not fire for plain deputies."""
    from photos.sources.alcaldes_wikidata import AlcaldesWikidataSource
    src = AlcaldesWikidataSource()
    pol = _make_pol()  # position_types=()
    assert src.find(pol) is None


def test_congreso_source_uses_current_docu_imgweb_path(monkeypatch):
    src = CongresoOficialSource()
    captured = {}

    def fake_dl(url: str, **_kwargs):
        captured["url"] = url
        return DownloadResult(data=b"x" * 4096, final_url=url)

    monkeypatch.setattr("photos.sources.congreso.download_with_final_url", fake_dl)
    monkeypatch.setattr("photos.sources.congreso.to_webp_square", lambda raw: b"w")

    pol = _make_pol(cod="160")
    match = src.find(pol)
    assert match is not None
    assert captured["url"] == "https://www.congreso.es/docu/imgweb/diputados/160_15.jpg"
    assert match.source_url == captured["url"]


# ---- SourceMatch dataclass --------------------------------------------------


def test_source_match_carries_wikidata_qid():
    m = SourceMatch(photo_bytes=b"x", source="wikidata", wikidata_qid="Q1")
    assert m.wikidata_qid == "Q1"
    assert m.source == "wikidata"


def test_unmatched_photos_are_not_a_technical_failure():
    from photos.pipeline import RunStats
    from photos.run import _exit_code

    assert _exit_code(RunStats(candidates=145, unmatched=145)) == 0


def test_photo_source_errors_fail_when_nothing_was_updated():
    from photos.pipeline import RunStats
    from photos.run import _exit_code

    assert _exit_code(RunStats(candidates=1, source_errors=1)) == 1
    assert _exit_code(RunStats(candidates=2, updated=1, source_errors=1)) == 0


# ── senado_oficial source ────────────────────────────────────────────────────

def _senator_row(photo_url="https://www.senado.es/legis15/senadores/fotos/S15110.jpg"):
    from photos.sources.base import PoliticianRow

    return PoliticianRow(
        id="00000000-0000-0000-0000-000000000001",
        congress_id="sen-test-1",
        full_name="TEST SENADOR",
        first_name="Test",
        last_name="Senador",
        cod_parlamentario=None,
        wikidata_qid=None,
        party_acronym="PP",
        photo_url=photo_url,
    )


def test_senado_source_ignores_non_senate_photo_urls():
    from photos.sources.senado import SenadoOficialSource

    src = SenadoOficialSource()
    assert src.find(_senator_row(photo_url=None)) is None
    assert src.find(_senator_row("https://www.congreso.es/docu/imgweb/x.jpg")) is None


def test_senado_source_retires_after_repeated_failures(monkeypatch):
    """senado.es blocks its static photo path from datacenter IPs.

    The source must record that once and stop, instead of re-failing for every
    senator in the backlog and inflating source_errors by two orders of
    magnitude.
    """
    from photos import validate
    from photos.sources import senado as senado_source

    calls = {"n": 0}

    def _always_blocked(*args, **kwargs):
        calls["n"] += 1
        raise validate.PhotoValidationError("unexpected content-type: 'text/html'")

    monkeypatch.setattr(senado_source, "download_with_final_url", _always_blocked)

    src = senado_source.SenadoOficialSource()
    for _ in range(50):
        assert src.find(_senator_row()) is None

    assert calls["n"] == senado_source.CIRCUIT_BREAK_AFTER


def test_senado_source_returns_match_when_reachable(monkeypatch):
    from photos.sources import senado as senado_source
    from photos.validate import DownloadResult

    monkeypatch.setattr(
        senado_source,
        "download_with_final_url",
        lambda url, **kw: DownloadResult(data=b"raw", final_url=url, content_type="image/jpeg"),
    )
    monkeypatch.setattr(senado_source, "to_webp_square", lambda data: b"webp")

    match = senado_source.SenadoOficialSource().find(_senator_row())
    assert match is not None
    assert match.source == "senado_oficial"
    assert match.source_url.endswith("S15110.jpg")


def test_senado_source_sends_browser_headers(monkeypatch):
    from photos.sources import senado as senado_source
    from photos.validate import DownloadResult

    seen = {}

    def _capture(url, **kw):
        seen.update(kw)
        return DownloadResult(data=b"raw", final_url=url, content_type="image/jpeg")

    monkeypatch.setattr(senado_source, "download_with_final_url", _capture)
    monkeypatch.setattr(senado_source, "to_webp_square", lambda data: b"webp")
    senado_source.SenadoOficialSource().find(_senator_row())

    assert seen["extra_headers"]["Sec-Fetch-Dest"] == "image"
    assert "Chrome" in seen["user_agent"]


# ── wikidata index backoff ───────────────────────────────────────────────────

def test_wikidata_index_stops_refetching_after_repeated_failures(monkeypatch):
    """A SPARQL outage must cost a bounded number of requests per run.

    Previously the index was only cached on success, so every candidate
    re-triggered the whole fetch (RETRIES requests each) during an outage.
    """
    from photos.sources import wikidata as wd

    calls = {"n": 0}

    def _boom(query):
        calls["n"] += 1
        raise RuntimeError("Wikidata SPARQL failed after 3 retries: HTTP Error 502")

    monkeypatch.setattr(wd, "_fetch_sparql", _boom)

    src = wd.WikidataSource()
    for _ in range(40):
        with pytest.raises(RuntimeError):
            src._ensure_index()

    assert calls["n"] == wd.WikidataSource.MAX_INDEX_ATTEMPTS
