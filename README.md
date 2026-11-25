# IT DigiTech Learn: starter (Django REST + React)

Covers the V1 scope: registration, mandatory Razorpay payment, dashboard, courses/modules/lessons,
video + notes, MCQ tests with a server-side timer, progress, notifications over WebSocket.

## What's new in this version
- **Admin console** at `/console` (React, superusers and users with role `admin` only): dashboard with revenue and sign-up charts,
  course / module / lesson editor, test and question editor, students (invite, edit, suspend, unlock courses), orders,
  plans, coupons, support inbox, help articles, announcements, CSV reports, audit log, email log, feature flags and site settings.
  Django's own admin is still available at `/django-admin/` as a fallback.
- **Password recovery**: forgot password, single-use expiring reset link (1 hour), change password, "password changed" security email,
  all other sessions signed out after a reset. Email verification with resend.
- **Support**: students open a request (category, priority, attachment), chat in a thread, and see replies live over WebSocket.
  Admins triage in a live inbox: assign, set status and priority, internal notes, saved replies, reply-and-resolve.
  Resolved requests auto-close after 3 days (Celery beat). Searchable help articles are suggested while typing.
- **Email through Celery**: every email (welcome, verification, reset, security alert, ticket confirmation, ticket reply, announcement,
  export ready) is a Celery task with retries and an `EmailLog` row. HTML templates live in `backend/templates/emails/`.
- **One WebSocket per tab** carries notifications and support events; it reconnects automatically.

Not yet built (next phases): projects, interview prep, AI assistant, college panel.

## What's new: public website, live chat, certificates, code lab
- **Public website** (`frontend/src/site/`): promo bar, sticky header with menu, hero, trust strip, live courses and pricing from the API, features, code-lab and certificate showcases, FAQ (from your help articles), CTA band and footer. Pages: `/`, `/courses`, `/pricing`, `/contact`, `/lab`, `/verify`. Edit company details in `site/config.js`. Logged-in students are sent to their dashboard from `/`.
- **Live chat widget** (`frontend/src/chat/`, `backend/apps/chat/`): visitors chat without an account. A rule-based assistant answers from your FAQ and built-in topics (no external AI, so it never invents policies) and hands over to your team when unsure or when asked for "agent". Staff reply from **Admin console > Live chat** (live over WebSocket; waiting chats show a badge). If the visitor has left, the reply is emailed. Edit support hours in `ChatWidget.jsx` / `site/config.js`.
- **Certificates** (`backend/apps/certificates/`): unlocked when progress reaches `rule_config.min_progress` (default 100) and all published tests are passed (`tests_required`). Students claim and download an A4 PDF with a unique ID and QR code from the course page or **Certificates**. Public verification at `/verify/<ID>`. Admins can withdraw or restore a certificate (**Console > Certificates**).
- **Code lab** (`frontend/src/lab/`, `backend/apps/codelab/`): CodeMirror editor with Run, output, input box and 8 s time limit. Python (Pyodide), JavaScript and HTML run **in the student's browser**. Java, C and C++ run on an **isolated Piston container** (`runner` in docker-compose; set `CODE_RUNNER_URL`). Student code never runs inside Django. Practice lessons get a language and starter code in the course editor, and student work autosaves.

Pyodide is fetched from the jsDelivr CDN on first Python run. Piston needs its language packages installed once (see its CLI docs).

## Run with Docker
```bash
cp backend/.env.example backend/.env      # add your Razorpay TEST keys
docker compose up --build
docker compose exec backend python manage.py createsuperuser     # this account is an admin and can open /console
docker compose exec backend python manage.py seed_demo
```
- Student app: http://localhost:5173  - **Admin console: http://localhost:5173/console**  - Django admin (fallback): http://localhost:8000/django-admin/  - API docs: http://localhost:8000/api/docs/
- In development emails print in the worker log (`docker compose logs -f worker`). For real delivery set the `EMAIL_*` values in `backend/.env`.

