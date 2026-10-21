import pytest
from django.core import mail

from apps.access.models import Enrollment
from apps.accounts.models import User
from apps.assessments.models import Test
from apps.billing.models import Plan
from apps.notifications.models import ExportJob, Notification

A = "/api/v1/admin-api"


def test_admin_endpoints_reject_students_and_anonymous(auth_client, client, db):
    for path in ("/dashboard", "/users", "/courses", "/tickets", "/orders", "/flags"):
        assert auth_client.get(A + path).status_code == 403
        assert client.get(A + path).status_code == 401


def test_dashboard(admin_client, order, user):
    r = admin_client.get(A + "/dashboard")
    assert r.status_code == 200
    assert r.data["totals"]["students"] == 1 and len(r.data["signups"]) == 14 and len(r.data["revenue"]) == 14


# ---------------------------------------------------------------- catalog
def test_course_curriculum_authoring(admin_client):
    r = admin_client.post(A + "/courses", {"title": "Data Structures", "description": "Arrays to graphs"}, format="json")
    assert r.status_code == 201 and r.data["slug"] == "data-structures"
    cid = r.data["id"]
    # duplicate titles get a unique slug
    assert admin_client.post(A + "/courses", {"title": "Data Structures"}, format="json").data["slug"] == "data-structures-2"

    m = admin_client.post(A + "/modules", {"course": cid, "title": "Basics", "order": 1}, format="json").data
    l = admin_client.post(A + "/lessons", {"module": m["id"], "title": "Intro", "lesson_type": "video",
                                           "video_path": "/ds/intro/playlist.m3u8", "note_content": "Read chapter 1"},
                          format="json")
    assert l.status_code == 201 and l.data["video_path"] == "/ds/intro/playlist.m3u8" and l.data["note_content"] == "Read chapter 1"

    cur = admin_client.get(f"{A}/courses/{cid}/curriculum").data
    assert cur["course"]["modules_count"] == 1 and cur["modules"][0]["lessons"][0]["title"] == "Intro"

    # reorder + soft delete
    l2 = admin_client.post(A + "/lessons", {"module": m["id"], "title": "Second", "order": 2}, format="json").data
    admin_client.post(A + "/lessons/reorder", {"ids": [l2["id"], l.data["id"]]}, format="json")
    assert admin_client.get(f"{A}/lessons?module={m['id']}").data[0]["title"] == "Second"
    assert admin_client.delete(f"{A}/courses/{cid}").status_code == 204
    assert admin_client.get(f"{A}/courses/{cid}").status_code == 404


def test_published_course_shows_on_student_catalog(admin_client, client):
    cid = admin_client.post(A + "/courses", {"title": "Go", "is_published": True}, format="json").data["id"]
    assert [c["title"] for c in client.get("/api/v1/courses").data] == ["Go"]
    admin_client.patch(f"{A}/courses/{cid}", {"is_published": False}, format="json")
    assert client.get("/api/v1/courses").data == []


# ------------------------------------------------------------ assessments
def test_test_and_question_authoring_validates_answers(admin_client, course):
    t = admin_client.post(A + "/tests", {"course": str(course.public_id), "title": "Quiz 1", "duration_minutes": 15,
                                         "pass_percent": 60}, format="json")
    assert t.status_code == 201
    opts = [{"id": "a", "text": "int"}, {"id": "b", "text": "str"}]
    q = {"test": t.data["id"], "text": "Pick types", "options": opts, "correct_answer": ["a"], "marks": 2}
    assert admin_client.post(A + "/questions", q, format="json").status_code == 201
    assert admin_client.post(A + "/questions", {**q, "correct_answer": ["z"]}, format="json").status_code == 400
    assert admin_client.post(A + "/questions", {**q, "correct_answer": []}, format="json").status_code == 400
    assert admin_client.post(A + "/questions", {**q, "options": opts[:1]}, format="json").status_code == 400
    assert admin_client.post(A + "/questions", {**q, "options": [opts[0], opts[0]]}, format="json").status_code == 400
    assert admin_client.get(A + "/tests").data["results"][0]["question_count"] == 1
    bad = admin_client.post(A + "/tests", {"course": str(course.public_id), "title": "x", "pass_percent": 150}, format="json")
    assert bad.status_code == 400


def test_student_takes_test_authored_in_console(admin_client, auth_client, user, course):
    t = admin_client.post(A + "/tests", {"course": str(course.public_id), "title": "Quiz"}, format="json").data
    admin_client.post(A + "/questions", {"test": t["id"], "text": "2+2?", "options": [{"id": "a", "text": "4"}, {"id": "b", "text": "5"}],
                                         "correct_answer": ["a"]}, format="json")
    Enrollment.objects.create(user=user, course=course)
    att = auth_client.post(f"/api/v1/tests/{t['id']}/start").data
    qid = att["questions"][0]["id"]
    auth_client.post(f"/api/v1/attempts/{att['attempt']['id']}/answer", {"question_id": qid, "response": ["a"]}, format="json")
    done = auth_client.post(f"/api/v1/attempts/{att['attempt']['id']}/submit").data
    assert done["passed"] is True
    assert admin_client.get(A + "/attempts").data["count"] == 1


