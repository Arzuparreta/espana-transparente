"""Validate and normalize photo bytes.

Pipeline: download → content-type/size validation → Pillow open → resize
512x512 (proportion preserved, padded to square) → WebP q=85 output.
"""

import io
from dataclasses import dataclass
from typing import Optional

import httpx
from PIL import Image, ImageOps, UnidentifiedImageError

MIN_BYTES = 1024            # 1 KB — anything smaller is almost certainly an error page
MAX_BYTES = 10 * 1024 * 1024  # 10 MB — guard against huge originals
TARGET_SIZE = 512
WEBP_QUALITY = 85

_OK_PREFIXES = ("image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif")


class PhotoValidationError(Exception):
    pass


@dataclass(frozen=True)
class DownloadResult:
    data: bytes
    final_url: str


def download(url: str, *, user_agent: str = "Mozilla/5.0 (compatible; EspanaTransparente/1.0)",
             timeout: float = 30.0) -> bytes:
    """Download a photo with browser-like UA. Raises PhotoValidationError on failure."""
    return download_with_final_url(url, user_agent=user_agent, timeout=timeout).data


def download_with_final_url(
    url: str,
    *,
    user_agent: str = "Mozilla/5.0 (compatible; EspanaTransparente/1.0)",
    timeout: float = 30.0,
) -> DownloadResult:
    """Download a photo and return bytes plus the final redirect-resolved URL."""
    try:
        with httpx.Client(follow_redirects=True, timeout=timeout,
                          headers={"User-Agent": user_agent}) as client:
            resp = client.get(url)
        resp.raise_for_status()
    except httpx.HTTPError as exc:
        raise PhotoValidationError(f"download failed: {exc}") from exc

    ct = resp.headers.get("content-type", "").lower()
    if not any(ct.startswith(p) for p in _OK_PREFIXES):
        raise PhotoValidationError(f"unexpected content-type: {ct!r}")

    data = resp.content
    if len(data) < MIN_BYTES:
        raise PhotoValidationError(f"too small: {len(data)} bytes")
    if len(data) > MAX_BYTES:
        raise PhotoValidationError(f"too large: {len(data)} bytes")
    return DownloadResult(data=data, final_url=str(resp.url))


def to_webp_square(raw: bytes, *, size: int = TARGET_SIZE,
                   quality: int = WEBP_QUALITY) -> bytes:
    """Resize to a `size`x`size` WebP, preserving proportion and padding to square.

    Background is neutral grey (matches the AvatarFallback bg).
    """
    try:
        img = Image.open(io.BytesIO(raw))
        img.load()
    except (UnidentifiedImageError, OSError) as exc:
        raise PhotoValidationError(f"not a valid image: {exc}") from exc

    img = ImageOps.exif_transpose(img)
    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGB")

    img.thumbnail((size, size), Image.Resampling.LANCZOS)

    canvas = Image.new("RGB", (size, size), (244, 244, 245))  # zinc-100 / muted
    offset = ((size - img.width) // 2, (size - img.height) // 2)
    canvas.paste(img, offset, img if img.mode == "RGBA" else None)

    out = io.BytesIO()
    canvas.save(out, format="WEBP", quality=quality, method=6)
    return out.getvalue()


def fetch_and_normalize(url: str) -> Optional[bytes]:
    """Download + normalize. Returns WebP bytes, or None if validation fails.

    Logs the reason via print() so the pipeline output shows per-source failures.
    """
    try:
        raw = download(url)
        return to_webp_square(raw)
    except PhotoValidationError as exc:
        print(f"  ! validate failed for {url!s}: {exc}")
        return None
