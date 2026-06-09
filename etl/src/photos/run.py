"""CLI entrypoint for the photos pipeline.

Usage:
    PYTHONPATH=src python -m src.photos.run                       # refresh missing only
    PYTHONPATH=src python -m src.photos.run --dry-run             # plan, no writes
    PYTHONPATH=src python -m src.photos.run --max-age-days 30     # also refresh stale
    PYTHONPATH=src python -m src.photos.run --only <congress_id>  # one politician
    PYTHONPATH=src python -m src.photos.run --source wikidata     # restrict source
"""

import argparse
import sys

from .pipeline import RunOptions, RunStats, run


def _exit_code(stats: RunStats) -> int:
    has_technical_failure = stats.failed > 0 or stats.source_errors > 0
    return 1 if has_technical_failure and stats.updated == 0 else 0


def _parse_args(argv: list[str]) -> RunOptions:
    p = argparse.ArgumentParser(prog="src.photos.run")
    p.add_argument("--dry-run", action="store_true",
                   help="Run sources and report decisions without writing to DB/Storage.")
    p.add_argument("--refresh-missing", action="store_true", default=True,
                   help="Include politicians whose photo_url is NULL (default: on).")
    p.add_argument("--no-refresh-missing", dest="refresh_missing", action="store_false",
                   help="Do not include politicians with NULL photo_url.")
    p.add_argument("--max-age-days", type=int, default=None,
                   help="Also refresh photos older than this many days.")
    p.add_argument("--only", dest="only_congress_id", default=None,
                   help="Process only this congress_id (overrides other filters).")
    p.add_argument("--source", dest="only_source", default=None,
                   help="Restrict the run to one source by name (e.g. wikidata).")
    args = p.parse_args(argv)
    return RunOptions(
        dry_run=args.dry_run,
        refresh_missing=args.refresh_missing,
        max_age_days=args.max_age_days,
        only_congress_id=args.only_congress_id,
        only_source=args.only_source,
    )


def main(argv: list[str] | None = None) -> int:
    opts = _parse_args(sys.argv[1:] if argv is None else argv)
    stats = run(opts)
    return _exit_code(stats)


if __name__ == "__main__":
    sys.exit(main())
