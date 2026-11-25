"""Rule-based assistant. It answers from the published FAQ and hands over to a human when unsure.

No third-party AI is called: every answer is something your team wrote, so it can never invent a refund policy.
"""
import re

from apps.support.models import FAQ

STOP = set("a an the is are was were do does did i you we to of for on in at it my me can how what when why and or with this that be have has not no yes please hi hello hey".split())
HUMAN = re.compile(r"\b(human|agent|person|representative|support team|talk to (someone|a)|call me|speak to)\b", re.I)
GREET = re.compile(r"^\s*(hi+|hello+|hey+|good (morning|afternoon|evening)|namaste)\W*$", re.I)
THANKS = re.compile(r"^\s*(thanks?|thank you|ok(ay)?|great|got it)\W*$", re.I)

GREETING = "Hi {name}! I'm the IT DigiTech assistant. Ask about courses, pricing, payments or certificates, or type “agent” to talk to our support team."
HANDOFF = "I'm not sure I can answer that well, so I've asked our support team to join. Keep this window open and they will reply here. {email_note}"
FALLBACK_COURSES = ("Our courses are listed on the Courses page, and each plan shows exactly which courses it includes and for how long. "
                    "Would you like me to connect you to our team for a recommendation?")

BUILTIN = [
    (("price", "pricing", "cost", "fee", "fees", "plan", "plans", "discount", "coupon", "offer"),
     "You can see current plans, validity and GST on the Pricing page. Prices exclude GST, which is added at checkout, and coupon codes can be applied before you pay."),
    (("certificate", "certification", "certified"),
     "You get a downloadable PDF certificate after you finish all lessons and pass the course tests. It has a unique ID and QR code so employers can verify it online."),
    (("course", "courses", "learn", "python", "java", "syllabus", "curriculum"), FALLBACK_COURSES),
    (("refund", "cancel", "money back"),
     "For refund questions our team needs to look at your order, so I'll bring them in."),
]


def _stem(w):
    """Crude plural/ing stripping so "certificates" matches "certificate" and "courses" matches "course"."""
    if w.endswith("ing") and len(w) > 6:
        return w[:-3]
    if w.endswith("s") and not w.endswith("ss") and len(w) > 4:
        return w[:-1]
    return w


def _tokens(text):
    return {_stem(w) for w in re.findall(r"[a-z0-9]+", text.lower()) if w not in STOP and len(w) > 1}


def wants_human(text):
    return bool(HUMAN.search(text))


def reply(text, name="there"):
    """Returns (answer_text, handoff). handoff=True means a person should take over."""
    if GREET.match(text):
        return GREETING.format(name=name.split(" ")[0] or "there"), False
    if THANKS.match(text):
        return "You're welcome! Anything else I can help with?", False
    if wants_human(text):
        return None, True

    q = _tokens(text)
    best, best_score = None, 0
    for faq in FAQ.objects.filter(is_published=True):
        ft = _tokens(faq.question)
        if not ft:
            continue
        score = len(q & ft) / len(ft) + 0.1 * len(q & _tokens(faq.answer))
        if score > best_score:
            best, best_score = faq, score
    if best and best_score >= 0.5:
        return f"{best.answer}\n\nDid that answer your question? If not, type “agent”.", False

    for keys, answer in BUILTIN:
        if q & {_stem(k) for k in keys}:
            return answer, answer.endswith("I'll bring them in.")
    return None, True
