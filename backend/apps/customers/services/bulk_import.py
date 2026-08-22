"""
Bulk contact import from a CSV or Excel file. Column matching is
case-insensitive and tolerant of common variations (e.g. "phone",
"whatsapp", "whatsapp number", "number" all map to the same field) since
real-world spreadsheets are never perfectly consistent.

Every row's phone number goes through the same format validation used
everywhere else in the app (apps.customers.services.phone_validation) —
same honesty note applies: this confirms the number is well-formed, not
that it's actually on WhatsApp. Duplicate numbers (already an existing
customer) are skipped, not overwritten, so a re-upload of the same file
is safe to run twice.
"""
from __future__ import annotations

import csv
import io

import openpyxl

from .phone_validation import validate_phone_format

# Maps recognized header variations (lowercased) to the actual model
# field they represent.
_HEADER_ALIASES = {
    "name": "name", "full name": "name", "customer name": "name", "contact name": "name",
    "whatsapp_number": "whatsapp_number", "whatsapp number": "whatsapp_number",
    "phone": "whatsapp_number", "phone number": "whatsapp_number", "number": "whatsapp_number",
    "mobile": "whatsapp_number", "mobile number": "whatsapp_number",
    "email": "email", "email address": "email",
    "location": "location", "address": "location",
    "account_number": "account_number", "account number": "account_number", "account #": "account_number",
}


def _read_rows(file_obj, filename: str) -> list[dict]:
    """Returns a list of {header: value} dicts, one per data row (header
    row itself excluded), regardless of whether the file is CSV or Excel."""
    if filename.lower().endswith((".xlsx", ".xls")):
        workbook = openpyxl.load_workbook(file_obj, read_only=True, data_only=True)
        sheet = workbook.active
        rows_iter = sheet.iter_rows(values_only=True)
        headers = [str(h).strip().lower() if h else "" for h in next(rows_iter, [])]
        return [
            {headers[i]: (cell if cell is not None else "") for i, cell in enumerate(row) if i < len(headers)}
            for row in rows_iter
        ]
    else:
        text = io.TextIOWrapper(file_obj, encoding="utf-8-sig", errors="replace")
        reader = csv.DictReader(text)
        return [{(k or "").strip().lower(): v for k, v in row.items()} for row in reader]


def bulk_import_contacts(file_obj, filename: str) -> dict:
    from apps.customers.models import Customer, CustomerStatus

    try:
        raw_rows = _read_rows(file_obj, filename)
    except Exception as exc:
        return {"created": 0, "skipped": [], "error": f"Couldn't read that file: {exc}"}

    created = 0
    skipped = []

    for i, row in enumerate(raw_rows, start=2):  # row 1 is the header
        mapped = {}
        for header, value in row.items():
            field = _HEADER_ALIASES.get(header.strip().lower())
            if field and value not in (None, ""):
                mapped[field] = str(value).strip()

        raw_number = mapped.get("whatsapp_number", "")
        if not raw_number:
            skipped.append({"row": i, "reason": "No phone number column found for this row."})
            continue

        check = validate_phone_format(raw_number)
        if not check["valid"]:
            skipped.append({"row": i, "reason": f"{raw_number}: {check['reason']}"})
            continue

        formatted_number = check["formatted"]
        if Customer.objects.filter(whatsapp_number=formatted_number).exists():
            skipped.append({"row": i, "reason": f"{formatted_number}: already exists, skipped."})
            continue

        Customer.objects.create(
            whatsapp_number=formatted_number,
            name=mapped.get("name", ""),
            email=mapped.get("email", ""),
            location=mapped.get("location", ""),
            account_number=mapped.get("account_number", ""),
            status=CustomerStatus.LEAD,
        )
        created += 1

    return {"created": created, "skipped": skipped, "total_rows": len(raw_rows)}
