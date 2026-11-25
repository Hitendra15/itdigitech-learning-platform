from decimal import Decimal

from django.core.management.base import BaseCommand

from apps.assessments.models import Question, Test
from apps.billing.models import Coupon, Plan
from apps.catalog.models import Course, Lesson, Module, Note
from apps.platform_config.models import FeatureFlag
from apps.support.models import FAQ


class Command(BaseCommand):
    help = "Seed demo courses, plans, a test and feature flags"

    def handle(self, *args, **opts):
        py, _ = Course.objects.get_or_create(
            slug="python-basics", defaults={"title": "Python Basics", "is_published": True, "level": "beginner",
                                            "description": "Variables, loops, functions and your first programs."})
        java, _ = Course.objects.get_or_create(
            slug="java-fundamentals", defaults={"title": "Java Fundamentals", "is_published": True, "level": "beginner",
                                                "description": "OOP, collections and exceptions from scratch."})

        m1, _ = Module.objects.get_or_create(course=py, title="Getting started", defaults={"order": 1})
        l1, _ = Lesson.objects.get_or_create(module=m1, title="Install Python and run Hello World",
                                             defaults={"order": 1, "is_free_preview": True, "duration_seconds": 420})
        Lesson.objects.get_or_create(module=m1, title="Variables and data types", defaults={"order": 2, "duration_seconds": 900})
        Note.objects.get_or_create(lesson=l1, title="Setup notes", defaults={"content": "1. Download Python 3.12\n2. Run `python --version`"})

        test, created = Test.objects.get_or_create(course=py, title="Module 1 test", defaults={"module": m1, "duration_minutes": 10})
        if created:
            Question.objects.create(test=test, order=1, text="Which function prints output in Python?",
                                    options=[{"id": "a", "text": "echo()"}, {"id": "b", "text": "print()"}, {"id": "c", "text": "out()"}],
                                    correct_answer=["b"], explanation="print() writes to standard output.")
            Question.objects.create(test=test, order=2, text="Which of these are Python data types?",
                                    options=[{"id": "a", "text": "int"}, {"id": "b", "text": "str"}, {"id": "c", "text": "char[]"}],
                                    correct_answer=["a", "b"], explanation="char[] is not a Python type.")

        # Practice lessons: the code editor opens with this starter code and students see their output live.
        practice = [
            (py, m1, "Practice: your first program", "python", 3,
             "# Print a greeting using a variable\nname = \"IT DigiTech\"\nprint(f\"Hello, {name}!\")\n\nfor i in range(1, 4):\n    print(\"Count:\", i)\n"),
            (py, m1, "Practice: read input", "python", 4,
             "name = input(\"Your name? \")\nprint(\"Nice to meet you,\", name)\n"),
        ]
        for course, mod, title, lang, order, code in practice:
            Lesson.objects.update_or_create(module=mod, title=title, defaults={
                "lesson_type": "practice", "order": order, "duration_seconds": 600, "language": lang, "starter_code": code})
        jm, _ = Module.objects.get_or_create(course=java, title="Your first Java program", defaults={"order": 1})
        Lesson.objects.update_or_create(module=jm, title="Practice: Hello Java", defaults={
            "lesson_type": "practice", "order": 1, "duration_seconds": 600, "language": "java",
            "starter_code": "public class Main {\n    public static void main(String[] args) {\n        System.out.println(\"Hello from Java!\");\n    }\n}\n"})
        web, _ = Course.objects.get_or_create(
            slug="web-development", defaults={"title": "Web Development: HTML, CSS and JavaScript", "is_published": True,
                                              "level": "beginner", "description": "Build and style real web pages, then make them interactive."})
        wm, _ = Module.objects.get_or_create(course=web, title="Build your first page", defaults={"order": 1})
        Lesson.objects.update_or_create(module=wm, title="Practice: a styled page", defaults={
            "lesson_type": "practice", "order": 1, "duration_seconds": 900, "language": "html", "is_free_preview": True,
            "starter_code": "<h1>Hello, web!</h1>\n<p id=\"msg\">Click the button.</p>\n<button onclick=\"document.getElementById('msg').textContent='It works!'\">Click me</button>\n\n<style>\n  body { font-family: sans-serif; padding: 24px; }\n  h1 { color: #2f46e6; }\n</style>\n"})

        p1, _ = Plan.objects.get_or_create(name="Python Basics", defaults={"plan_type": "single", "price": Decimal("999.00"), "validity_days": 365})
        p1.courses.set([py])
        p2, _ = Plan.objects.get_or_create(name="Python + Java Combo", defaults={"plan_type": "combo", "price": Decimal("1599.00"), "validity_days": 365})
        p2.courses.set([py, java])
        p3, _ = Plan.objects.get_or_create(name="Full Stack Pack", defaults={"plan_type": "combo", "price": Decimal("2499.00"), "validity_days": 730})
        p3.courses.set([py, java, web])
        Coupon.objects.get_or_create(code="WELCOME10", defaults={"percent_off": Decimal("10")})
        for key in ("ai_assistant", "practical_lab", "live_chat"):
            FeatureFlag.objects.get_or_create(key=key, defaults={"enabled": False})

        faqs = [
            ("How do I get my invoice?", "Open Payments in the sidebar and use the invoice link next to your payment. A copy is also emailed to you.", "Payments"),
            ("I paid but my courses are still locked", "Access normally unlocks within a minute. If it does not, open a support request with your payment ID and we will fix it.", "Payments"),
            ("How do I reset my password?", "Choose Forgot password on the sign-in page. We email you a link that works for one hour.", "Account"),
            ("How many times can I attempt a test?", "Each test shows its attempt limit before you start. Unfinished attempts resume where you left off.", "Tests"),
            ("How do I get my certificate?", "Finish every lesson and pass each course test, then open the course and press Get certificate. You can download the PDF any time from Certificates, and employers can verify it with the ID printed on it.", "Certificates"),
            ("Can I practise code inside the course?", "Yes. Practice lessons and the Code lab open an editor where you can run Python, JavaScript, HTML, Java, C and C++ and see the output straight away.", "Courses"),
            ("How long do I have access to a course?", "Your plan shows its validity. Renew from Plans before it ends to keep your progress and access.", "Courses"),
        ]
        for i, (q, a, cat) in enumerate(faqs, start=1):
            FAQ.objects.get_or_create(question=q, defaults={"answer": a, "category": cat, "order": i})
        self.stdout.write(self.style.SUCCESS("Demo data created."))
