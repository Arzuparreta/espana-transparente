"""One PCSP Atom identity and its published project, lots and tender results."""
import re
from decimal import Decimal, InvalidOperation
from datetime import datetime, timezone
from urllib.parse import urlsplit, parse_qs

NS = {
    'atom': 'http://www.w3.org/2005/Atom',
    'cbc': 'urn:dgpe:names:draft:codice:schema:xsd:CommonBasicComponents-2',
    'cac': 'urn:dgpe:names:draft:codice:schema:xsd:CommonAggregateComponents-2',
    'cac_ext': 'urn:dgpe:names:draft:codice-place-ext:schema:xsd:CommonAggregateComponents-2',
}
IDENTITY = re.compile(r'https://contrataciondelestado\.es/sindicacion/licitacionesPerfilContratante/[1-9]\d{0,19}')
VERSION = 'pcsp-published-edition-v1'


def identifiable_source_url(value):
    if not isinstance(value, str):
        return False
    try:
        url = urlsplit(value)
        if url.scheme != 'https' or url.hostname not in {'contrataciondelestado.es', 'contrataciondelsectorpublico.gob.es'} or url.username or url.password or url.port:
            return False
        query = parse_qs(url.query)
        return (url.path == '/wps/poc' and len(query.get('idEvl', [])) == 1 and bool(query['idEvl'][0])) or bool(re.fullmatch(r'/web/guest/licitaciones/-/frontend/licitacion/[1-9]\d*', url.path))
    except ValueError:
        return False


def text(element, path):
    node = element.find(path, NS) if element is not None else None
    return node.text.strip() if node is not None and node.text and node.text.strip() else None


def money(element, path):
    node = element.find(path, NS) if element is not None else None
    if node is None or not node.text or not node.text.strip():
        return dict(value=None, currency=None)
    value = node.text.strip()
    try:
        amount = Decimal(value)
        if not amount.is_finite() or abs(amount) >= Decimal('10000000000000'):
            raise InvalidOperation
    except InvalidOperation:
        raise ValueError('Invalid published monetary amount') from None
    currency = node.get('currencyID')
    if currency is not None and not re.fullmatch(r'[A-Z]{3}', currency):
        raise ValueError('Invalid published currency')
    # Preserve source precision, including decimals beyond the legacy numeric(15,2).
    return dict(value=format(amount, 'f'), currency=currency)


def project(element):
    codes = []
    if element is not None:
        for node in element.findall('cac:RequiredCommodityClassification/cbc:ItemClassificationCode', NS):
            value = node.text.strip() if node.text else None
            if value and value not in codes:
                codes.append(value)
    return dict(name=text(element, 'cbc:Name'), cpv_codes=codes,
                budget_excluding_tax=money(element, 'cac:BudgetAmount/cbc:TaxExclusiveAmount'),
                budget_including_tax=money(element, 'cac:BudgetAmount/cbc:TotalAmount'))


def build_edition(entry, status):
    identifier = text(entry, 'atom:id')
    if not identifier or not IDENTITY.fullmatch(identifier):
        raise ValueError('Missing verified PCSP Atom identity; folder number is not global')
    updated = text(entry, "atom:updated")
    try:
        timestamp = datetime.fromisoformat(updated.replace("Z", "+00:00"))
        if timestamp.tzinfo is None:
            raise ValueError
    except (AttributeError, ValueError):
        raise ValueError("Missing timezone-aware source revision") from None
    updated = timestamp.astimezone(timezone.utc).isoformat()
    lots = []
    for lot in status.findall('cac:ProcurementProjectLot', NS):
        lots.append(dict(id=text(lot, 'cbc:ID'), project=project(lot.find('cac:ProcurementProject', NS))))
    results = []
    for result in status.findall('cac:TenderResult', NS):
        awarded = result.find('cac:AwardedTenderedProject', NS)
        count = text(result, 'cbc:ReceivedTenderQuantity')
        if count is not None and not re.fullmatch(r'\d{1,9}', count):
            raise ValueError('Invalid tender count')
        results.append(dict(
            result_code=text(result, 'cbc:ResultCode'),
            lot_id=text(awarded, 'cbc:ProcurementProjectLotID'),
            award_date=text(result, 'cbc:AwardDate'),
            received_tenders=int(count) if count is not None else None,
            contractor=text(result, 'cac:WinningParty/cac:PartyName/cbc:Name') or text(awarded, 'cac:WinningParty/cac:PartyName/cbc:Name'),
            contract_number=text(awarded, 'cbc:ContractFolderID') or text(awarded, 'cbc:ID'),
            award_excluding_tax=money(awarded, 'cac:LegalMonetaryTotal/cbc:TaxExclusiveAmount'),
            award_including_tax=money(awarded, 'cac:LegalMonetaryTotal/cbc:PayableAmount')))
    if len(lots) > 2000 or len(results) > 2000:
        raise ValueError('Unbounded published lot/result edition')
    return dict(version=VERSION, source_id=identifier, source_updated=updated,
                folder_number=text(status, 'cbc:ContractFolderID'),
                project=project(status.find('cac:ProcurementProject', NS)),
                lots=lots, results=results,
                stage='published-budget-and-tender-results-not-payments')
