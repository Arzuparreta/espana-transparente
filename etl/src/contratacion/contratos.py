"""ETL script: ingest public contracts from PCSP (Plataforma de Contratación del Sector Público).

Downloads the monthly ATOM feed ZIP from contrataciondelsectorpublico.gob.es,
extracts the summary ATOM file, and upserts records to the contracts table.

Usage:
    PYTHONPATH=src python -m src.contratacion.contratos
    PYTHONPATH=src python -m src.contratacion.contratos --year 2026 --month 4
"""

import argparse
import io
import os
import re
import subprocess
import tempfile
import zipfile
import xml.etree.ElementTree as ET
from datetime import date, datetime, timezone

import psycopg2.extras
from common.db import get_pg_conn
from common.etl_runs import finish_run, is_chunk_succeeded, start_run
from common.organizations import upsert_organization
from common.responsibility import (
    infer_contract_administration_level,
    iter_months,
    month_bounds,
    normalize_public_body,
)
from common.utils import extract_ministry_from_body

BASE_URL = "https://contrataciondelsectorpublico.gob.es/sindicacion/sindicacion_643"
SUMMARY_ATOM = "licitacionesPerfilesContratanteCompleto3.atom"

NS = {
    "atom": "http://www.w3.org/2005/Atom",
    "cbc": "urn:dgpe:names:draft:codice:schema:xsd:CommonBasicComponents-2",
    "cac": "urn:dgpe:names:draft:codice:schema:xsd:CommonAggregateComponents-2",
    "cac_ext": "urn:dgpe:names:draft:codice-place-ext:schema:xsd:CommonAggregateComponents-2",
    "cbc_ext": "urn:dgpe:names:draft:codice-place-ext:schema:xsd:CommonBasicComponents-2",
}

CONTRACT_TYPES = {
    "1": "Obras",
    "2": "Servicios",
    "3": "Suministros",
    "4": "Concesión de obras",
    "5": "Concesión de servicios",
    "6": "Patrimonial",
    "7": "Privado",
    "8": "Colaboración público-privada",
}


def _text(el, path: str) -> str | None:
    node = el.find(path, NS)
    return node.text.strip() if node is not None and node.text else None


def _decimal(el, path: str) -> float | None:
    val = _text(el, path)
    try:
        return float(val) if val else None
    except (ValueError, TypeError):
        return None


def parse_entry(entry: ET.Element) -> dict | None:
    title = _text(entry, "atom:title")
    if not title:
        return None

    link_el = entry.find("atom:link", NS)
    source_url = link_el.get("href") if link_el is not None else None

    updated_raw = _text(entry, "atom:updated")
    published_at = None
    if updated_raw:
        try:
            published_at = datetime.fromisoformat(updated_raw.replace("Z", "+00:00"))
        except ValueError:
            pass

    status_root = entry.find("cac_ext:ContractFolderStatus", NS)
    if status_root is None:
        return None

    contract_folder_id = _text(status_root, "cbc:ContractFolderID")
    if not contract_folder_id:
        return None

    status = _text(status_root, "cbc_ext:ContractFolderStatusCode")

    authority_party = status_root.find(
        "cac_ext:LocatedContractingParty/cac:Party", NS
    )
    contracting_authority = None
    if authority_party is not None:
        contracting_authority = _text(authority_party, "cac:PartyName/cbc:Name")

    project = status_root.find("cac:ProcurementProject", NS)
    amount_eur = None
    total_amount_eur = None
    contract_type = None
    cpv_code = None
    region = None

    if project is not None:
        amount_eur = _decimal(project, "cac:BudgetAmount/cbc:TaxExclusiveAmount")
        total_amount_eur = _decimal(project, "cac:BudgetAmount/cbc:TotalAmount")
        type_code = _text(project, "cbc:TypeCode")
        contract_type = CONTRACT_TYPES.get(type_code or "", type_code)
        cpv_el = project.find("cac:RequiredCommodityClassification/cbc:ItemClassificationCode", NS)
        if cpv_el is not None:
            cpv_code = cpv_el.text.strip() if cpv_el.text else None
        region = _text(project, "cac:RealizedLocation/cbc:CountrySubentity")

    # Fallback: parse amount from summary text
    if amount_eur is None:
        summary = _text(entry, "atom:summary") or ""
        m = re.search(r"Importe:\s*([\d.,]+)\s*EUR", summary)
        if m:
            try:
                amount_eur = float(m.group(1).replace(".", "").replace(",", "."))
            except ValueError:
                pass

    return {
        "contract_folder_id": contract_folder_id,
        "title": title,
        "awarding_body": contracting_authority,
        "awarding_body_normalized": normalize_public_body(contracting_authority),
        "amount": amount_eur,
        "status": status,
        "contract_type": contract_type,
        "cpv_code": cpv_code,
        "region": region,
        "date": published_at.date() if published_at else None,
        "ministry_normalized": extract_ministry_from_body(contracting_authority),
        "administration_level": infer_contract_administration_level(
            normalize_public_body(contracting_authority),
            extract_ministry_from_body(contracting_authority),
        ),
        "awarding_body_organization_id": None,
        "source_url": source_url,
    }


