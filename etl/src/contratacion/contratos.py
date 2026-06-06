"""ETL script: ingest public contracts from PLACSP (Plataforma de Contratación del Sector Público).

Downloads the paginated ATOM syndication feed and upserts records to the contracts
table.  Supports both a full-feed backfill and a targeted monthly download.

Usage:
    PYTHONPATH=src python -m src.contratacion.contratos
    PYTHONPATH=src python -m src.contratacion.contratos --backfill
    PYTHONPATH=src python -m src.contratacion.contratos --max-pages 5
"""

import argparse
import re
import subprocess
import tempfile
import os
import xml.etree.ElementTree as ET
from datetime import date, datetime, timezone

import psycopg2.extras
from common.db import get_pg_conn
from common.etl_runs import finish_run, start_run
from common.organizations import upsert_organization
from common.responsibility import (
    infer_autonomic_territory,
    infer_contract_administration_level,
    infer_municipal_territory,
    normalize_public_body,
)
from common.utils import extract_ministry_from_body

# PLACSP live ATOM feed (paginated).  The monthly ZIP archives at this same
# base URL were deprecated in 2026; the ``.atom`` endpoint remains active.
BASE_FEED_URL = "https://contrataciondelsectorpublico.gob.es/sindicacion/sindicacion_643/licitacionesPerfilesContratanteCompleto3.atom"

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


def _bool(el, path: str) -> bool | None:
    val = _text(el, path)
    if val is None:
        return None
    return val.lower() in ("true", "1", "yes", "s")


def _date(el, path: str) -> date | None:
    val = _text(el, path)
    if not val:
        return None
    try:
        return date.fromisoformat(val)
    except ValueError:
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

    # Infer administration_level from awarding body
    awarding_body_normalized = normalize_public_body(contracting_authority)
    ministry_normalized = extract_ministry_from_body(contracting_authority)
    admin_level = infer_contract_administration_level(awarding_body_normalized, ministry_normalized)

    # When region is missing but we know the admin level, infer territory from awarding body
    if not region and admin_level:
        if admin_level == "municipal":
            region = infer_municipal_territory(awarding_body_normalized)
        elif admin_level == "autonomic":
            region = infer_autonomic_territory(awarding_body_normalized)

    # ── TenderResult block (winning contractor + awarded amounts) ──
    contractor = None
    contractor_nif = None
    contractor_is_sme = None
    contractor_is_ute = None
    award_amount = None
    award_amount_with_taxes = None
    award_date = None
    contract_number = None
    received_tender_quantity = None

    tender_result = status_root.find("cac:TenderResult", NS)
    if tender_result is not None:
        # Contractor identity (section 4.35.2)
        winning_party = tender_result.find("cac:WinningParty", NS)
        if winning_party is not None:
            contractor = _text(winning_party, "cac:PartyName/cbc:Name")
            party_id_el = winning_party.find("cac:PartyIdentification/cbc:ID", NS)
            if party_id_el is not None:
                contractor_nif = party_id_el.text.strip() if party_id_el.text else None
            # SME indicator
            sme_el = winning_party.find("cbc_ext:EconomicOperatorIsSME", NS)
            if sme_el is not None:
                contractor_is_sme = _bool(winning_party, "cbc_ext:EconomicOperatorIsSME")
            # UTE indicator (section 4.35.2, added 15-Sep-2022)
            ute_el = winning_party.find("cbc_ext:EconomicOperatorIsUTE", NS)
            if ute_el is not None:
                contractor_is_ute = _bool(winning_party, "cbc_ext:EconomicOperatorIsUTE")

        # Award amounts (section 4.35.3)
        awarded_project = tender_result.find("cac:AwardedTenderedProject", NS)
        if awarded_project is not None:
            monetary_total = awarded_project.find("cac:LegalMonetaryTotal", NS)
            if monetary_total is not None:
                award_amount = _decimal(monetary_total, "cbc:TaxExclusiveAmount")
                award_amount_with_taxes = _decimal(monetary_total, "cbc:PayableAmount")
            # Contract number (section 4.35.7, inside AwardedTenderedProject)
            contract_number = _text(awarded_project, "cbc:ContractFolderID")
            if not contract_number:
                contract_number = _text(awarded_project, "cbc:ID")

        # Award date (section 4.35)
        award_date_val = _date(tender_result, "cbc:AwardDate") or _text(tender_result, "cbc:AwardDate")
        if award_date_val and isinstance(award_date_val, date):
            award_date = award_date_val

        # Received tender quantity (section 4.35.6)
        qty = _text(tender_result, "cbc:ReceivedTenderQuantity")
        if qty:
            try:
                received_tender_quantity = int(qty)
            except (ValueError, TypeError):
                pass

    record = {
        "contract_folder_id": contract_folder_id,
        "title": title,
        "awarding_body": contracting_authority,
        "awarding_body_normalized": awarding_body_normalized,
        "amount": amount_eur,
        "status": status,
        "contract_type": contract_type,
        "cpv_code": cpv_code,
        "region": region,
        "date": published_at.date() if published_at else None,
        "ministry_normalized": ministry_normalized,
        "administration_level": admin_level,
        "awarding_body_organization_id": None,
        "contractor_organization_id": None,
        "source_url": source_url,
        "contractor": contractor,
        "contractor_nif": contractor_nif,
        "contractor_is_sme": contractor_is_sme,
        "contractor_is_ute": contractor_is_ute,
        "award_amount": award_amount,
        "award_amount_with_taxes": award_amount_with_taxes,
        "award_date": award_date,
        "contract_number": contract_number,
        "received_tender_quantity": received_tender_quantity,
    }
    # Remove None values that aren't in the upsert columns
    return record


