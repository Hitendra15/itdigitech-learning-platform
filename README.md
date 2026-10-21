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

Not yet built (next phases): code lab, projects, interview prep, AI assistant, certificates, college panel.

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