def download_zip(year: int, month: int) -> bytes:
    url = f"{BASE_URL}/licitacionesPerfilesContratanteCompleto3_{year}{month:02d}.zip"
    print(f"Downloading {url} ...")
    with tempfile.NamedTemporaryFile(suffix=".zip", delete=False) as tmp:
        result = subprocess.run(
            ["curl", "-sL", "--max-time", "120",
             "-H", "User-Agent: Mozilla/5.0 (compatible; AccionHumana/1.0)", url, "-o", tmp.name],
            capture_output=True, timeout=130,
        )
        if result.returncode != 0:
            raise RuntimeError(f"curl failed: {result.stderr.decode()}")
        with open(tmp.name, "rb") as f:
            data = f.read()
    os.unlink(tmp.name)
    return data


def parse_atom(xml_bytes: bytes) -> list[dict]:
    root = ET.fromstring(xml_bytes)
    records = []
    for entry in root.findall("atom:entry", NS):
        rec = parse_entry(entry)
        if rec:
            records.append(rec)
    print(f"  Parsed {len(records)} entries")
    return records


def upsert(conn, records: list[dict]) -> int:
    if not records:
        return 0
    cur = conn.cursor()
    upserted = 0
    for rec in records:
        if rec["awarding_body"]:
            rec["awarding_body_organization_id"] = upsert_organization(
                cur,
                name=rec["awarding_body"],
                organization_type="public_body",
                source_url=rec["source_url"],
            )
        cur.execute("""
            INSERT INTO contracts
              (contract_folder_id, title, awarding_body,
               awarding_body_normalized, amount, status, contract_type,
               cpv_code, region, date, ministry_normalized, administration_level,
               awarding_body_organization_id, source_url)
            VALUES
              (%(contract_folder_id)s, %(title)s, %(awarding_body)s,
               %(awarding_body_normalized)s, %(amount)s, %(status)s, %(contract_type)s,
               %(cpv_code)s, %(region)s, %(date)s, %(ministry_normalized)s, %(administration_level)s,
               %(awarding_body_organization_id)s, %(source_url)s)
            ON CONFLICT (contract_folder_id) DO UPDATE SET
              title = EXCLUDED.title,
              awarding_body = EXCLUDED.awarding_body,
              awarding_body_normalized = EXCLUDED.awarding_body_normalized,
              amount = EXCLUDED.amount,
              status = EXCLUDED.status,
              contract_type = EXCLUDED.contract_type,
              cpv_code = EXCLUDED.cpv_code,
              region = EXCLUDED.region,
              date = EXCLUDED.date,
              ministry_normalized = EXCLUDED.ministry_normalized,
              administration_level = coalesce(EXCLUDED.administration_level, contracts.administration_level),
              awarding_body_organization_id = coalesce(
                EXCLUDED.awarding_body_organization_id,
                contracts.awarding_body_organization_id
              ),
              source_url = EXCLUDED.source_url
        """, rec)
        upserted += 1
    conn.commit()
    cur.close()
    return upserted


