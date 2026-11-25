"""Starting content for a fresh install. Everything here is editable from Console → Website."""

DEFAULT_PROFILE = {
    "brand_name": "IT DigiTech",
    "product_name": "IT DigiTech Learn",
    "tagline": "Learn. Practice. Get certified.",
    "about": "An online learning platform for practical IT skills: video lessons, a built-in code lab, timed tests and certificates you can verify.",
    "email": "",
    "phone": "",
    "hours": "Mon–Sat, 10 AM – 7 PM IST",
    "address": "Pune, Maharashtra, India",
    "legal_name": "IT DigiTech Solutions",
    "registration": "",
    "gstin": "",
    "terms_url": "",
    "privacy_url": "",
    "payment_methods": [{"text": t} for t in ("UPI", "Cards", "Net banking", "Wallets")],
    "footer_note": "Prices exclude GST.",
    "seo_title": "IT DigiTech Learn: IT skills with practice, tests and certificates",
    "seo_description": "Hands-on IT courses with video lessons, a built-in code lab, timed tests and certificates you can verify online.",
    "og_image": "",
}

# (section_type, label, enabled, content)
DEFAULT_SECTIONS = [
    ("hero", "Hero", True, {
        "eyebrow": "Learn. Practice. Get certified.",
        "heading": "Start learning IT skills in minutes",
        "subheading": "Hands-on courses with video lessons, a built-in code lab and certificates employers can verify.",
        "bullets": [
            {"text": "Run Python, Java, C and web code with instant output"},
            {"text": "Timed tests, progress tracking and live chat support"},
            {"text": "Download your verified certificate when you finish"},
        ],
        "primary_cta_label": "See plans and pricing", "primary_cta_url": "/pricing",
        "secondary_cta_label": "Try the free code lab", "secondary_cta_url": "/lab",
        "show_starting_price": True,
        "assurance": "Verified certificate on completion",
        "image": "",
    }),
    ("promo", "Promotion", True, {}),
    ("stats", "Statistics", True, {"items": [
        {"value": "6", "label": "Languages in the code lab"},
        {"value": "100%", "label": "Certificates verifiable online"},
        {"value": "24/7", "label": "Assistant, with agents in office hours"},
        {"value": "UPI", "label": "Cards, net banking and wallets accepted"},
    ]}),
    ("highlights", "Why learners choose us", True, {
        "heading": "Why learners choose IT DigiTech",
        "lead": "Everything you need to go from first lesson to a certificate you can show.",
        "items": [
            {"icon": "code", "title": "Practice, not just videos", "text": "A built-in code lab runs Python, JavaScript, HTML, Java, C and C++ with instant output."},
            {"icon": "headset", "title": "Real expert support", "text": "Instant answers from our assistant, and our team joins the same chat when you need a person."},
            {"icon": "award", "title": "Certificates that verify", "text": "Every certificate has a unique ID and QR code so employers can check it online."},
            {"icon": "test", "title": "Timed tests", "text": "Module tests with a server-side timer, instant scores and an explanation for each answer."},
            {"icon": "dashboard", "title": "Easy to learn and track", "text": "Resume where you stopped, see progress on every course and revisit any lesson."},
            {"icon": "receipt", "title": "Pay your way, with GST invoice", "text": "Pay by UPI, RuPay, cards or net banking and get a GST invoice for your business."},
        ],
    }),
    ("showcase", "Product modules", True, {
        "heading": "Everything you need to learn and prove it",
        "lead": "From video lessons and coding practice to tests and certificates, all in one place.",
        "items": [
            {"tag": "Code Lab", "title": "Write code and see the output instantly", "text": "Syntax colours, auto-indent and a run button. Python, JavaScript and HTML run right in your browser.",
             "cta_label": "Try the code lab", "cta_url": "/lab", "image": ""},
            {"tag": "Tests", "title": "Prove what you learned with timed tests", "text": "Server-timed MCQ tests with instant scores and explanations. Retake within the attempt limit.",
             "cta_label": "See plans", "cta_url": "/pricing", "image": ""},
            {"tag": "Certificates", "title": "A certificate employers can verify", "text": "Finish every lesson and pass the tests, then download a PDF with a unique ID and QR code.",
             "cta_label": "Verify a certificate", "cta_url": "/verify", "image": ""},
        ],
    }),
    ("courses", "Courses", True, {
        "heading": "Pick a course and start building",
        "lead": "Beginner-friendly paths with practice lessons after every concept.",
        "limit": 6, "cta_label": "Browse all courses", "cta_url": "/courses",
    }),
    ("plans", "Plans and pricing", True, {
        "heading": "Simple plans. Pay once, learn at your pace.",
        "lead": "Code lab, timed tests, support and a verified certificate come with every plan.",
        "show_included": True,
        "included": [{"text": t} for t in (
            "Video lessons and notes", "Free code lab practice", "Timed tests with scores", "Verified PDF certificate",
            "Progress tracking", "Learn on any device", "Live chat and ticket support", "GST invoice for business",
            "UPI, cards and net banking", "Resume where you left off", "Instant course access", "Secure Razorpay checkout")],
        "show_compare": True,
    }),
    ("support", "Support", True, {
        "heading": "Stress-free learning. Proactive support.",
        "lead": "Instant answers. Real people when you need them.",
        "items": [
            {"icon": "chat", "title": "Instant answers", "text": "Our assistant replies in seconds from our help articles."},
            {"icon": "headset", "title": "Real people", "text": "Support agents join your chat during office hours."},
            {"icon": "play", "title": "Tickets with attachments", "text": "Raise a request, attach screenshots and track every reply."},
            {"icon": "shield", "title": "Email follow-up", "text": "Leave the chat and we email you the reply."},
        ],
        "cta_label": "Chat with us",
    }),
    ("testimonials", "Testimonials", False, {"heading": "What our learners say", "lead": "", "items": []}),
    ("faq", "FAQs", True, {"heading": "Frequently asked questions", "lead": "", "limit": 8}),
    ("cta", "Closing call to action", True, {
        "heading": "Start your learning journey today",
        "text": "Create an account, pick a plan and begin your first lesson in minutes.",
        "cta_label": "Get started", "cta_url": "/register",
        "secondary_cta_label": "", "secondary_cta_url": "",
        "show_offer_code": True,
    }),
]
