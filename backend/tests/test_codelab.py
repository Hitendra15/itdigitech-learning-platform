from unittest import mock

import pytest

from apps.access.models import Enrollment
from apps.catalog.models import Lesson


def test_run_validates_and_hides_runner_errors(auth_client, settings):
    settings.CODE_RUNNER_URL = ""
    r = auth_client.post("/api/v1/code/run", {"language": "java", "code": "class Main{}"}, format="json")
    assert r.status_code == 503 and "not configured" in r.data["detail"]
    assert auth_client.post("/api/v1/code/run", {"language": "brainfuck", "code": "+"}, format="json").status_code == 400
    assert auth_client.post("/api/v1/code/run", {"language": "c", "code": "x" * 20001}, format="json").status_code == 400


def test_run_requires_login(client, db):
    assert client.post("/api/v1/code/run", {"language": "c", "code": "int main(){}"}, format="json").status_code == 401


def test_run_returns_normalised_output(auth_client, settings):
    settings.CODE_RUNNER_URL = "http://runner/api/v2/execute"
    fake = mock.Mock(status_code=200)
    fake.raise_for_status.return_value = None
    fake.json.return_value = {"compile": {"code": 0, "output": ""}, "run": {"stdout": "42\n", "stderr": "", "code": 0}}
    with mock.patch("apps.codelab.runner.requests.post", return_value=fake) as post:
        r = auth_client.post("/api/v1/code/run", {"language": "cpp", "code": "int main(){}", "stdin": "1"}, format="json")
    assert r.status_code == 200 and r.data["stdout"] == "42\n" and r.data["exit_code"] == 0
    sent = post.call_args.kwargs["json"]
    assert sent["language"] == "c++" and sent["run_timeout"] == 5000 and sent["stdin"] == "1"


def test_saved_code_needs_access(auth_client, user, course):
    paid = Lesson.objects.get(module__course=course, title="Paid")
    url = f"/api/v1/lessons/{paid.public_id}/code"
    assert auth_client.get(url).status_code == 403
    Enrollment.objects.create(user=user, course=course)
    assert auth_client.get(url).data["code"] is None
    assert auth_client.put(url, {"code": "print(1)", "language": "python"}, format="json").data["saved"]
    assert auth_client.get(url).data == {"code": "print(1)", "language": "python"}