def run_month(*, year: int, month: int, resume: bool, dry_run: bool) -> tuple[int, int]:
    window_start, window_end = month_bounds(year, month)
    pipeline = "contracts_backfill" if (year, month) != (datetime.now(timezone.utc).year, datetime.now(timezone.utc).month) else "contracts_daily"
    chunk_key = f"{year}-{month:02d}"
    conn = None if dry_run else get_pg_conn()
    cur = conn.cursor() if conn else None

    if cur and resume and is_chunk_succeeded(
        cur,
        pipeline=pipeline,
        chunk_key=chunk_key,
        window_start=window_start,
        window_end=window_end,
    ):
        print(f"Skipping {chunk_key}: already succeeded")
        cur.close()
        conn.close()
        return 0, 0

    run_id = None
    if cur:
        run_id = start_run(
            cur,
            pipeline=pipeline,
            chunk_key=chunk_key,
            window_start=window_start,
            window_end=window_end,
        )
        conn.commit()

    try:
        zip_bytes = download_zip(year, month)
        print(f"  Downloaded {len(zip_bytes) / 1_000_000:.1f} MB")

        with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
            names = zf.namelist()
            print(f"  ZIP contains {len(names)} files")
            if SUMMARY_ATOM not in names:
                raise RuntimeError(f"{SUMMARY_ATOM} not found in ZIP. Files: {names[:5]}")
            atom_bytes = zf.read(SUMMARY_ATOM)
            print(f"  Extracted {SUMMARY_ATOM} ({len(atom_bytes) / 1000:.1f} KB)")

        records = parse_atom(atom_bytes)
        upserted = 0

        if conn:
            upserted = upsert(conn, records)
            cur = conn.cursor()
            finish_run(
                cur,
                run_id=run_id,
                status="succeeded",
                rows_read=len(records),
                rows_inserted=upserted,
            )
            conn.commit()
            cur.close()
            conn.close()
        print(f"Done! Upserted {upserted} contracts for {year}-{month:02d}")
        return len(records), upserted
    except Exception as exc:
        if conn and run_id:
            cur = conn.cursor()
            finish_run(
                cur,
                run_id=run_id,
                status="failed",
                rows_read=0,
                error_summary=str(exc)[:500],
            )
            conn.commit()
            cur.close()
            conn.close()
        raise


def run_backfill(*, start: date, end: date, resume: bool, dry_run: bool) -> None:
    for year, month in iter_months(start, end):
        print(f"\n== contracts {year}-{month:02d} ==")
        run_month(year=year, month=month, resume=resume, dry_run=dry_run)


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest PCSP contracts")
    now = datetime.now(timezone.utc)
    parser.add_argument("--year", type=int, default=now.year)
    parser.add_argument("--month", type=int, default=now.month)
    parser.add_argument("--from-month", help="YYYY-MM for resumable historical backfill")
    parser.add_argument("--to-month", help="YYYY-MM for resumable historical backfill")
    parser.add_argument("--resume", action="store_true", help="Skip chunks already marked as succeeded in etl_runs")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if args.from_month or args.to_month:
        start_raw = args.from_month or "2016-01"
        end_raw = args.to_month or f"{now.year}-{now.month:02d}"
        start = date.fromisoformat(f"{start_raw}-01")
        end = date.fromisoformat(f"{end_raw}-01")
        run_backfill(start=start, end=end, resume=args.resume, dry_run=args.dry_run)
        return

    run_month(year=args.year, month=args.month, resume=args.resume, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
