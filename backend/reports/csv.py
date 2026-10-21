"""CSV export helpers with spreadsheet formula-injection protection."""

from __future__ import annotations

import csv
import io

from django.http import HttpResponse

#: Characters that make a spreadsheet treat a cell as a formula.
FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r", "\n")


def sanitize_csv_value(value) -> str:
    """Return a CSV-safe string for ``value``.

    Cells that begin with a formula character are prefixed with a single
    quote so Excel / LibreOffice render them as text instead of executing
    them. This is the standard mitigation for CSV formula injection.
    """
    if value is None:
        return ""
    if isinstance(value, bool):
        return "true" if value else "false"
    text = str(value)
    if text.startswith(FORMULA_PREFIXES):
        return "'" + text
    return text


def build_csv(headers: list[str], rows: list[list]) -> str:
    """Build a CSV document from headers and rows."""
    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\n", quoting=csv.QUOTE_MINIMAL)
    writer.writerow([sanitize_csv_value(header) for header in headers])
    for row in rows:
        writer.writerow([sanitize_csv_value(cell) for cell in row])
    return buffer.getvalue()


def csv_response(filename: str, headers: list[str], rows: list[list]) -> HttpResponse:
    """Return an HTTP response containing the generated CSV document."""
    response = HttpResponse(build_csv(headers, rows), content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    # Prevent intermediary caching of exported student data.
    response["Cache-Control"] = "no-store"
    return response
