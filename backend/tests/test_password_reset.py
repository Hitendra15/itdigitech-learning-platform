import re

import pytest
from django.core import mail

from apps.accounts.models import User

NEW_PW = "An0ther-Str0ng-pw!"


def _link_params(body):
    m = re.search(r"uid=([^&\s]+)&(?:amp;)?token=([^\s\"<]+)", body)
    return m.group(1), m.group(2)


def test_forgot_password_does_not_reveal_accounts(client, user):
    known = client.post("/api/v1/auth/forgot-password", {"email": user.email}, format="json")
    unknown = client.post("/api/v1/auth/forgot-password", {"email": "nobody@example.com"}, format="json")
    assert known.status_code == unknown.status_code == 200
    assert known.data == unknown.data
    assert len(mail.outbox) == 1 and mail.outbox[0].to == [user.email]


def test_full_reset_flow_is_single_use_and_signs_out_other_devices(client, user):
    client.post("/api/v1/auth/login", {"email": user.email, "password": "Str0ng-pass!"}, format="json")
    old_refresh = client.cookies["refresh_token"].value

    client.post("/api/v1/auth/forgot-password", {"email": user.email}, format="json")
    uid, token = _link_params(mail.outbox[0].alternatives[0][0])

    assert client.get(f"/api/v1/auth/reset-password?uid={uid}&token={token}").data == {"valid": True}
    r = client.post("/api/v1/auth/reset-password", {"uid": uid, "token": token, "password": NEW_PW}, format="json")
    assert r.status_code == 200

    # link cannot be replayed
    assert client.get(f"/api/v1/auth/reset-password?uid={uid}&token={token}").data == {"valid": False}
    r = client.post("/api/v1/auth/reset-password", {"uid": uid, "token": token, "password": NEW_PW + "x"}, format="json")
    assert r.status_code == 400

    # old refresh token is revoked; new password works
    client.cookies["refresh_token"] = old_refresh
    assert client.post("/api/v1/auth/refresh").status_code == 401
    assert client.post("/api/v1/auth/login", {"email": user.email, "password": NEW_PW}, format="json").status_code == 200
    assert any("password was changed" in m.subject for m in mail.outbox)


def test_reset_rejects_weak_password(client, user):
    client.post("/api/v1/auth/forgot-password", {"email": user.email}, format="json")
    uid, token = _link_params(mail.outbox[0].alternatives[0][0])
    r = client.post("/api/v1/auth/reset-password", {"uid": uid, "token": token, "password": "12345678"}, format="json")
    assert r.status_code == 400


def test_reset_rejects_tampered_token(client, user):
    r = client.post("/api/v1/auth/reset-password", {"uid": "MQ", "token": "bad-token", "password": NEW_PW}, format="json")
    assert r.status_code == 400


def test_change_password(auth_client, user):
    r = auth_client.post("/api/v1/auth/change-password",
                         {"current_password": "wrong", "new_password": NEW_PW}, format="json")
    assert r.status_code == 400
    r = auth_client.post("/api/v1/auth/change-password",
                         {"current_password": "Str0ng-pass!", "new_password": "Str0ng-pass!"}, format="json")
    assert r.status_code == 400
    r = auth_client.post("/api/v1/auth/change-password",
                         {"current_password": "Str0ng-pass!", "new_password": NEW_PW}, format="json")
    assert r.status_code == 200 and "access" in r.data
    user.refresh_from_db()
    assert user.check_password(NEW_PW)
    assert any("changed" in m.subject for m in mail.outbox)


def test_register_sends_welcome_and_verification(client, db):
    r = client.post("/api/v1/auth/register", {"full_name": "Asha Patil", "email": "Asha@Example.com",
                                              "password": NEW_PW}, format="json")
    assert r.status_code == 201
    assert mail.outbox[0].to == ["asha@example.com"]
    html = mail.outbox[0].alternatives[0][0]
    token = re.search(r"verify-email\?token=([^\s\"<]+)", html).group(1)

    assert client.post("/api/v1/auth/verify-email", {"token": "junk"}, format="json").status_code == 400
    assert client.post("/api/v1/auth/verify-email", {"token": token}, format="json").status_code == 200
    assert User.objects.get(email="asha@example.com").is_email_verified


def test_email_log_records_sends(client, user):
    from apps.notifications.models import EmailLog

    client.post("/api/v1/auth/forgot-password", {"email": user.email}, format="json")
    assert EmailLog.objects.filter(to=user.email, status="sent", template="password_reset").exists()
