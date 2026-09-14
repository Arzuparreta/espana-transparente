"""INE Tempus transport shared by all economic series."""

import json
import subprocess


def fetch_json(url: str):
    result = subprocess.run(
        ["curl", "-fsSL", "--connect-timeout", "10", "--max-time", "30",
         "--retry", "3", "--retry-delay", "2", "--retry-all-errors", url],
        capture_output=True, timeout=150, check=True,
    )
    try:
        payload = result.stdout.decode("utf-8")
    except UnicodeDecodeError:
        payload = result.stdout.decode("latin-1")
    return json.loads(payload)


def require_observations(payload, series: str) -> list[dict]:
    points = payload.get("Data") if isinstance(payload, dict) else None
    if not isinstance(points, list) or not any(p.get("Valor") is not None for p in points):
        raise ValueError(f"INE {series}: no observations; source response is empty or invalid")
    return points
