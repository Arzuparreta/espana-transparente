"""ETL script: scrape voting data from Spanish Congress Open Data"""

import json
import httpx
from common.db import get_client, upsert_voting_sessions, upsert_votes

CONGRESO_BASE = "https://www.congreso.es"


def fetch_session_zip_urls(legislature: int = 15) -> list[dict]:
    """Scrape list of voting sessions for a legislature."""
    url = f"{CONGRESO_BASE}/es/opendata/votaciones"
    # The voting page lists sessions. We'll parse via the known URL pattern.
    # For now, fetch the latest session from the known structure.
    sessions = []
    return sessions


def fetch_session_votes(session_url: str) -> list[dict]:
    """Fetch individual voting data from a session JSON."""
    with httpx.Client(timeout=30) as client:
        resp = client.get(session_url)
        resp.raise_for_status()
        return resp.json()


def parse_vote_json(data: dict, legislature_id: str) -> tuple[dict, list[dict]]:
    """Parse Congress voting JSON into session and vote records."""
    session = {
        "legislature_id": legislature_id,
        "session_number": data.get("numeroSesion", data.get("session_number", 0)),
        "date": data.get("fecha", data.get("date", "")),
        "title": data.get("titulo", data.get("title", "")),
        "initiative_number": data.get("numeroExpediente", data.get("initiative_number", "")),
        "raw_data": data,
    }

    votes = []
    votaciones = data.get("votaciones", data.get("votos", []))
    if isinstance(votaciones, dict):
        votaciones = votaciones.get("diputado", [])

    for v in votaciones:
        if isinstance(v, dict):
            diputado_id = v.get("idDiputado", v.get("id_diputado", ""))
            voto = v.get("voto", v.get("vote", ""))
            if diputado_id and voto:
                votes.append({
                    "politician_id": None,  # Will be linked by congress_id
                    "vote": normalize_vote(voto),
                    "raw_data": v,
                })

    return session, votes


def normalize_vote(voto: str) -> str:
    voto = voto.strip().lower()
    mapping = {
        "sí": "Sí", "si": "Sí", "yes": "Sí",
        "no": "No",
        "abstención": "Abstención", "abstencion": "Abstención", "abstention": "Abstención",
        "no vota": "No vota", "no_vota": "No vota",
    }
    return mapping.get(voto, voto.capitalize())


def run():
    client = get_client()
    xv_leg = client.table("legislatures").select("id").eq("number", 15).single().execute()
    leg_id = xv_leg.data["id"]

    # Fetch the latest voting session data
    # Example session from April 30, 2026
    base_path = f"{CONGRESO_BASE}/webpublica/opendata/votaciones/Leg15/Sesion177/20260430"

    # Fetch the ZIP file list of votings
    index_url = f"{base_path}/VOT_20260430125138.json"
    print(f"Fetching session index: {index_url}")

    try:
        with httpx.Client(timeout=30) as c:
            resp = c.get(index_url)
            if resp.status_code == 200:
                data = resp.json()
                print(f"Got session data: {json.dumps(data, indent=2)[:500]}")
            else:
                print(f"Session index returned HTTP {resp.status_code}")
    except Exception as e:
        print(f"Error fetching session: {e}")

    print("Done!")


if __name__ == "__main__":
    run()
