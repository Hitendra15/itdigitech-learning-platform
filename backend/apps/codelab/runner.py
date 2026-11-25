"""Server-side code execution for the languages a browser cannot run (Java, C, C++).

Student code is NEVER executed inside Django. It is sent to a separate, isolated Piston container
(https://github.com/engineer-man/piston) with CPU, memory, time and network limits. Python, JavaScript
and HTML run inside the student's own browser (see frontend/src/lab/runners.js) and never reach this file.
"""
import requests
from django.conf import settings

LANGUAGES = {
    "python": {"label": "Python 3", "piston": "python", "file": "main.py"},
    "javascript": {"label": "JavaScript (Node)", "piston": "javascript", "file": "main.js"},
    "java": {"label": "Java", "piston": "java", "file": "Main.java"},
    "c": {"label": "C", "piston": "c", "file": "main.c"},
    "cpp": {"label": "C++", "piston": "c++", "file": "main.cpp"},
}


class RunnerUnavailable(Exception):
    pass


def run(language, code, stdin=""):
    spec = LANGUAGES[language]
    url = getattr(settings, "CODE_RUNNER_URL", "")
    print('URL:---------------',url)
    if not url:
        raise RunnerUnavailable("The code runner is not configured on this server.")
    payload = {
        "language": spec["piston"], "version": "*", "files": [{"name": spec["file"], "content": code}], "stdin": stdin,
        "compile_timeout": 10000, "run_timeout": settings.CODE_RUN_TIMEOUT_MS,
        "compile_memory_limit": 256 * 1024 * 1024, "run_memory_limit": 128 * 1024 * 1024,
    }
    try:
        r = requests.post(url, json=payload, timeout=settings.CODE_RUN_TIMEOUT_MS / 1000 + 15)
        r.raise_for_status()
        data = r.json()
    except (requests.RequestException, ValueError) as e:
        raise RunnerUnavailable("The code runner is busy or offline. Try again in a moment.") from e
    comp, run_ = data.get("compile") or {}, data.get("run") or {}
    return {
        "stdout": (run_.get("stdout") or "")[:20000], "stderr": (run_.get("stderr") or "")[:20000],
        "compile_output": (comp.get("output") or "")[:20000] if comp.get("code") not in (0, None) else "",
        "exit_code": run_.get("code"), "signal": run_.get("signal"),
    }
