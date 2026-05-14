"""Descubre codParlamentario de cada diputado sondeando el FICHA_URL del Congreso.

El CSV oficial de open data no incluye CODPARLAMENTARIO. Este módulo prueba
cods 1..MAX_COD en el endpoint de fichas del Congreso, extrae el nombre del HTML
(div.nombre-dip) y actualiza la columna politicians.cod_parlamentario.

Uso:
    PYTHONPATH=src python -m src.congreso.cods                   # run completo
    PYTHONPATH=src python -m src.congreso.cods --dry-run         # sin escritura
    PYTHONPATH=src python -m src.congreso.cods --from-cod 100 --to-cod 200
    PYTHONPATH=src python -m src.congreso.cods --resume          # salta ya mapeados
"""

from __future__ import annotations

import argparse
import re
import subprocess
import time
import unicodedata

from common.db import get_pg_conn

CONGRESO_BASE = "https://www.congreso.es"
FICHA_URL = (
    f"{CONGRESO_BASE}/es/busqueda-de-diputados"
    "?p_p_id=diputadomodule&p_p_lifecycle=0&p_p_state=normal&p_p_mode=view"
    "&_diputadomodule_mostrarFicha=true"
    "&codParlamentario={cod}&idLegislatura=XV"
)

REQUEST_DELAY = 1.5
DEFAULT_MAX_COD = 700

NOMBRE_DIP_RE = re.compile(r'<div class="nombre-dip">\s*([^<]+?)\s*</div>', re.IGNORECASE)


def normalize(text: str) -> str:
    nfkd = unicodedata.normalize("NFKD", text.lower().strip())
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def curl_text(url: str) -> str:
    result = subprocess.run(
        ["curl", "-sL", "-H", "User-Agent: Mozilla/5.0 (compatible; EspanaTransparente/1.0)", url],
        capture_output=True, text=True, timeout=30,
    )
    return result.stdout


def extract_name(html: str) -> str | None:
    m = NOMBRE_DIP_RE.search(html)
    if not m:
        return None
    return " ".join(m.group(1).split())


def build_politician_index(cur) -> tuple[dict[str, str], dict[str, str]]:
    """Returns (exact_index, normalized_index) mapping full_name → politician_id."""
    cur.execute(
        "SELECT id, full_name FROM politicians WHERE cod_parlamentario IS NULL"
    )
    exact: dict[str, str] = {}
    normalized: dict[str, str] = {}
    for pol_id, full_name in cur.fetchall():
        exact[full_name.strip()] = pol_id
        normalized[normalize(full_name)] = pol_id
    return exact, normalized


def match_politician(name: str, exact: dict, normalized: dict) -> str | None:
    if name in exact:
        return exact[name]
    return normalized.get(normalize(name))


def run(dry_run: bool = False, from_cod: int = 1, to_cod: int = DEFAULT_MAX_COD, resume: bool = False) -> None:
    conn = get_pg_conn()
    cur = conn.cursor()

    if resume:
        cur.execute("SELECT cod_parlamentario FROM politicians WHERE cod_parlamentario IS NOT NULL")
        already_mapped = {str(r[0]) for r in cur.fetchall()}
    else:
        already_mapped: set = set()

    exact_idx, norm_idx = build_politician_index(cur)
    if not exact_idx:
        print("Todos los políticos ya tienen cod_parlamentario. Nada que hacer.")
        return

    print(f"Sondeando cods {from_cod}..{to_cod} para {len(exact_idx)} políticos sin cod.")
    print(f"Delay: {REQUEST_DELAY}s por petición. Tiempo estimado: ~{int((to_cod - from_cod + 1) * REQUEST_DELAY / 60)} min")
    print()

    found = 0
    not_found = 0
    skipped = 0

    for cod in range(from_cod, to_cod + 1):
        cod_str = str(cod)
        if resume and cod_str in already_mapped:
            skipped += 1
            continue

        html = curl_text(FICHA_URL.format(cod=cod))
        name = extract_name(html)

        if not name:
            not_found += 1
            if cod % 50 == 0:
                print(f"  cod={cod}: sin diputado (acumulado: {found} encontrados, {not_found} vacíos)")
            time.sleep(REQUEST_DELAY)
            continue

        pol_id = match_politician(name, exact_idx, norm_idx)

        if pol_id:
            print(f"  cod={cod}: {name} → {'[dry-run]' if dry_run else 'guardado'}")
            if not dry_run:
                cur.execute(
                    "UPDATE politicians SET cod_parlamentario = %s, updated_at = now() WHERE id = %s",
                    (cod_str, pol_id),
                )
                conn.commit()
                # Retire from index so duplicates don't overwrite
                exact_idx = {k: v for k, v in exact_idx.items() if v != pol_id}
                norm_idx = {k: v for k, v in norm_idx.items() if v != pol_id}
            found += 1
            if not exact_idx:
                print("Todos los políticos mapeados. Terminando antes del rango completo.")
                break
        else:
            print(f"  cod={cod}: '{name}' — sin match en DB (ya tiene cod o nombre distinto)")

        time.sleep(REQUEST_DELAY)

    print()
    print(f"Fin. Encontrados: {found} | Vacíos: {not_found} | Saltados: {skipped}")
    cur.close()
    conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Descubrir codParlamentario de diputados vía ficha del Congreso")
    parser.add_argument("--dry-run", action="store_true", help="No escribe en la BD")
    parser.add_argument("--from-cod", type=int, default=1, help="Cod inicial (default: 1)")
    parser.add_argument("--to-cod", type=int, default=DEFAULT_MAX_COD, help=f"Cod final (default: {DEFAULT_MAX_COD})")
    parser.add_argument("--resume", action="store_true", help="Salta cods ya mapeados en la BD")
    args = parser.parse_args()
    run(dry_run=args.dry_run, from_cod=args.from_cod, to_cod=args.to_cod, resume=args.resume)


if __name__ == "__main__":
    main()
