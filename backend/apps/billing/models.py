from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils import timezone

from common.models import BaseModel


class Plan(BaseModel):
    class Type(models.TextChoices):
        SINGLE = "single", "Single course"
        COMBO = "combo", "Combo"
        ALL = "all", "All courses"
        COLLEGE = "college", "College subscription"

    name = models.CharField(max_length=150)
    plan_type = models.CharField(max_length=20, choices=Type.choices, default=Type.SINGLE)
    courses = models.ManyToManyField("catalog.Course", related_name="plans", blank=True)
    include_all_courses = models.BooleanField(default=False)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    gst_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("18.00"))
    validity_days = models.PositiveIntegerField(null=True, blank=True, help_text="Blank = lifetime")
    organization = models.ForeignKey("organizations.Organization", null=True, blank=True, on_delete=models.SET_NULL)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name

    def covered_courses(self):
        from apps.catalog.models import Course

        if self.include_all_courses:
            return Course.objects.filter(is_published=True, is_deleted=False)
        return self.courses.filter(is_deleted=False)


class Coupon(BaseModel):
    code = models.CharField(max_length=40, unique=True)
    percent_off = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    flat_off = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    valid_from = models.DateTimeField(null=True, blank=True)
    valid_to = models.DateTimeField(null=True, blank=True)
    max_uses = models.PositiveIntegerField(null=True, blank=True)
    used_count = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    def is_valid(self):
        now = timezone.now()
        if not self.is_active:
            return False
        if self.valid_from and now < self.valid_from:
            return False
        if self.valid_to and now > self.valid_to:
            return False
        if self.max_uses is not None and self.used_count >= self.max_uses:
            return False
        return True

    def __str__(self):
        return self.code


class Order(BaseModel):
    class Status(models.TextChoices):
        CREATED = "created", "Created"
        PAID = "paid", "Paid"
        FAILED = "failed", "Failed"
        REFUNDED = "refunded", "Refunded"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="orders")
    plan = models.ForeignKey(Plan, on_delete=models.PROTECT, related_name="orders")
    coupon = models.ForeignKey(Coupon, null=True, blank=True, on_delete=models.SET_NULL)
    organization = models.ForeignKey("organizations.Organization", null=True, blank=True, on_delete=models.SET_NULL)
    subtotal = models.DecimalField(max_digits=10, decimal_places=2)
    discount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    tax = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default="INR")
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.CREATED, db_index=True)
    razorpay_order_id = models.CharField(max_length=64, unique=True, null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=["status", "created_at"])]


class Payment(BaseModel):
    class Status(models.TextChoices):
        CAPTURED = "captured", "Captured"
        FAILED = "failed", "Failed"
        REFUNDED = "refunded", "Refunded"

    order = models.ForeignKey(Order, on_delete=models.PROTECT, related_name="payments")
    razorpay_payment_id = models.CharField(max_length=64, unique=True)
    method = models.CharField(max_length=30, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    error_description = models.CharField(max_length=255, blank=True)
    raw_payload = models.JSONField(default=dict, blank=True)


class WebhookEvent(BaseModel):
    event_id = models.CharField(max_length=100, unique=True)
    event_type = models.CharField(max_length=60)
    payload = models.JSONField()
    processed_at = models.DateTimeField(null=True, blank=True)
    error = models.TextField(blank=True)


class Invoice(BaseModel):
    order = models.OneToOneField(Order, on_delete=models.PROTECT, related_name="invoice")
    invoice_number = models.CharField(max_length=30, unique=True)
    pdf_file = models.FileField(upload_to="invoices/", blank=True)
    issued_at = models.DateTimeField(auto_now_add=True)
