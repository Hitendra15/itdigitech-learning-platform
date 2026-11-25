from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.billing.models import Order, Plan
from apps.catalog.models import Course, Lesson, Module


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def user(db):
    return User.objects.create_user("stud@example.com", "Str0ng-pass!")


@pytest.fixture
def course(db):
    c = Course.objects.create(title="Python", slug="python", is_published=True)
    m = Module.objects.create(course=c, title="M1")
    Lesson.objects.create(module=m, title="Free", is_free_preview=True)
    Lesson.objects.create(module=m, title="Paid")
    return c


@pytest.fixture
def plan(course):
    p = Plan.objects.create(name="Python", price=Decimal("1000"), gst_percent=Decimal("18"), validity_days=30)
    p.courses.add(course)
    return p


@pytest.fixture
def order(user, plan):
    return Order.objects.create(
        user=user, plan=plan, subtotal=1000, tax=180, total=1180, razorpay_order_id="order_TEST1"
    )


@pytest.fixture
def admin_user(db):
    u = User.objects.create_user("boss@example.com", "Str0ng-pass!", role="admin", status="active", is_staff=True)
    return u


@pytest.fixture
def admin_client(admin_user):
    c = APIClient()
    c.force_authenticate(admin_user)
    return c


@pytest.fixture
def auth_client(user):
    c = APIClient()
    c.force_authenticate(user)
    return c
