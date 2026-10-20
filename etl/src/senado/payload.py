"""Transfer complete, recent official Senate XML between CI runners."""

from datetime import datetime, timezone, timedelta
import hashlib
import json
from pathlib import Path
import xml.etree.ElementTree as ET


def _parse_session_xml(xml, url, number):
    from . import votaciones as votes

    root = ET.fromstring(xml.lstrip("\ufeff \t\r\n"))
    session = root.find(".//sesion")
    if (session is None or (session.findtext("num_sesion") or "").strip() != str(number)
            or not votes.parse_senate_slash_date(session.findtext("fecha_sesion"))):
        raise ValueError(f"Invalid Senate session identity at {url}")
    parsed = votes.parse_senate_session_vote_xml(xml, url)
    if len(parsed) != len(session.findall("votacion")):
        raise ValueError(f"Unparseable Senate votations at {url}")
    # Official sessions such as 10 contain session metadata and no votes.
    return parsed


def export_payload(directory):
    from . import votaciones as votes

    target = Path(directory)
    target.mkdir(parents=True, exist_ok=True)
    urls = votes.discover_session_vote_urls()
    if not urls:
        raise RuntimeError("Senate discovery returned no sessions")
    entries = []
    not_found = []
    # Discovery includes catalog links and probes beyond the lagging catalog.
    # Sessions without a published vote export must not be invented here.
    for url in urls:
        number = votes._session_number(url)
        print(f"Fetching {url}", flush=True)
        try:
            xml = votes.curl_text(url)
            parsed = _parse_session_xml(xml, url, number)
        except (ET.ParseError, RuntimeError, ValueError) as exc:
            status = votes.curl_status(url)
            if status != 404:
                raise RuntimeError(f"Senate export failed at {url}: HTTP {status}; {exc}") from exc
            # The official catalog includes retired links such as ses_1.xml.
            # Record confirmed 404s, while every 403 remains a failure.
            not_found.append(url)
            print(f"Official catalog link returns HTTP 404: {url}", flush=True)
            continue
        data = xml.encode("utf-8")
        filename = f"ses_{number}.xml"
        (target / filename).write_bytes(data)
        entries.append(dict(url=url, file=filename, sha256=hashlib.sha256(data).hexdigest()))
        print(f"Exported session {number}: {len(parsed)} votations", flush=True)
    manifest = dict(version=1, fetched_at=datetime.now(timezone.utc).isoformat(), discovered_urls=urls, not_found_urls=not_found, sessions=entries)
    # Publish the manifest only after every session has been fetched and parsed.
    (target / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")


def load_payload(directory):
    from . import votaciones as votes

    target = Path(directory)
    manifest = json.loads((target / "manifest.json").read_text(encoding="utf-8"))
    if manifest.get("version") != 1:
        raise ValueError("Unknown Senate payload version")
    fetched = datetime.fromisoformat(manifest["fetched_at"])
    age = datetime.now(timezone.utc) - fetched
    if age < timedelta(minutes=-5) or age > timedelta(days=2):
        raise ValueError("Senate payload is stale or has a future timestamp")
    sessions = manifest["sessions"]
    if not sessions:
        raise ValueError("Senate payload contains no sessions")
    urls = manifest["discovered_urls"]
    missing = manifest.get("not_found_urls", [])
    entry_urls = [entry["url"] for entry in sessions]
    if (len(set(urls)) != len(urls) or len(set(missing)) != len(missing)
            or set(entry_urls).intersection(missing)
            or len(entry_urls) + len(missing) != len(urls)
            or set(entry_urls + missing) != set(urls)):
        raise ValueError("Senate payload does not cover its complete discovery manifest")
    numbers = [votes._session_number(url) for url in urls]
    if any(number is None or number < 1 for number in numbers) or numbers != sorted(numbers):
        raise ValueError("Invalid Senate session discovery manifest")
    result = {}
    expected = [url for url in urls if url not in missing]
    for expected_url, entry in zip(expected, sessions):
        number = votes._session_number(expected_url)
        url = f"{votes.BASE}/legis15/votaciones/ses_{number}.xml"
        if entry["url"] != url or entry["file"] != f"ses_{number}.xml" or expected_url != url:
            raise ValueError("Senate payload entries must match the official discovery manifest")
        data = (target / entry["file"]).read_bytes()
        if hashlib.sha256(data).hexdigest() != entry["sha256"]:
            raise ValueError(f"Senate payload checksum mismatch: {url}")
        parsed = _parse_session_xml(data.decode("utf-8"), url, number)
        result[url] = parsed
    return result