def download_feed_page(url: str) -> bytes:
    """Download a single ATOM feed page, retrying transient source failures."""
    print(f"  Fetching {url} ...")
    with tempfile.NamedTemporaryFile(suffix=".atom", delete=False) as tmp:
        tmp_path = tmp.name
    try:
        result = subprocess.run(
            ["curl", "-sS", "-L", "--fail-with-body",
             "--connect-timeout", "20", "--max-time", "120",
             "--retry", "4", "--retry-delay", "5", "--retry-all-errors",
             "-H", "User-Agent: Mozilla/5.0 (compatible; AccionHumana/1.0)",
             url, "-o", tmp_path],
            capture_output=True, timeout=650,
        )
        if result.returncode != 0:
            detail = result.stderr.decode(errors="replace").strip()
            raise RuntimeError(f"curl failed with exit {result.returncode}: {detail}")
        with open(tmp_path, "rb") as f:
            data = f.read()
        if not data:
            raise RuntimeError("curl returned an empty feed page")
        return data
    finally:
        os.unlink(tmp_path)


def parse_atom(xml_bytes: bytes) -> tuple[list[dict], str | None]:
    """Parse an ATOM feed page. Returns (records, next_page_url)."""
    root = ET.fromstring(xml_bytes)
    records = []
    for entry in root.findall("atom:entry", NS):
        rec = parse_entry(entry)
        if rec:
            records.append(rec)

    # Find pagination link
    next_url = None
    for link in root.findall("atom:link", NS):
        rel = link.get("rel", "")
        if rel == "next":
            next_url = link.get("href")
            break

    print(f"  Parsed {len(records)} entries, next page: {next_url is not None}")
    return records, next_url


