"""Browser-like request headers for portals behind bot-protection front-ends.

`senado.es` sits behind Akamai. From a datacenter IP it answers 403 "Access
Denied" to plain `curl` requests regardless of the User-Agent; it only serves
content once the request also carries the `Sec-Fetch-*` navigation metadata a
real browser sends. Residential IPs are not challenged, which is why this
failed only on the VPS runner and looked like an empty-but-successful scrape.

Keep this in one place so every Senate scraper sends the same header set.
"""

from __future__ import annotations

BROWSER_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)

# Sec-Fetch-* is the part Akamai checks; the rest keeps the fingerprint coherent.
BROWSER_HEADERS: dict[str, str] = {
    "User-Agent": BROWSER_UA,
    "Accept": (
        "text/html,application/xhtml+xml,application/xml;q=0.9,"
        "image/avif,image/webp,*/*;q=0.8"
    ),
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
}


def curl_header_args(extra: dict[str, str] | None = None) -> list[str]:
    """Render BROWSER_HEADERS (plus `extra`) as repeated `-H name: value` args."""
    headers = {**BROWSER_HEADERS, **(extra or {})}
    args: list[str] = []
    for name, value in headers.items():
        args += ["-H", f"{name}: {value}"]
    return args


# Akamai's denial page for this host: a tiny HTML body with this exact title.
# Worth naming explicitly — the block and a markup change both surface as "the
# parser found nothing", and only one of them is a code problem.
_ACCESS_DENIED_MARKERS = ("<title>access denied</title>", "you don't have permission to access")


def looks_like_block_page(html: str) -> bool:
    """True when `html` is the front-end's denial page rather than content.

    The body is ~400 bytes, so the length check keeps a real page that happens
    to quote one of these phrases from being misread as a block.
    """
    if len(html) > 4096:
        return False
    lowered = html.lower()
    return any(marker in lowered for marker in _ACCESS_DENIED_MARKERS)
