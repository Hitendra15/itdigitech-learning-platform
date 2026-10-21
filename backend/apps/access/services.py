from datetime import timedelta

from django.utils import timezone

from .models import Enrollment


def has_access(user, course, lesson=None) -> bool:
    """Single source of truth for 'can this user see this course/lesson?'."""
    if lesson is not None and lesson.is_free_preview:
        return True
    if not user or not user.is_authenticated:
        return False
    if user.role == "admin":
        return True
    return Enrollment.objects.active().filter(user=user, course=course).exists()


def grant_enrollment(user, course, plan=None, order=None):
    """Create or extend an enrollment (renewal-safe)."""
    now = timezone.now()
    validity = getattr(plan, "validity_days", None)
    expires = now + timedelta(days=validity) if validity else None
    enr, created = Enrollment.objects.get_or_create(
        user=user,
        course=course,
        defaults={"plan": plan, "order": order, "expires_at": expires, "organization": user.organization},
    )
    if not created:
        base = enr.expires_at if enr.expires_at and enr.expires_at > now else now
        enr.expires_at = base + timedelta(days=validity) if validity else None
        enr.status = Enrollment.Status.ACTIVE
        enr.plan, enr.order = plan, order
        enr.save()
    return enr