def upsert(conn, records: list[dict]) -> int:
    if not records:
        return 0
    cur = conn.cursor()
    upserted = 0
    for rec in records:
        if rec["awarding_body"]:
            try:
                rec["awarding_body_organization_id"] = upsert_organization(
                    cur,
                    name=rec["awarding_body"],
                    organization_type="public_body",
                    source_url=rec["source_url"],
                )
            except ValueError:
                rec["awarding_body_organization_id"] = None
        if rec["contractor"]:
            try:
                rec["contractor_organization_id"] = upsert_organization(
                    cur,
                    name=rec["contractor"],
                    organization_type="company",
                    source_url=rec["source_url"],
                )
            except ValueError:
                rec["contractor_organization_id"] = None
        cur.execute("""
            INSERT INTO contracts
              (contract_folder_id, title, awarding_body,
               awarding_body_normalized, amount, status, contract_type,
               cpv_code, region, date, ministry_normalized, administration_level,
               awarding_body_organization_id, contractor_organization_id, source_url,
               contractor, contractor_nif, contractor_is_sme, contractor_is_ute,
               award_amount, award_amount_with_taxes, award_date, contract_number,
               received_tender_quantity)
            VALUES
              (%(contract_folder_id)s, %(title)s, %(awarding_body)s,
               %(awarding_body_normalized)s, %(amount)s, %(status)s, %(contract_type)s,
               %(cpv_code)s, %(region)s, %(date)s, %(ministry_normalized)s, %(administration_level)s,
               %(awarding_body_organization_id)s, %(contractor_organization_id)s, %(source_url)s,
               %(contractor)s, %(contractor_nif)s, %(contractor_is_sme)s, %(contractor_is_ute)s,
               %(award_amount)s, %(award_amount_with_taxes)s, %(award_date)s, %(contract_number)s,
               %(received_tender_quantity)s)
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
              contractor_organization_id = coalesce(
                EXCLUDED.contractor_organization_id,
                contracts.contractor_organization_id
              ),
              source_url = EXCLUDED.source_url,
              contractor = coalesce(EXCLUDED.contractor, contracts.contractor),
              contractor_nif = coalesce(EXCLUDED.contractor_nif, contracts.contractor_nif),
              contractor_is_sme = coalesce(EXCLUDED.contractor_is_sme, contracts.contractor_is_sme),
              contractor_is_ute = coalesce(EXCLUDED.contractor_is_ute, contracts.contractor_is_ute),
              award_amount = coalesce(EXCLUDED.award_amount, contracts.award_amount),
              award_amount_with_taxes = coalesce(EXCLUDED.award_amount_with_taxes, contracts.award_amount_with_taxes),
              award_date = coalesce(EXCLUDED.award_date, contracts.award_date),
              contract_number = coalesce(EXCLUDED.contract_number, contracts.contract_number),
              received_tender_quantity = coalesce(
                EXCLUDED.received_tender_quantity, contracts.received_tender_quantity
              ),
              updated_at = NOW()
        """, rec)
        upserted += 1
    conn.commit()
    cur.close()
    return upserted


def run_feed(*, max_pages: int | None, dry_run: bool) -> tuple[int, int]:
    """Download the paginated ATOM feed and upsert all entries."""
    pipeline = "contracts_daily"
    chunk_key = f"feed-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M')}"
    conn = None if dry_run else get_pg_conn()
    cur = conn.cursor() if conn else None

    run_id = None
    if cur:
        run_id = start_run(
            cur,
            pipeline=pipeline,
            chunk_key=chunk_key,
            window_start=date.today(),
            window_end=date.today(),
        )
        conn.commit()

    total_parsed = 0
    total_upserted = 0
    url = BASE_FEED_URL
    page_count = 0

    try:
        while url and (max_pages is None or page_count < max_pages):
            page_count += 1
            print(f"\n--- Page {page_count} ---")
            xml_bytes = download_feed_page(url)
            records, next_url = parse_atom(xml_bytes)
            total_parsed += len(records)

            if conn and records:
                upserted = upsert(conn, records)
                total_upserted += upserted

            url = next_url

        if cur:
            finish_run(
                cur,
                run_id=run_id,
                status="succeeded",
                rows_read=total_parsed,
                rows_inserted=total_upserted,
            )
            conn.commit()
            cur.close()
            conn.close()

        print(f"\nDone! {page_count} pages, {total_parsed} entries, {total_upserted} upserted")
        return total_parsed, total_upserted

    except Exception as exc:
        if conn and run_id:
            cur = conn.cursor()
            finish_run(
                cur,
                run_id=run_id,
                status="failed",
                rows_read=total_parsed,
                error_summary=str(exc)[:500],
            )
            conn.commit()
            cur.close()
            conn.close()
        raise


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest PLACSP contracts from ATOM feed")
    parser.add_argument("--backfill", action="store_true",
                        help="Fetch all available pages (no page limit)")
    parser.add_argument("--max-pages", type=int, default=3,
                        help="Maximum number of feed pages to fetch (default: 3)")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    max_pages = None if args.backfill else args.max_pages
    run_feed(max_pages=max_pages, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
