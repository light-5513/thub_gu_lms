"""Excel parsing/validation tests for bulk import."""
import pytest
from openpyxl import Workbook

from app.core.errors import AppError
from app.services.import_service import parse_xlsx, validate_rows


def _build_workbook(rows):
    wb = Workbook()
    ws = wb.active
    header = ["first_name", "last_name", "email", "roll_number", "course", "branch", "section", "phone", "batch", "academic_year"]
    ws.append(header)
    for r in rows:
        ws.append(r)
    from io import BytesIO

    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()


def test_parse_valid_workbook():
    content = _build_workbook([["Rahul", "Sharma", "rahul@x.com", "R001", "B.Tech", "CSE", "A", None, None, None]])
    rows = parse_xlsx(content)
    assert len(rows) == 1
    assert rows[0]["email"] == "rahul@x.com"


def test_parse_rejects_missing_columns():
    wb = Workbook()
    ws = wb.active
    ws.append(["name"])
    ws.append(["Someone"])
    from io import BytesIO

    buf = BytesIO()
    wb.save(buf)
    with pytest.raises(AppError) as exc:
        parse_xlsx(buf.getvalue())
    assert "Missing required columns" in str(exc.value)


def test_validate_catches_bad_rows():
    rows = [
        {"_row": 2, "first_name": "A", "last_name": "B", "email": "not-an-email", "roll_number": "R1", "course": "C", "branch": "B", "section": "S"},
        {"_row": 3, "first_name": "", "last_name": "B", "email": "ok@x.com", "roll_number": "", "course": "", "branch": "B", "section": ""},
        {"_row": 4, "first_name": "C", "last_name": "D", "email": "dup@x.com", "roll_number": "R3", "course": "C", "branch": "B", "section": "S"},
        {"_row": 5, "first_name": "E", "last_name": "F", "email": "dup@x.com", "roll_number": "R4", "course": "C", "branch": "B", "section": "S"},
    ]
    valid, errors = validate_rows(rows, existing_emails=set(), existing_rolls=set())
    assert len(valid) == 1
    messages = [e["error"] for e in errors]
    assert "Invalid Email" in messages
    assert any("Duplicate" in m for m in messages)
    # Row-level error info present for the invalid email row
    email_errs = [e for e in errors if e["field"] == "email"]
    assert email_errs[0]["row"] == 2


def test_validate_against_existing_db_records():
    rows = [
        {"_row": 2, "first_name": "A", "last_name": "B", "email": "taken@x.com", "roll_number": "R9", "course": "C", "branch": "B", "section": "S"}
    ]
    valid, errors = validate_rows(rows, existing_emails={"taken@x.com"}, existing_rolls=set())
    assert len(valid) == 0
    assert errors[0]["error"] == "Email already exists"


def test_empty_file_rejected():
    with pytest.raises(AppError):
        parse_xlsx(b"not an excel file")
