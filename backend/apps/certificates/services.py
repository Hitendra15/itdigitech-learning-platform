import io
from datetime import date

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone
from reportlab.graphics import renderPDF
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfgen import canvas

from apps.access.models import Enrollment
from apps.assessments.models import Attempt, Test
from apps.learning.services import course_progress_percent
from apps.notifications.services import notify

from .models import Certificate

DEFAULT_RULES = {"min_progress": 100, "tests_required": True}


def rules_for(course):
    return {**DEFAULT_RULES, **(course.rule_config or {})}


def _test_results(user, course):
    """Best attempt per published test. Returns (tests, passed_count, average_percent)."""
    tests = list(Test.objects.filter(course=course, is_published=True))
    passed, scores = 0, []
    for t in tests:
        best = None
        for a in Attempt.objects.filter(user=user, test=t).exclude(status=Attempt.Status.IN_PROGRESS):
            pct = round(a.score * 100 / a.total_marks) if a.total_marks else 0
            if best is None or pct > best[0]:
                best = (pct, a.passed)
        if best:
            scores.append(best[0])
            passed += 1 if best[1] else 0
    avg = round(sum(scores) / len(scores)) if scores else None
    return tests, passed, avg


def eligibility(user, course):
    """What a student still has to do before the certificate unlocks."""
    rules = rules_for(course)
    progress = course_progress_percent(user, course)
    tests, passed, avg = _test_results(user, course)
    todo = []
    if progress < rules["min_progress"]:
        todo.append(f"Finish the lessons ({progress}% done, {rules['min_progress']}% needed).")
    if rules["tests_required"] and len(tests) > passed:
        todo.append(f"Pass every test ({passed} of {len(tests)} passed).")
    enrolled = Enrollment.objects.filter(user=user, course=course).exclude(status=Enrollment.Status.REVOKED).exists()
    if not enrolled:
        todo.append("You are not enrolled in this course.")
    return {
        "eligible": not todo, "progress": progress, "required_progress": rules["min_progress"],
        "tests_total": len(tests), "tests_passed": passed, "average_score": avg, "todo": todo,
    }


class NotEligible(Exception):
    def __init__(self, todo):
        self.todo = todo
        super().__init__(" ".join(todo))


def issue_certificate(user, course) -> Certificate:
    existing = Certificate.objects.filter(user=user, course=course).first()
    if existing:
        return existing
    state = eligibility(user, course)
    if not state["eligible"]:
        raise NotEligible(state["todo"])
    profile = getattr(user, "profile", None)
    name = (profile.full_name if profile else "").strip()
    if not name:
        raise NotEligible(["Add your full name under Account so it can be printed on the certificate."])
    try:
        with transaction.atomic():
            cert = Certificate.objects.create(
                user=user, course=course, recipient_name=name, course_title=course.title,
                average_score=state["average_score"],
            )
    except IntegrityError:  # double click / two tabs
        return Certificate.objects.get(user=user, course=course)
    notify(user, "Your certificate is ready", f"{course.title}: download it from Certificates.", "/certificates")
    return cert


def verify_url(cert):
    return f"{settings.FRONTEND_URL}/verify/{cert.code}"


def render_pdf(cert) -> bytes:
    """A4 landscape certificate with a QR code that opens the public verification page."""
    buf = io.BytesIO()
    w, h = landscape(A4)
    c = canvas.Canvas(buf, pagesize=(w, h))
    c.setTitle(f"Certificate {cert.code}")
    c.setAuthor("IT DigiTech Solutions")
    navy, blue, muted = HexColor("#27235C"), HexColor("#007FFF"), HexColor("#4B6075")

    c.setFillColor(HexColor("#F0F0FF")); c.rect(0, 0, w, h, stroke=0, fill=1)
    c.setStrokeColor(navy); c.setLineWidth(3); c.rect(24, 24, w - 48, h - 48)
    c.setStrokeColor(blue); c.setLineWidth(1); c.rect(34, 34, w - 68, h - 68)
    c.setFillColor(blue); c.rect(34, h - 112, w - 68, 78, stroke=0, fill=1)

    c.setFillColor(HexColor("#ffffff")); c.setFont("Helvetica-Bold", 22)
    c.drawCentredString(w / 2, h - 82, "IT DIGITECH SOLUTIONS")
    c.setFont("Helvetica", 11); c.drawCentredString(w / 2, h - 100, "IT DigiTech Learn")

    c.setFillColor(navy); c.setFont("Helvetica-Bold", 34)
    c.drawCentredString(w / 2, h - 175, "Certificate of Completion")
    c.setFillColor(muted); c.setFont("Helvetica", 13)
    c.drawCentredString(w / 2, h - 210, "This is to certify that")

    name_size = 38 if len(cert.recipient_name) < 28 else 28
    c.setFillColor(blue); c.setFont("Helvetica-Bold", name_size)
    c.drawCentredString(w / 2, h - 262, cert.recipient_name)
    c.setStrokeColor(navy); c.setLineWidth(0.8); c.line(w / 2 - 170, h - 272, w / 2 + 170, h - 272)

    c.setFillColor(muted); c.setFont("Helvetica", 13)
    c.drawCentredString(w / 2, h - 303, "has successfully completed the course")
    c.setFillColor(navy); c.setFont("Helvetica-Bold", 24 if len(cert.course_title) < 40 else 18)
    c.drawCentredString(w / 2, h - 338, cert.course_title)
    if cert.average_score is not None:
        c.setFillColor(muted); c.setFont("Helvetica", 12)
        c.drawCentredString(w / 2, h - 362, f"with an average assessment score of {cert.average_score}%")

    issued = timezone.localtime(cert.issued_at).date() if cert.issued_at else date.today()
    c.setFillColor(navy); c.setFont("Helvetica-Bold", 12)
    c.drawString(70, 92, issued.strftime("%d %B %Y"))
    c.setStrokeColor(muted); c.line(70, 106, 230, 106)
    c.setFillColor(muted); c.setFont("Helvetica", 10); c.drawString(70, 78, "Date of issue")

    c.setFillColor(navy); c.setFont("Helvetica-Bold", 12); c.drawCentredString(w / 2, 92, f"Certificate ID: {cert.code}")
    c.setFillColor(muted); c.setFont("Helvetica", 9.5)
    c.drawCentredString(w / 2, 76, f"Verify at {settings.FRONTEND_URL}/verify/{cert.code}")

    qr = QrCodeWidget(verify_url(cert))
    x0, y0, x1, y1 = qr.getBounds()
    size = 78
    d = Drawing(size, size, transform=[size / (x1 - x0), 0, 0, size / (y1 - y0), 0, 0])
    d.add(qr)
    renderPDF.draw(d, c, w - 70 - size, 62)
    c.setFillColor(muted); c.setFont("Helvetica", 8); c.drawCentredString(w - 70 - size / 2, 52, "Scan to verify")

    c.showPage(); c.save()
    return buf.getvalue()
