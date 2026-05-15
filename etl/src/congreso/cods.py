"""Sync `cod_parlamentario` from the active Congreso directory.

The old implementation brute-forced ficha URLs. That is no longer necessary:
`searchDiputados` returns the 350 active deputies together with `codParlamentario`
in one request, which is faster and much less fragile.

Usage:
    PYTHONPATH=src python -m src.congreso.cods
    PYTHONPATH=src python -m src.congreso.cods --dry-run
    PYTHONPATH=src python -m src.congreso.cods --resume  # accepted for compatibility
"""

from __future__ import annotations

import argparse

from common.db import get_pg_conn
from congreso.directory import active_directory_index, normalize_name


def run(*, dry_run: bool = False, resume: bool = False) -> None:
    del resume  # legacy flag kept for workflow compatibility

    directory = active_directory_index()
    conn = get_pg_conn()
    cur = conn.cursor()
    cur.execute("SELECT id, full_name, cod_parlamentario FROM politicians ORDER BY full_name")
    rows = cur.fetchall()

    updated = 0
    unchanged = 0
    missing = 0

    for pol_id, full_name, current_cod in rows:
        entry = directory.get(normalize_name(full_name))
        if not entry:
            print(f"  ! {full_name}: no aparece en searchDiputados")
            missing += 1
            continue
        if current_cod == entry.cod_parlamentario:
            unchanged += 1
            continue

        print(
            f"  {'[dry-run] ' if dry_run else ''}"
            f"{full_name}: {current_cod or 'NULL'} -> {entry.cod_parlamentario}"
        )
        if not dry_run:
            cur.execute(
                "UPDATE politicians SET cod_parlamentario = %s, updated_at = now() WHERE id = %s",
                (entry.cod_parlamentario, pol_id),
            )
        updated += 1

    if not dry_run:
        conn.commit()
    cur.close()
    conn.close()

    print()
    print(f"Fin. actualizados={updated} sin_cambios={unchanged} sin_match={missing}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Sincronizar codParlamentario desde searchDiputados")
    parser.add_argument("--dry-run", action="store_true", help="No escribe en la BD")
    parser.add_argument("--resume", action="store_true", help="Compatibilidad con el workflow antiguo")
    args = parser.parse_args()
    run(dry_run=args.dry_run, resume=args.resume)


if __name__ == "__main__":
    main()
