"""CSV imports for non-technical admins: students and test questions.

Both support a dry run so the admin can see exactly what will happen before anything is saved.
"""
import csv
import io
import re

from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email
from django.db import transaction
from rest_framework.exceptions import ValidationError

MAX_BYTES = 2 * 1024 * 1024
MAX_ROWS = 1000
PREVIEW_ROWS = 300

STUDENT_ALIASES = {
    "name": {"name", "full_name", "student_name", "student", "fullname"},
    "email": {"email", "email_address", "e-mail", "mail", "email_id"},
    "phone": {"phone", "mobile", "mobile_number", "phone_number", "contact", "mobile_no"},
    "college": {"college", "college_name", "institute", "institution", "organization"},
}
QUESTION_ALIASES = {
    "question": {"question", "text", "question_text", "q"},
    "correct": {"correct", "answer", "correct_answer", "correct_option", "correct_options", "answers"},
    "marks": {"marks", "mark", "points", "score"},
    "explanation": {"explanation", "reason", "solution"},
}
LETTERS = "abcdefgh"


def _norm(h):
    return re.sub(r"[^a-z0-9]+", "_", (h or "").strip().lower()).strip("_")


def read_rows(upload, aliases, required, extra=None):
    """Return [(row_number, {canonical: value})]. Raises a friendly ValidationError for bad files."""
    if upload.size > MAX_BYTES:
        raise ValidationError({"file": "The file is too large. Keep it under 2 MB."})
    raw = upload.read()
    for enc in ("utf-8-sig", "cp1252"):
        try:
            text = raw.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    else:
        raise ValidationError({"file": "We could not read this file. Save it as CSV (UTF-8) from Excel or Google Sheets."})
    try:
        dialect = csv.Sniffer().sniff(text[:2048], delimiters=",;\t")
    except csv.Error:
        dialect = csv.excel
    reader = csv.reader(io.StringIO(text), dialect)
    try:
        header = next(reader)
    except StopIteration:
        raise ValidationError({"file": "The file is empty."})

    cols = {}
    for i, h in enumerate(header):
        n = _norm(h)
        for canon, names in aliases.items():
            if n in names and canon not in cols:
                cols[canon] = i
        if extra:
            m = extra(n)
            if m and m not in cols:
                cols[m] = i
    missing = [r for r in required if r not in cols]
    if missing:
        raise ValidationError({"file": f"The file needs a column named {', '.join(repr(m) for m in missing)}. Download the template to see the format."})

    rows = []
    for n, rec in enumerate(reader, start=2):
        if not any((c or "").strip() for c in rec):
            continue
        rows.append((n, {k: (rec[i].strip() if i < len(rec) else "") for k, i in cols.items()}))
        if len(rows) > MAX_ROWS:
            raise ValidationError({"file": f"Please import at most {MAX_ROWS} rows at a time."})
    if not rows:
        raise ValidationError({"file": "The file has a header but no rows."})
    return rows


