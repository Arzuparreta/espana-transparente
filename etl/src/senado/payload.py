"""Transfer complete, recent official Senate XML between CI runners."""

from datetime import datetime, timezone, timedelta
import hashlib
import json
from pathlib import Path
import re


def export_payload(directory):
    from . import votaciones as votes

    target = Path(directory)
    target.mkdir(parents=True, exist_ok=True)
    urls = votes.discover_session_vote_urls()
    if not urls:
        raise RuntimeError("Senate discovery returned no sessions")
    last = max(votes._session_number(url) for url in urls)
    entries = []
    # Do not trust a lagging or truncated catalog to enumerate past sessions.
    for number in range(1, last + 1):
        url = f"{votes.BASE}/legis15/votaciones/ses_{number}.xml"
        xml = votes.curl_text(url)
        parsed = votes.parse_senate_session_vote_xml(xml, url)
        if not parsed or any(row.session_number != number for row in parsed):
            raise RuntimeError(f"Invalid or empty Senate session at {url}")
        data = xml.encode("utf-8")
        filename = f"ses_{number}.xml"
        (target / filename).write_bytes(data)
        entries.append(dict(url=url, file=filename, sha256=hashlib.sha256(data).hexdigest()))
        print(f"Exported session {number}: {len(parsed)} votations", flush=True)
    manifest = dict(version=1, fetched_at=datetime.now(timezone.utc).isoformat(), sessions=entries)
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
    result = {}
    for number, entry in enumerate(sessions, 1):
        url = f"{votes.BASE}/legis15/votaciones/ses_{number}.xml"
        if entry["url"] != url or entry["file"] != f"ses_{number}.xml":
            raise ValueError("Senate payload must include contiguous sessions starting at 1")
        data = (target / entry["file"]).read_bytes()
        if hashlib.sha256(data).hexdigest() != entry["sha256"]:
            raise ValueError(f"Senate payload checksum mismatch: {url}")
        parsed = votes.parse_senate_session_vote_xml(data.decode("utf-8"), url)
        if not parsed or any(row.session_number != number for row in parsed):
            raise ValueError(f"Invalid or empty Senate payload session: {url}")
        result[url] = parsed
    return result