# ---------------------------------------------------------------- billing
def test_plans_and_coupons(admin_client, course, order):
    p = admin_client.post(A + "/plans", {"name": "Pro", "plan_type": "single", "price": "1999.00", "validity_days": 365,
                                         "courses": [str(course.public_id)]}, format="json")
    assert p.status_code == 201 and [str(c) for c in p.data["courses"]] == [str(course.public_id)]
    assert admin_client.post(A + "/plans", {"name": "Free", "price": "0"}, format="json").status_code == 400
    # a plan that has orders cannot be deleted
    used = Plan.objects.get(pk=order.plan_id)
    assert admin_client.delete(f"{A}/plans/{used.public_id}").status_code == 400
    assert admin_client.delete(f"{A}/plans/{p.data['id']}").status_code == 204

    c = admin_client.post(A + "/coupons", {"code": " save20 ", "percent_off": "20"}, format="json")
    assert c.status_code == 201 and c.data["code"] == "SAVE20"
    assert admin_client.post(A + "/coupons", {"code": "SAVE20", "percent_off": "5"}, format="json").status_code == 400
    assert admin_client.post(A + "/coupons", {"code": "ZERO"}, format="json").status_code == 400
    assert admin_client.post(A + "/coupons", {"code": "BIG", "percent_off": "150"}, format="json").status_code == 400


def test_orders_readonly(admin_client, order):
    r = admin_client.get(A + "/orders?search=stud@example.com")
    assert r.data["count"] == 1 and r.data["results"][0]["plan_name"] == "Python"
    assert admin_client.delete(f"{A}/orders/{order.public_id}").status_code == 405


# ------------------------------------------------------------------ users
def test_user_management(admin_client, admin_user, user, course):
    uid = str(user.public_id)
    r = admin_client.patch(f"{A}/users/{uid}", {"full_name": "Ravi Kumar", "phone": "9999999999"}, format="json")
    assert r.status_code == 200 and r.data["full_name"] == "Ravi Kumar"

    assert admin_client.post(f"{A}/users/{uid}/suspend").data["status"] == "suspended"
    login = admin_client.__class__().post("/api/v1/auth/login", {"email": user.email, "password": "Str0ng-pass!"}, format="json")
    assert login.status_code == 403 and "suspended" in login.data["detail"]  # clear message, no sign-in
    wrong = admin_client.__class__().post("/api/v1/auth/login", {"email": user.email, "password": "nope"}, format="json")
    assert wrong.status_code == 401
    assert admin_client.post(f"{A}/users/{uid}/activate").data["is_active"] is True

    # enrol manually, then revoke
    r = admin_client.post(f"{A}/users/{uid}/enrollments", {"course": str(course.public_id), "validity_days": 30}, format="json")
    assert r.data[0]["status"] == "active"
    user.refresh_from_db()
    assert user.status == "active" and Notification.objects.filter(user=user, title="New course unlocked").exists()
    admin_client.post(f"{A}/users/{uid}/revoke-course", {"course": str(course.public_id)}, format="json")
    assert Enrollment.objects.get(user=user).status == "revoked"

    # admins cannot lock themselves out
    me = str(admin_user.public_id)
    assert admin_client.post(f"{A}/users/{me}/suspend").status_code == 400
    assert admin_client.patch(f"{A}/users/{me}", {"role": "student"}, format="json").status_code == 400


def test_invite_user_sends_set_password_email(admin_client):
    mail.outbox.clear()
    r = admin_client.post(A + "/users", {"email": "NewStaff@example.com", "full_name": "Neha Rao", "role": "admin"}, format="json")
    assert r.status_code == 201 and r.data["role"] == "admin"
    u = User.objects.get(email="newstaff@example.com")
    assert not u.has_usable_password() and u.is_staff
    assert mail.outbox[0].to == ["newstaff@example.com"] and "reset-password?uid=" in mail.outbox[0].alternatives[0][0]
    assert admin_client.post(A + "/users", {"email": "newstaff@example.com", "full_name": "Dup"}, format="json").status_code == 400


def test_send_reset_link_to_student(admin_client, user):
    mail.outbox.clear()
    admin_client.post(f"{A}/users/{user.public_id}/send-reset")
    assert mail.outbox[0].to == [user.email]


# ------------------------------------------------- announcements + exports
def test_announcement_broadcast_runs_in_celery(admin_client, user, admin_user):
    paying = User.objects.create_user("paid@example.com", "Str0ng-pass!", status="active")
    mail.outbox.clear()
    r = admin_client.post(A + "/announcements", {"title": "New batch", "body": "Starts Monday.", "audience": "active",
                                                 "send_email": True}, format="json")
    assert r.status_code == 201
    assert Notification.objects.filter(title="New batch").count() == 1  # only the paid student
    assert Notification.objects.get(title="New batch").user == paying
    assert [m.to for m in mail.outbox] == [["paid@example.com"]]
    a = admin_client.get(A + "/announcements").data["results"][0]
    assert a["status"] == "sent" and a["recipients"] == 1


def test_csv_export_runs_in_background_and_notifies(admin_client, admin_user, order):
    r = admin_client.post(A + "/exports", {"kind": "orders"}, format="json")
    assert r.status_code == 202
    job = ExportJob.objects.get()
    assert job.status == "done" and job.row_count == 1 and job.file.read().decode("utf-8-sig").splitlines()[1].count(",") >= 5
    assert Notification.objects.filter(user=admin_user, title__contains="export is ready").exists()
    assert admin_client.post(A + "/exports", {"kind": "secrets"}, format="json").status_code == 400


# ------------------------------------------------------------ config/audit
def test_flags_faqs_and_audit_trail(admin_client, client):
    admin_client.post(A + "/flags", {"key": "ai_assistant", "enabled": True}, format="json")
    f = admin_client.post(A + "/faqs", {"question": "How do I get an invoice?", "answer": "From Payments.", "order": 1}, format="json")
    assert f.status_code == 201
    assert [x["question"] for x in client.get("/api/v1/support/faqs").data] == ["How do I get an invoice?"]
    log = admin_client.get(A + "/audit-log").data["results"]
    assert {e["target_type"] for e in log} >= {"FeatureFlag", "FAQ"} and log[0]["actor"] == "boss@example.com"