# ------------------------------------------------------------------ students
def import_students(upload, *, course=None, organization=None, validity_days=None, send_invites=True, dry_run=True, actor=None):
    from apps.access.models import Enrollment  # noqa: F401  (kept for clarity of dependencies)
    from apps.accounts import tokens
    from apps.accounts.models import StudentProfile, User
    from apps.notifications import emails
    from apps.adminpanel.tasks import bulk_grant_access
    from apps.notifications.emails import dispatch

    rows = read_rows(upload, STUDENT_ALIASES, required=["email"])
    existing = {u.email: u for u in User.objects.filter(email__in=[r["email"].lower() for _, r in rows if r.get("email")])}
    seen, report = set(), []
    counts = {"new": 0, "existing": 0, "invalid": 0, "duplicate": 0}
    to_create, to_enrol = [], []

    for n, r in rows:
        email = (r.get("email") or "").strip().lower()
        item = {"row": n, "email": email, "name": r.get("name", ""), "status": "new", "message": ""}
        try:
            validate_email(email)
        except DjangoValidationError:
            item.update(status="invalid", message="This is not a valid email address.")
        else:
            if email in seen:
                item.update(status="duplicate", message="Appears more than once in the file. Only the first row is used.")
            elif email in existing:
                item.update(status="existing", message="Already registered." + (" Will be added to the course." if course else ""))
                to_enrol.append(existing[email])
            elif not r.get("name"):
                item.update(status="invalid", message="Name is missing.")
            else:
                to_create.append((r, email))
            seen.add(email)
        counts[item["status"]] += 1
        report.append(item)

    out = {"dry_run": dry_run, "summary": counts, "rows": report[:PREVIEW_ROWS], "truncated": len(report) > PREVIEW_ROWS}
    if dry_run:
        return out

    created_users = []
    for r, email in to_create:
        with transaction.atomic():
            user = User.objects.create_user(
                email, None, phone=(r.get("phone") or "")[:15],
                status=User.Status.ACTIVE if course else User.Status.PENDING_PAYMENT,
                organization=organization,
            )
            StudentProfile.objects.create(user=user, full_name=r["name"][:150], college_name=(r.get("college") or (organization.name if organization else ""))[:200])
        created_users.append(user)
        if send_invites:
            uid, token = tokens.make_reset_token(user)
            emails.queue_email(
                "admin_created", "Your IT DigiTech account is ready", user.email,
                {"name": emails.display_name(user), "reset_url": emails._links(f"/reset-password?uid={uid}&token={token}"),
                 "valid_minutes": 60},
            )
    if organization:
        for u in to_enrol:
            if not u.organization_id:
                u.organization = organization
                u.save(update_fields=["organization"])
    if course:
        ids = [u.pk for u in created_users + to_enrol]
        if ids:
            dispatch(bulk_grant_access, course.pk, ids, validity_days)
    out["created"] = len(created_users)
    return out


# ----------------------------------------------------------------- questions
def _option_col(n):
    m = re.fullmatch(r"(?:option_?)?([a-h])", n)
    return f"opt_{m.group(1)}" if m else None


def import_questions(upload, test, *, dry_run=True):
    from apps.assessments.models import Question

    rows = read_rows(upload, QUESTION_ALIASES, required=["question", "correct"], extra=_option_col)
    start = (test.questions.order_by("-order").values_list("order", flat=True).first() or 0) + 1
    report, good = [], []
    for n, r in rows:
        opts = [{"id": l, "text": r.get(f"opt_{l}", "")} for l in LETTERS if r.get(f"opt_{l}", "")]
        item = {"row": n, "question": r.get("question", "")[:140], "status": "ok", "message": ""}
        correct = [c.lower() for c in re.split(r"[\s,;/|&]+", r.get("correct", "")) if c]
        marks_raw = r.get("marks", "") or "1"
        problem = None
        if not r.get("question"):
            problem = "The question text is empty."
        elif len(opts) < 2:
            problem = "Add at least two options (columns option_a, option_b ...)."
        elif not correct:
            problem = "The correct answer is missing."
        elif not set(correct) <= {o["id"] for o in opts}:
            problem = f"The correct answer ({r.get('correct')}) does not match any filled option."
        elif not marks_raw.isdigit() or int(marks_raw) < 1:
            problem = "Marks must be a whole number of 1 or more."
        if problem:
            item.update(status="invalid", message=problem)
        else:
            good.append({"text": r["question"], "options": opts, "correct_answer": sorted(set(correct)),
                         "marks": int(marks_raw), "explanation": r.get("explanation", "")})
        report.append(item)

    out = {"dry_run": dry_run, "summary": {"valid": len(good), "invalid": len(report) - len(good)},
           "rows": report[:PREVIEW_ROWS], "truncated": len(report) > PREVIEW_ROWS}
    if dry_run:
        return out
    with transaction.atomic():
        for i, g in enumerate(good):
            Question.objects.create(test=test, order=start + i, **g)
    out["created"] = len(good)
    return out