## Run without Docker
Needs PostgreSQL and Redis running locally (set POSTGRES_HOST=localhost, REDIS_URL=redis://localhost:6379/0).
```bash
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export $(grep -v '^#' .env | xargs)          # after copying .env.example to .env
python manage.py migrate && python manage.py seed_demo
uvicorn config.asgi:application --reload      # API + WebSocket
celery -A config worker -l info -Q critical,default,exec,reports
celery -A config beat -l info
cd ../frontend && npm install && npm run dev
```

## Razorpay setup
1. Dashboard > Settings > API Keys: put test key id/secret in `backend/.env`.
2. Dashboard > Webhooks: URL `https://<public-host>/api/v1/billing/webhooks/razorpay`
   (use ngrok locally), events `payment.captured`, `payment.failed`, `order.paid`; copy the secret to `RAZORPAY_WEBHOOK_SECRET`.
3. Test UPI/card flows using Razorpay's test credentials.

## Tests
- Backend: `cd backend && pytest` (SQLite + in-memory cache and channel layer, no services needed). Covers password reset, support chat
  including a live WebSocket test, the whole admin API, announcements and exports.
- Frontend: `cd frontend && npm test` (Vitest + jsdom smoke tests for the console and the student support/auth pages).

## Where things live
| Concern | Location |
|---|---|
| Money maths, order creation, `fulfill_order` | `backend/apps/billing/services.py` |
| Webhook (signature + dedupe) | `backend/apps/billing/views.py` |
| Access rule (`has_access`) | `backend/apps/access/services.py` |
| JWT + httpOnly refresh cookie | `backend/apps/accounts/` |
| Test timer + grading | `backend/apps/assessments/services.py` |
| WebSocket auth ticket | `backend/apps/notifications/middleware.py` |
| Feature flags / settings | `backend/apps/platform_config/` |
| Axios client with silent refresh | `frontend/src/api/client.js` |
| Checkout | `frontend/src/pages/Plans.jsx` |
| Admin API (permissions, CRUD, dashboard, audit) | `backend/apps/adminpanel/` |
| Support tickets, live events, auto-close | `backend/apps/support/` |
| Email task, templates, announcements, exports | `backend/apps/notifications/` and `backend/templates/emails/` |
| Reset / verify tokens | `backend/apps/accounts/tokens.py` |
| Admin console screens | `frontend/src/console/` |
| Generic list + form screen used by most admin pages | `frontend/src/components/CrudPage.jsx` |
| Shared WebSocket + live counters | `frontend/src/realtime/Realtime.jsx` |

## Security notes
- Rotate your Razorpay keys if an earlier copy of this project (or its `.env`) was shared. Keys are no longer hard-coded in settings.
- Reset links cannot be replayed, the forgot-password endpoint never reveals whether an email has an account, and both are rate limited.
- Internal ticket notes are never sent to students, over the API or the WebSocket.

## Before production
Strong `DJANGO_SECRET_KEY`; SMTP or SES credentials for email; `FRONTEND_URL` set to your public domain (used in email links); `config.settings.prod`; HTTPS; real video CDN keys; object storage for media;
run Gunicorn/Uvicorn behind Nginx; separate worker pools per Celery queue; Sentry.

## Website content management

The public homepage, company details and promotional banners are managed from **Console → Website**, with no code changes.

- **Homepage**: turn sections on or off, reorder them, edit their content. Edits are saved as drafts; **Preview** shows exactly what visitors will see (desktop, tablet, phone) and **Publish** makes everything live together.
- **Promotions**: schedule banners (start and end date, placements, desktop and mobile images, optional coupon and countdown). Only promotions that are live right now are shown; with none live, no promotional space appears.
- **Media library**: upload JPG, PNG or WebP (max 5 MB; large images are resized and compressed). Images that are still in use cannot be deleted.
- **Website settings**: company name, contact details, footer and SEO title and description.

Backend: `apps/website` (public API under `/api/v1/site/`, admin API under `/api/v1/admin-api/website/`). Every editable field is declared once in `apps/website/schemas.py`, which drives validation, the console forms and image resolution. To add a homepage section type, add its fields there and a renderer in `frontend/src/site/sections.jsx`.

A fresh install gets a default homepage from a data migration. To restore it later: `python manage.py seed_website --reset`.

